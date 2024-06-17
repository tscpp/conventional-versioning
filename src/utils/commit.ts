import {
  CommitBase as CCCommitBase,
  CommitParser as ConvetionalCommitsParser,
} from "conventional-commits-parser";
import { GifDiff, Git, GitCommit } from "./git.js";
import { Config } from "./config.js";
import logger from "./logger.js";
import { ExecaError } from "execa";
import { renderCommitList } from "./tui.js";

export interface CCCommit extends CCCommitBase {
  scope?: string;
  type?: string;
}

export interface Commit {
  git: GitCommit;
  cc: CCCommit;
  diff: GifDiff;
}

export async function getCommits({
  git,
  config,
}: {
  git: Git;
  config: Config;
}) {
  const cParser = new ConvetionalCommitsParser({
    // ty! https://github.com/conventional-changelog/conventional-changelog/issues/648#issuecomment-704867077
    headerPattern: /^(\w*)(?:\((.*)\))?!?: (.*)$/,
    breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
  });

  const baseHash = config.getBase();

  const gitCommits = await git.log({
    pattern: baseHash ? ["HEAD", `^${baseHash}`] : [],
  });

  const commits: Commit[] = [];
  for (const commit of gitCommits) {
    const cc = cParser.parse(commit.body);
    let diff: GifDiff;
    try {
      diff = await git.diff(`${commit.hash}`, `${commit.hash}~1`);
    } catch (error) {
      if (
        error instanceof ExecaError &&
        (error.stderr! as string)?.includes(
          "unknown revision or path not in the working tree",
        )
      ) {
        await logger.verbose(
          `Found first ever commit [${commit.hash.slice(0, 7)}]!`,
        );
        diff = [];
      } else {
        throw error;
      }
    }

    commits.push({
      git: commit,
      cc,
      diff,
    });
  }

  if (!config.options.ignoreInvalidCommits) {
    const invalid = commits.filter((commit) => !commit.cc.type);
    if (invalid.length > 0) {
      await logger.warn(
        `Found ${invalid.length} invalid conventional commit summary(s):\n` +
          renderCommitList(invalid),
      );
    }
  }

  return commits;
}
