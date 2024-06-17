import chalk from "chalk";
import { Commit } from "./commit.js";
import { Bump, Versioning } from "./version.js";

export function renderList(items: Iterable<string>): string {
  const array = Array.from(items);
  if (array.length === 0) {
    return chalk.dim("  * empty list *");
  }
  return array.map((item) => "  " + chalk.dim("*") + " " + item).join("\n");
}

export function renderTable(rows: string[][]): string {
  const maxLength: number[] = [];

  for (const row of rows) {
    for (const [i, column] of row.entries()) {
      maxLength[i] = Math.max(maxLength[i] ?? 0, column.length);
    }
  }

  return renderList(
    rows.map((row) =>
      row.map((column, i) => column.padEnd(maxLength[i] ?? 0, " ")).join(" ")
    )
  );
}

export function renderCommitHash(hash: string) {
  return "[" + hash.slice(0, 7) + "]";
}

export function renderCommitList(commits: Commit[]) {
  return renderList(
    commits.map(
      (commit) => renderCommitHash(commit.git.hash) + " " + commit.cc.header
    )
  );
}

export function renderVersioning(versioning: readonly Versioning[]): string {
  return renderTable(
    versioning.map((update) => [
      chalk.cyan(update.name) + ":",
      chalk.red(update.oldVersion),
      "->",
      chalk.green(update.newVersion),
    ])
  );
}

export function renderBump(bump: Bump): string {
  switch (bump) {
    case Bump.None:
      return chalk.dim("none");

    case Bump.Patch:
      return chalk.green("patch");

    case Bump.Minor:
      return chalk.blue("minor");

    case Bump.Major:
      return chalk.yellow("major");
  }
}
