import detectIndent from "detect-indent";
import { readFile, writeFile } from "node:fs/promises";
import { PACKAGE_NAME } from "./constants.js";

const DEFAULT_BUMP_MAP = {
  patch: "patch",
  minor: "minor",
  breaking: "major",
  fix: "patch",
  feat: "minor",
  docs: "ignore",
  documentation: "ignore",
  style: "ignore",
  refactor: "ignore",
  perf: "patch",
  peformance: "patch",
  test: "ignore",
  build: "ignore",
  ci: "ignore",
  chore: "ignore",
};

export interface Config {
  $schema?: string | undefined;
  base?: string | undefined;
  pre?: {
    original?: Record<string, string> | undefined;
    promote?: Record<string, string> | undefined;
    prerelease?: string[] | undefined;
  };
  options?: Options | undefined;
}

export async function readConfig(path: string): Promise<Config> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    } else {
      throw error;
    }
  }

  return JSON.parse(text) as Config;
}

export async function writeConfig(path: string, config: Config) {
  let text: string | undefined;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  const indent = text ? detectIndent(text) : undefined;
  config = cleanupConfig(config);
  await writeFile(path, JSON.stringify(config, undefined, indent?.indent ?? 2));
}

function cleanupConfig(config: Config) {
  // Add $schema
  if (!config.$schema) {
    config.$schema = `${PACKAGE_NAME}/schema.json`;
  }

  config.options ??= {};

  // Remove unused.
  if (config.pre) {
    deleteEmpty(config.pre, ["original", "prerelease", "promote"]);
  }
  deleteEmpty(config, ["pre"]);

  return config;

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
