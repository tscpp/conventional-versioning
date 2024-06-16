import detectIndent from "detect-indent";
import { readFile, writeFile } from "node:fs/promises";

const DEFAULT_BUMP_MAP = {
  fix: "patch",
  feat: "minor",
};

export interface Config {
  base?: string;
  pre?: {
    original?: Record<string, string>;
    promote?:  Record<string, string>;
    prerelease?: string[];
  };
  options?: Options;
}

export async function readConfig(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as Config;
}

export async function writeConfig(path: string, config: Config) {
  const text = await readFile(path, "utf8");
  const indent = detectIndent(text);
  cleanupConfig(config);
  await writeFile(path, JSON.stringify(config, undefined, indent.indent));
}

function cleanupConfig(config: Config) {
  if (config.pre) {
    deleteEmpty(config.pre, ["original", "prerelease", "promote"]);
  }

  deleteEmpty(config, ["pre"]);

  function deleteEmpty<T extends object>(object: T, keys: (keyof T)[]) {
    for (const key of keys) {
      const value = object[key];
      if (
        value === undefined ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === "object" &&
          value &&
          Object.entries(value).length === 0)
      ) {
        delete object[key];
      }
    }
  }
}

export interface Options {
  updateWorkspaceDependencies?: boolean;
  onlyUpdateWorkspaceProtocol?: boolean;
  allowOverrideComplexRanges?: boolean;
  allowUpdateStableToPreRelease?: boolean;
  warnOutdatedPreReleaseUsage?: boolean;
  ignoreInvalidCommits?: boolean;
  initialPreReleaseVersion?: number;
  preservePreRelaseSequence?: boolean;
  releaseTypes?: Record<string, string>;
}

export interface NormalizedOptions extends Options {
  updateWorkspaceDependencies: boolean;
  onlyUpdateWorkspaceProtocol: boolean;
  allowOverrideComplexRanges: boolean;
  allowUpdateStableToPreRelease: boolean;
  warnOutdatedPreReleaseUsage: boolean;
  ignoreInvalidCommits: boolean;
  initialPreReleaseVersion: number;
  preservePreRelaseSequence: boolean;
  releaseTypes: Record<string, string>;
}

export function normalizeOptions(
  options: Options | undefined
): NormalizedOptions {
  return {
    updateWorkspaceDependencies: options?.updateWorkspaceDependencies ?? true,
    onlyUpdateWorkspaceProtocol: options?.onlyUpdateWorkspaceProtocol ?? false,
    allowOverrideComplexRanges: options?.allowOverrideComplexRanges ?? false,
    allowUpdateStableToPreRelease:
      options?.allowUpdateStableToPreRelease ?? false,
    warnOutdatedPreReleaseUsage: options?.warnOutdatedPreReleaseUsage ?? true,
    ignoreInvalidCommits: options?.ignoreInvalidCommits ?? false,
    initialPreReleaseVersion: options?.initialPreReleaseVersion ?? 0,
    preservePreRelaseSequence: options?.preservePreRelaseSequence ?? false,
    releaseTypes: {
      ...DEFAULT_BUMP_MAP,
      ...options?.releaseTypes,
    },
  };
}
