import { $ } from "execa";
import newGithubReleaseUrl from "new-github-release-url";
import open from "open";

const $$ = $({ stdio: "inherit" });

if (await hasChanges()) {
  console.error(
    "Working directory has changes. Commit any changes before releasing.",
  );
  process.exit(1);
}

await $$`npm run build`;
await $$`npm run version`;
await $$`npm install`;
await $$`git commit -a -m ${"chore: update versions"}`;
await $$`git push`;
await $$`npm publish`;

const url = newGithubReleaseUrl({
  user: "tscpp",
  repo: "conventional-versioning",
});
await open(url);

async function hasChanges() {
  const { stdout } = await $`git status --porcelain`;
  return stdout.trim() !== "";
}
