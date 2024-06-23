import { CommitParser as ConventionalCommitsParser } from "conventional-commits-parser";
import { createGit } from "./utils/git.js";
import { logger } from "./logger.js";
import { ExecaError } from "execa";
import { renderCommitList } from "./utils/tui.js";
import { Options } from "./options.js";
import { option } from "./utils/option.js";
import { resolve } from "node:path";

export enum FileChangeType {
  Added = "added",
  Modified = "modified",
  Deleted = "deleted",
}

export interface FileChange {
  type: FileChangeType;
  path: string;
}

export interface Commit {
  hash: string;
  diff: FileChange[];
  type: string | undefined;
  header: string | undefined;
}

export type CommitHistory = readonly Commit[];

export async function getCommitHistory(options?: Options) {
  const git = await createGit(options);

  const cParser = new ConventionalCommitsParser({
    // ty! https://github.com/conventional-changelog/conventional-changelog/issues/648#issuecomment-704867077
    headerPattern: /^(\w*)(?:\((.*)\))?!?: (.*)$/,
    breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
  });

  const baseRef = option(options, "base");

  if (!baseRef) {
    logger.warn(
      "No base commit found! The whole commit history will be searched!",
    );
  }

  const gitCommits = await git.log({
    pattern: baseRef ? ["HEAD", `^${baseRef}`] : [],
  });
  logger.debug(`Found ${gitCommits.length} commits since '${baseRef}'.`);

  const commits: Commit[] = [];
  for (const commit of gitCommits) {
    const cc = cParser.parse(commit.body);
    let diff: FileChange[] = [];
    try {
      logger.debug(`Getting diff for commit '${commit.hash}'.`);
      const gitDiff = await git.diff(`${commit.hash}^`, commit.hash);
      diff = gitDiff.map(
        (entry): FileChange => ({
          type:
            {
              A: FileChangeType.Added,
              D: FileChangeType.Deleted,
            }[entry.type.charAt(0)] ?? FileChangeType.Modified,
          path: resolve(option(options, "workspaceRoot"), entry.filename),
        }),
      );
    } catch (error) {
      if (
        error instanceof ExecaError &&
        (error.stderr! as string)?.includes(
          "unknown revision or path not in the working tree",
        )
      ) {
        logger.verbose(`Found first ever commit [${commit.hash.slice(0, 7)}]!`);
      } else {
        throw error;
      }
    }

    commits.push({
      hash: commit.hash,
      diff,
      type: cc["type"] ?? undefined,
      header: cc.header ?? undefined,
    });
  }

  if (!option(options, "ignoreInvalidCommit")) {
    const invalid = commits.filter((commit) => !commit.type);
    if (invalid.length > 0) {
      logger.warn(
        `Found ${invalid.length} invalid conventional commit summary(s):\n` +
          renderCommitList(invalid),
      );
    }
  }

  return commits;
}
