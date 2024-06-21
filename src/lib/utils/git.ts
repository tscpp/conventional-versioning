import { ExecaError, $ as createScriptMethod } from "execa";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Options } from "../options.js";
import { option } from "./option.js";

export interface GitLogOptions {
  pattern?: string[] | undefined;
}

export interface GitCommit {
  hash: string;
  body: string;
}

export interface GitFileStatus {
  type: string;
  filename: string;
}

export type GifDiff = GitFileStatus[];

export interface Git {
  readonly version: string;
  log(options?: GitLogOptions): Promise<GitCommit[]>;
  diff(from: string, to?: string): Promise<GifDiff>;
  getCurrentBranch(): Promise<string>;
  revParse(ref: string): Promise<string>;
}

export async function createGit(options?: Options): Promise<Git> {
  const directory = option(options, "workspaceRoot");
  const gitDirectory = join(directory, ".git");

  const $ = createScriptMethod({
    cwd: directory,
  });

  let version;
  try {
    const { stdout } = await $`git --version`;
    version = stdout.trim();
  } catch {
    throw new Error("Unable to find git. Is it installed?");
  }

  if (!existsSync(gitDirectory)) {
    throw new Error(
      "Directory is not a git repository. Missing '.git' directory. Is git initialized in this directory?",
    );
  }

  return {
    version,

    async log(options) {
      const separator = createRandomHash();
      const inputs = options?.pattern ?? [];
      const parts = ["%H", "%B"];
      const format = `format:${parts.join("\n")}${separator}`;

      let stdout: string;
      try {
        const result = await $`git log ${inputs} --format=${format}`;
        stdout = result.stdout;
      } catch (error) {
        if (
          error instanceof ExecaError &&
          /your current branch '.+?' does not have any commits yet/.test(
            error.stderr! as string,
          )
        ) {
          return [];
        } else {
          throw error;
        }
      }

      const logs = [];

      let start = 0,
        end: number;
      while ((end = stdout.indexOf(separator, start)) !== -1) {
        logs.push(stdout.slice(start, end).trimStart());
        start = end + separator.length;
      }

      return logs.map((log): GitCommit => {
        const [hash, ...body] = log.split("\n") as [string, ...string[]];

        return {
          hash,
          body: body.join("\n"),
        };
      });
    },

    async diff(from, to) {
      const inputs = [from, to].filter((v): v is string => !!v);
      const { stdout } =
        await $`git diff ${inputs} --format=${""} --name-status`;

      return stdout
        .split("\n")
        .filter((line) => /^[ARM]\S*\t/.test(line))
        .map((line) => {
          const [type = "", filename = ""] =
            /^(\S+)\t(\S+)/.exec(line)?.slice(1) ?? [];
          return { type, filename };
        });
    },

    async getCurrentBranch() {
      const { stdout } = await $`git branch --show-current`;
      return stdout.trim();
    },

    async revParse(ref) {
      const { stdout } = await $`git rev-parse --verify ${ref}`;
      return stdout.trim();
    },
  };
}

function createRandomHash() {
  return createHash("sha256")
    .update(Math.random().toString())
    .digest("base64url");
}
