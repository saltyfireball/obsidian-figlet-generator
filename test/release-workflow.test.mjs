import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root } from "./bundle.mjs";

const workflow = readFileSync(join(root, ".github/workflows/release.yml"), "utf8");

/** The run command of the "Require an existing tag" step, as committed. */
const requireTag = /- name: Require an existing tag\n(?:\s+.*\n)*?\s+run: (.*)\n/.exec(workflow)?.[1];

// A local repository stands in for GitHub: GITHUB_SERVER_URL/GITHUB_REPOSITORY
// point at it, so the step runs without a network or a real release.
const server = mkdtempSync(join(tmpdir(), "release-workflow-"));
// No global or system config: a developer's commit signing must not apply here
const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
const git = (...args) => execFileSync("git", ["-C", join(server, "repo"), ...args], { stdio: "pipe", env: gitEnv });
execFileSync("git", ["init", "-q", "-b", "main", join(server, "repo")], { env: gitEnv });
git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init");
git("branch", "feature");
git("tag", "1.2.3");

function runRequireTag(tag) {
	return spawnSync("bash", ["-c", requireTag], {
		env: { ...gitEnv, TAG: tag, GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: "repo" },
		encoding: "utf8",
	});
}

test("the workflow has a tag check step", () => {
	assert.ok(requireTag, "no 'Require an existing tag' step with a one-line run command");
});

test("the tag check passes for an existing tag", () => {
	assert.equal(runRequireTag("1.2.3").status, 0);
});

test("the tag check rejects a branch with no matching tag", () => {
	const result = runRequireTag("feature");
	assert.notEqual(result.status, 0);
	assert.match(result.stdout, /::error::tag feature does not exist/);
});

test("checkout and release accept only a tag", () => {
	assert.match(workflow, /ref: refs\/tags\//);
	assert.match(workflow, /--verify-tag/);
});

test("npm runs only in the job without write or OIDC tokens", () => {
	const [, build, release] = /\n {2}build:\n([\s\S]*?)\n {2}release:\n([\s\S]*)$/.exec(workflow) ?? [];
	assert.ok(build && release, "expected a build job followed by a release job");
	assert.match(build, /npm ci/);
	assert.doesNotMatch(build, /: write/);
	assert.match(build, /persist-credentials: false/);
	assert.doesNotMatch(release, /npm |actions\/checkout/);
});
