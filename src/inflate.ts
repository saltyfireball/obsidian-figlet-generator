/**
 * Minimal gzip/DEFLATE decoder (RFC 1952 / RFC 1951) for the bundled fonts.
 * DecompressionStream would do this natively, but it only reached iOS in
 * 16.4, and Obsidian mobile runs on older WebViews too. Every bundled font
 * is checked against its source file in test/bundled-fonts.test.mjs.
 */

interface Huffman {
	counts: Uint16Array; // number of codes of each length
	symbols: Uint16Array; // symbols ordered by code
}

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function buildHuffman(lengths: ArrayLike<number>, offset: number, n: number): Huffman {
	const counts = new Uint16Array(16);
	const symbols = new Uint16Array(n);
	for (let i = 0; i < n; i++) counts[lengths[offset + i]]++;
	counts[0] = 0;
	const offs = new Uint16Array(16);
	for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
	for (let i = 0; i < n; i++) {
		const len = lengths[offset + i];
		if (len) symbols[offs[len]++] = i;
	}
	return { counts, symbols };
}

const FIXED_LIT = (() => {
	const l = new Uint8Array(288);
	l.fill(8, 0, 144);
	l.fill(9, 144, 256);
	l.fill(7, 256, 280);
	l.fill(8, 280, 288);
	return buildHuffman(l, 0, 288);
})();
const FIXED_DIST = buildHuffman(new Uint8Array(30).fill(5), 0, 30);

class Inflater {
	private pos: number;
	private bitBuf = 0;
	private bitCnt = 0;
	private out: Uint8Array;
	private outLen = 0;

	constructor(private src: Uint8Array, start: number) {
		this.pos = start;
		this.out = new Uint8Array(Math.max(1024, src.length * 8));
	}

	private bits(n: number): number {
		while (this.bitCnt < n) {
			if (this.pos >= this.src.length) throw new Error("inflate: unexpected end of data");
			this.bitBuf |= this.src[this.pos++] << this.bitCnt;
			this.bitCnt += 8;
		}
		const v = this.bitBuf & ((1 << n) - 1);
		this.bitBuf >>>= n;
		this.bitCnt -= n;
		return v;
	}

	private decode(h: Huffman): number {
		let code = 0;
		let first = 0;
		let index = 0;
		for (let len = 1; len < 16; len++) {
			code |= this.bits(1);
			const count = h.counts[len];
			if (code - count < first) return h.symbols[index + (code - first)];
			index += count;
			first += count;
			first <<= 1;
			code <<= 1;
		}
		throw new Error("inflate: bad Huffman code");
	}

	private push(byte: number): void {
		if (this.outLen === this.out.length) {
			const grown = new Uint8Array(this.out.length * 2);
			grown.set(this.out);
			this.out = grown;
		}
		this.out[this.outLen++] = byte;
	}

	private stored(): void {
		this.bitBuf = 0;
		this.bitCnt = 0;
		const s = this.src;
		if (this.pos + 4 > s.length) throw new Error("inflate: unexpected end of data");
		const len = s[this.pos] | (s[this.pos + 1] << 8);
		const nlen = s[this.pos + 2] | (s[this.pos + 3] << 8);
		if (len !== (~nlen & 0xffff)) throw new Error("inflate: bad stored block length");
		this.pos += 4;
		if (this.pos + len > s.length) throw new Error("inflate: unexpected end of data");
		for (let i = 0; i < len; i++) this.push(s[this.pos++]);
	}

	private dynamicTables(): [Huffman, Huffman] {
		const hlit = this.bits(5) + 257;
		const hdist = this.bits(5) + 1;
		const hclen = this.bits(4) + 4;
		const clen = new Uint8Array(19);
		for (let i = 0; i < hclen; i++) clen[CODE_LENGTH_ORDER[i]] = this.bits(3);
		const clh = buildHuffman(clen, 0, 19);

		const lengths = new Uint8Array(hlit + hdist);
		for (let i = 0; i < hlit + hdist; ) {
			const sym = this.decode(clh);
			if (sym < 16) {
				lengths[i++] = sym;
				continue;
			}
			let repeat: number;
			let value = 0;
			if (sym === 16) {
				if (i === 0) throw new Error("inflate: repeat with no previous length");
				value = lengths[i - 1];
				repeat = 3 + this.bits(2);
			} else if (sym === 17) {
				repeat = 3 + this.bits(3);
			} else {
				repeat = 11 + this.bits(7);
			}
			if (i + repeat > hlit + hdist) throw new Error("inflate: too many code lengths");
			while (repeat--) lengths[i++] = value;
		}
		return [buildHuffman(lengths, 0, hlit), buildHuffman(lengths, hlit, hdist)];
	}

	private compressed(lit: Huffman, dist: Huffman): void {
		for (;;) {
			const sym = this.decode(lit);
			if (sym < 256) {
				this.push(sym);
			} else if (sym === 256) {
				return;
			} else {
				const li = sym - 257;
				if (li >= 29) throw new Error("inflate: bad length symbol");
				const len = LENGTH_BASE[li] + this.bits(LENGTH_EXTRA[li]);
				const di = this.decode(dist);
				if (di >= 30) throw new Error("inflate: bad distance symbol");
				const d = DIST_BASE[di] + this.bits(DIST_EXTRA[di]);
				if (d > this.outLen) throw new Error("inflate: distance too far back");
				for (let i = 0; i < len; i++) this.push(this.out[this.outLen - d]);
			}
		}
	}

	run(): Uint8Array {
		let last = 0;
		while (!last) {
			last = this.bits(1);
			const type = this.bits(2);
			if (type === 0) this.stored();
			else if (type === 1) this.compressed(FIXED_LIT, FIXED_DIST);
			else if (type === 2) this.compressed(...this.dynamicTables());
			else throw new Error("inflate: bad block type");
		}
		return this.out.subarray(0, this.outLen);
	}
}

/**
 * Decompress a gzip member (header, DEFLATE data; the trailer is ignored)
 */
export function gunzip(data: Uint8Array): Uint8Array {
	if (data.length < 18 || data[0] !== 0x1f || data[1] !== 0x8b || data[2] !== 8) {
		throw new Error("gunzip: not gzip data");
	}
	const flags = data[3];
	let pos = 10;
	if (flags & 4) pos += 2 + (data[pos] | (data[pos + 1] << 8)); // FEXTRA
	if (flags & 8) while (data[pos++] !== 0); // FNAME
	if (flags & 16) while (data[pos++] !== 0); // FCOMMENT
	if (flags & 2) pos += 2; // FHCRC
	return new Inflater(data, pos).run();
}
