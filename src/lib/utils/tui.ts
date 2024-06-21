import chalk from "chalk";
import { Commit } from "../history.js";
import { VersionUpdate } from "../versioning.js";

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
      row.map((column, i) => column.padEnd(maxLength[i] ?? 0, " ")).join(" "),
    ),
  );
}

export function renderCommitHash(hash: string) {
  return "[" + hash.slice(0, 7) + "]";
}

export function renderCommitList(commits: Commit[]) {
  return renderList(
    commits.map(
      (commit) => renderCommitHash(commit.hash) + " " + commit.header,
    ),
  );
}

export function renderVersioning(versioning: readonly VersionUpdate[]): string {
  return renderTable(
    versioning.map((update) => [
      chalk.cyan(update.name) + ":",
      chalk.red(update.oldVersion),
      "->",
      chalk.green(update.newVersion),
    ]),
  );
}

export function link(link: string) {
  return chalk.underline.blue(link);
}
