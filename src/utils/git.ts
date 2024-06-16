import { $ as createScriptMethod } from "execa";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface GitLogOptions {
  pattern?: string[] | undefined;
}

export interface GitCommit {
  hash: string;
  body: string;
}

export enum GitFileStatusType {
  Added = "A",
  Modified = "M",
  Deleted = "D",
}

export interface GitFileStatus {
  type: GitFileStatusType;
  filename: string;
}

export type GifDiff = GitFileStatus[];

export interface Git {
  readonly version: string;
  log(options?: GitLogOptions): Promise<GitCommit[]>;
  diff(from: string, to?: string): Promise<GifDiff>;
}

export async function createGit(directory = "."): Promise<Git> {
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
      const { stdout } = await $`git log ${inputs} --format=${format}`;

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
        .filter((v) => v !== "")
        .map((line) => {
          const type = line.charAt(0) as GitFileStatusType;
          const filename = line.slice(2);
          return {
            type,
            filename,
          };
        });
    },
  };
}

function createRandomHash() {
  return createHash("sha256")
    .update(Math.random().toString())
    .digest("base64url");
}
