declare module "virtual:figlet-fonts" {
	/** Font name to gzipped .flf contents, base64 encoded. */
	const fonts: Record<string, string>;
	export default fonts;
}
