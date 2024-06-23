import { Bump } from "./bump.js";

export interface Options {
  /**
   * Wether to only update version ranges of internal dependencies using the
   * `workspace:` protocol.
   */
  onlyWorkspaceProtocol?: boolean | undefined;

  /**
   * Wether to overrides complex version ranges of internal dependencies to the
   * latest version.
   * @default false
   */
  overrideComplexRange?: boolean | undefined;

  /**
   * Wether to allow stable version ranges of internal dependencies to
   * pre-release versions.
   * @default false
   */
  updateStableToPreRelease?: boolean | undefined;

  /**
   * Whether to ignore warnings about usage of pre-release versions where a
   * newer stable version exists.
   * @default false
   */
  ignoreOutdatedPreRelease?: boolean | undefined;

  /**
   * Whether to ignore warnings about invalid conventional commit messages.
   * @default false
   */
  ignoreInvalidCommit?: boolean | undefined;

  /**
   * The initial number to use in the pre-release sequence.
   * @default 0
   */
  initialPreRelease?: number | undefined;

  /**
   * Whether to preserve the sequence of pre-release when bumping the main version.
   *
   * - Enabled: `1.0.0-rc.5` -> `1.1.0-rc.0`
   * - Disabled: `1.0.0-rc.5` -> `1.1.0-rc.6`
   *
   * @default false
   */
  preservePreRelease?: boolean | undefined;

  /**
   * Whether to include private packages in versioning.
   * @default false
   */
  includePrivate?: boolean | undefined;

  /**
   * Allow versioning to bump versions from `0.x` to `1.x` major.
   * @default false
   */
  allowFirstMajor?: boolean | undefined;

  /**
   * Prevent major bumps without manual promotions.
   * @default false
   */
  preventMajorBump?: boolean | undefined;

  /**
   * Pattern of packages to include in versioning. When specified, only
   * packages that match the patterns will be included. Use `*` to allow any
   * sequence of characters.
   */
  include?: string[] | undefined;

  /**
   * Pattern of packages to exclude in versioning. Use `*` to allow any
   * sequence of characters.
   */
  exclude?: string[] | undefined;

  /**
   * Patterns of packages to have linked versions. Use `*` to allow any
   * sequence of characters.
   */
  linked?: string[][] | undefined;

  /**
   * Patterns of packages to have fixed versions. Use `*` to allow any sequence
   * of characters.
   */
  fixed?: string[][] | undefined;

  inputs?: string[];

  /**
   * The base git ref for getting commit history. Everything after this commit
   * will be used as reference for versioning.
   * @default "HEAD"
   */
  base?: string | undefined;

  /**
   * Record of conventional commit type to version bump. By default, all types
   * specified by `@commitlint/config-conventional` (based on the Angular convention) are defined.
   */
  bumps?: Record<string, Bump | null> | undefined;

  /**
   * A record of manual promotions and their version bump to be incremented for each package.
   *
   * @example
   * { "my-package": "minor" }
   */
  promotions?: Record<string, Bump | undefined> | undefined;

  /**
   * A record of packages to pre-release and their original version.
   *
   * @example
   * { "my-package": "1.2.3" }
   */
  preReleases?: Record<string, string> | undefined;

  /**
   * Path to the root workspace directory.
   * @default "./"
   */
  workspaceRoot?: string;
}

export const DEFAULT_OPTIONS = {
  onlyWorkspaceProtocol: false,
  overrideComplexRange: false,
  updateStableToPreRelease: false,
  ignoreOutdatedPreRelease: false,
  ignoreInvalidCommit: false,
  initialPreRelease: 0,
  preservePreRelease: false,
  includePrivate: false,
  allowFirstMajor: false,
  preventMajorBump: false,
  include: [],
  exclude: [],
  linked: [],
  fixed: [],
  inputs: ["{workspace}/**/*", "{package}/**/*"],
  base: undefined,
  bumps: {},
  promotions: {},
  preReleases: {},
  workspaceRoot: "./",
} satisfies Required<Options>;
