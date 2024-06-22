import { $ } from "execa";
import { readFile } from "node:fs/promises";
import newGithubReleaseUrl from "new-github-release-url";
import open from "open";
import { SemVer } from "semver";

const $$ = $({ stdio: "inherit" });

if (await hasChanges()) {
  console.error(
    "Working directory has changes. Commit any changes before releasing.",
  );
  process.exit(1);
}

await $$`npm run build`;
await $$`npm run version`;
const pkg = JSON.parse(await readFile("package.json", "utf8"));
await $$`npm install`;
await $$`git commit -a -m ${"chore: update versions"}`;
await $$`git tag v${pkg.version}`;
await $$`git push`;
await $$`npm publish`;

const url = newGithubReleaseUrl({
  user: "tscpp",
  repo: "conventional-versioning",
  tag: `v${pkg.version}`,
  isPrerelease: isPreRelease(pkg.version),
});
await open(url);

async function hasChanges() {
  const { stdout } = await $`git status --porcelain`;
  return stdout.trim() !== "";
}

function isPreRelease(version) {
  version = new SemVer(version);
  return version.prerelease.length > 0;
}
