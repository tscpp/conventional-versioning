import detectIndent from "detect-indent";
import { readFile, writeFile } from "node:fs/promises";
import { PACKAGE_NAME } from "./constants.js";
import { Bump, formatBumpOrUndefined, toBump } from "./version.js";
import { spliceValueFromArray } from "./misc.js";
import escapeStringRegexp from "escape-string-regexp";

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

export interface ConfigRaw {
  $schema?: string | undefined;
  base?: string | undefined;
  pre?: {
    original?: Record<string, string | undefined> | undefined;
    promote?: Record<string, string | undefined> | undefined;
    prerelease?: string[] | undefined;
  };
  options?: OptionsRaw | undefined;
}

export class Config {
  static default: ConfigRaw = {};

  static async read(path: string) {
    let text: string | undefined;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    const raw = text ? (JSON.parse(text) as ConfigRaw) : Config.default;
    const indent = text ? detectIndent(text).indent : undefined;
    return new Config(path, raw, indent);
  }

  #indent: string;

  readonly options: Options;

  protected constructor(
    readonly path: string,
    readonly raw: ConfigRaw,
    indent?: string | undefined,
  ) {
    this.#indent = indent ?? "  ";
    this.options = normalizeOptions(this.raw.options);
  }

  getPromotions(): ReadonlyMap<string, Bump> {
    const map = new Map<string, Bump>();

    if (this.raw.pre?.promote) {
      for (const [key, value] of Object.entries(this.raw.pre.promote)) {
        if (value) {
          map.set(key, toBump(value));
        }
      }
    }

    return map;
  }

  getPromotion(name: string): Bump {
    return toBump(this.raw.pre?.promote?.[name] ?? "none");
  }

  setPromotion(name: string, value: Bump) {
    this.raw.pre ??= {};
    this.raw.pre.promote ??= {};
    this.raw.pre.promote[name] = formatBumpOrUndefined(value);
  }

  getOriginalVersions(): ReadonlyMap<string, string> {
    const map = new Map<string, string>();

    if (this.raw.pre?.original) {
      for (const [key, value] of Object.entries(this.raw.pre.original)) {
        if (value) {
          map.set(key, value);
        }
      }
    }

    return map;
  }

  getOriginalVersion(name: string): string | undefined {
    return this.raw.pre?.original?.[name];
  }

  hasOriginalVersion(name: string) {
    return !!this.getOriginalVersion(name);
  }

  setOriginalVersion(name: string, value: string | undefined) {
    this.raw.pre ??= {};
    this.raw.pre.original ??= {};
    this.raw.pre.original[name] = value;
  }

  isPreRelease(name: string) {
    return this.raw.pre?.prerelease?.includes(name) ?? false;
  }

  setPreRelease(name: string, value: boolean) {
    if (value) {
      this.raw.pre ??= {};
      this.raw.pre.prerelease ??= [];
      if (!this.raw.pre.prerelease.includes(name)) {
        this.raw.pre.prerelease.push(name);
      }
    } else if (this.raw.pre?.prerelease?.includes(name)) {
      spliceValueFromArray(this.raw.pre.prerelease, name);
    }
  }

  getPreReleases(): readonly string[] {
    return this.raw.pre?.prerelease?.slice() ?? [];
  }

  getBase(): string | undefined {
    return this.raw.base;
  }

  setBase(value: string | undefined) {
    this.raw.base = value;
  }

  protected cleanup() {
    this.raw.$schema ??= `${PACKAGE_NAME}/schema.json`;
    this.raw.options ??= {};
    if (this.raw.pre) {
      deleteEmpty(this.raw.pre, ["original", "prerelease", "promote"]);
    }
    deleteEmpty(this.raw, ["pre"]);

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

  async save() {
    this.cleanup();
    await writeFile(
      this.path,
      JSON.stringify(this.raw, undefined, this.#indent),
    );
  }
}

export function patternToRegex(pattern: string) {
  return new RegExp(
    "^" + escapeStringRegexp(pattern).replaceAll("\\*", ".+") + "$",
  );
}

export interface OptionsRaw {
  onlyUpdateWorkspaceProtocol?: boolean;
  allowOverrideComplexRanges?: boolean;
  allowUpdateStableToPreRelease?: boolean;
  warnOutdatedPreReleaseUsage?: boolean;
  ignoreInvalidCommits?: boolean;
  initialPreReleaseVersion?: number;
  preservePreRelaseSequence?: boolean;
  includePrivatePackages?: boolean;
  releaseTypes?: Record<string, string>;
  include?: string[] | undefined;
  exclude?: string[] | undefined;
  linked?: string[][] | undefined;
  fixed?: string[][] | undefined;
}

export interface Options extends OptionsRaw {
  readonly raw: OptionsRaw;
  readonly onlyUpdateWorkspaceProtocol: boolean;
  readonly allowOverrideComplexRanges: boolean;
  readonly allowUpdateStableToPreRelease: boolean;
  readonly warnOutdatedPreReleaseUsage: boolean;
  readonly ignoreInvalidCommits: boolean;
  readonly initialPreReleaseVersion: number;
  readonly preservePreRelaseSequence: boolean;
  readonly includePrivatePackages: boolean;
  readonly releaseTypes: Record<string, string>;
  readonly include: string[] | undefined;
  readonly exclude: string[] | undefined;
  readonly linked: string[][];
  readonly fixed: string[][];
}

function normalizeOptions(options: OptionsRaw | undefined): Options {
  options ??= {};

  return {
    raw: options,
    onlyUpdateWorkspaceProtocol: options.onlyUpdateWorkspaceProtocol ?? false,
    allowOverrideComplexRanges: options.allowOverrideComplexRanges ?? false,
    allowUpdateStableToPreRelease:
      options.allowUpdateStableToPreRelease ?? false,
    warnOutdatedPreReleaseUsage: options.warnOutdatedPreReleaseUsage ?? true,
    ignoreInvalidCommits: options.ignoreInvalidCommits ?? false,
    initialPreReleaseVersion: options.initialPreReleaseVersion ?? 0,
    preservePreRelaseSequence: options.preservePreRelaseSequence ?? false,
    includePrivatePackages: options.includePrivatePackages ?? false,
    releaseTypes: {
      ...DEFAULT_BUMP_MAP,
      ...options.releaseTypes,
    },
    include: options.include,
    exclude: options.exclude,
    linked: options.linked ?? [],
    fixed: options.fixed ?? [],
  };
}
