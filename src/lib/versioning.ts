import { Range, SemVer, compare } from "semver";
import { CommitHistory } from "./history.js";
import { logger } from "./logger.js";
import { DEFAULT_OPTIONS, Options } from "./options.js";
import { option } from "./utils/option.js";
import { link, renderList, renderVersioning } from "./utils/tui.js";
import {
  incrementPreRelease,
  isPreRelease,
  isVersion,
  resetPreRelease,
} from "./utils/version.js";
import { Package, Workspace, packagePatternToRegExp } from "./workspace.js";
import chalk from "chalk";
import { isAbsolute, join, relative, resolve } from "node:path";
import { Bump, compareBump } from "./bump.js";
import { DEPENDENCY_KEYS } from "./utils/dependencies.js";
import { readJsoncFile, writeJsoncFile } from "./utils/jsonc.js";
import { minimatch } from "minimatch";
import { containsPath } from "./utils/utils.js";

const DEFAULT_TYPES: Record<string, Bump | null> = {
  patch: "patch",
  minor: "minor",
  breaking: "major",
  fix: "patch",
  feat: "minor",
  docs: null,
  documentation: null,
  style: null,
  refactor: null,
  perf: "patch",
  peformance: "patch",
  test: null,
  build: null,
  ci: null,
  chore: null,
};

export interface VersionUpdate {
  name: string;
  oldVersion: string;
  newVersion: string;
  bump: Bump | undefined;
}

export function createVersioningPlan(
  workspace: Workspace,
  history: CommitHistory,
  options?: Options
): VersionUpdate[] {
  const bumps = new Map<Package, Bump | undefined>();

  for (const pkg of workspace.packages) {
    if (
      isPreRelease(pkg.version) &&
      !option(options, "preReleases")[pkg.name]
    ) {
      throw logger.fatal(
        `Pre-release for package '${pkg.name}' is not configured.\n` +
          `See ${link("https://github.com/tscpp/conventional-versioning/discussions/3.")}`
      );
    }
  }

  for (const pkg of workspace.packages) {
    let bump = inferBumpFromCommits(workspace, pkg, history, options);

    const promotion = option(options, "promotions")[pkg.name];
    if (promotion) {
      if (!bump || compareBump(bump, promotion) > 0) {
        bump = promotion;
      }
    }

    bumps.set(pkg, bump);
  }

  const sortedPackages = workspace.packages
    .slice()
    .sort((a, b) =>
      a.dependencies.some((dependency) => dependency.name === b.name) ? 1 : -1
    );

  let repeat = false;
  // TODO: This is somewhat of a hack. We repeat this until no more changes can
  // be done.
  do {
    // Check if we need to update any internal dependencies used in the
    // workspace packages.
    for (const ourPackage of sortedPackages) {
      const ourBump = bumps.get(ourPackage)!;

      for (const dependency of ourPackage.dependencies) {
        const theirPackage = workspace.packages.find(
          (pkg) => pkg.name === dependency.name
        )!;
        const theirBump = bumps.get(theirPackage)!;

        // Any bump in a dependency causes a patch bump in the parent package.
        if (
          compareBump(theirBump, "patch") >= 0 &&
          compareBump(ourBump, "patch") < 0
        ) {
          bumps.set(ourPackage, "patch");
          repeat = true;
        }

        // Minor bumps in peer dependencies causes major bump in parent package.
        // https://github.com/tscpp/conventional-versioning/discussions/2
        if (
          dependency.isPeer &&
          compareBump(theirBump, "minor") >= 0 &&
          compareBump(ourBump, "major") < 0
        ) {
          bumps.set(ourPackage, "major");
          repeat = true;
        }
      }
    }

    // Check for any linked/fixed relations between workspace packages.
    for (const type of ["linked", "fixed"] as const) {
      const relations = option(options, type);

      for (const patterns of relations) {
        const included = patterns.flatMap((pattern) =>
          workspace.packages.filter((pkg) =>
            packagePatternToRegExp(pattern).test(pkg.name)
          )
        );

        if (included.length === 0) {
          logger.warn(
            `Following patterns specified in the "${type}" option matches no packages:\n` +
              renderList(patterns)
          );
        }

        const stablePkgs = included.filter((pkg) => !isPreRelease(pkg.version));
        const prePkgs = included.filter((pkg) => isPreRelease(pkg.version));

        const greatestStable = stablePkgs
          .map((pkg) => pkg.version)
          .reduce((a, b) => (compare(a, b) >= 0 ? a : b));
        const greatestPre = prePkgs
          .map((pkg) => pkg.version)
          .reduce((a, b) => (compare(a, b) >= 0 ? a : b));

        for (const pkg of included) {
          // Stable versions set the minimum for both stable and pre-release
          // versions, while pre-release versions only set the minimum for
          // pre-release versions. Meaning that stable versions can bump both
          // as stable and pre-release siblings, while pre-releases only can
          // bump other pre-release siblings.

          const version = new SemVer(pkg.version);

          const greatest = new SemVer(
            isPreRelease(pkg.version) ? greatestPre : greatestStable
          );

          if (greatest.major > version.major) {
            bumps.set(pkg, "major");
            repeat = true;
          } else if (greatest.minor > version.minor) {
            bumps.set(pkg, "minor");
            repeat = true;
          } else if (greatest.patch > version.patch && type === "fixed") {
            bumps.set(pkg, "patch");
            repeat = true;
          }
        }
      }
    }
  } while (repeat);

  const versioning: VersionUpdate[] = [];

  for (const pkg of workspace.packages) {
    let bump = bumps.get(pkg);
    if (!bump) continue;

    /** The package's current version. */
    const currentVersion = new SemVer(pkg.version);

    const baseVersionText = isPreRelease(pkg.version)
      ? option(options, "preReleases")?.[pkg.name]
      : pkg.version;
    if (!baseVersionText) {
      // This should be already caught. Just to be safe.
      throw logger.fatal(
        `Pre-release for package '${pkg.name}' is not configured.`
      );
    }
    /**
     * The version to base increments from. Normally this is the same as
     * {@link currentVersion}, except in pre-releases.
     */
    const baseVersion = new SemVer(baseVersionText);

    // Limit bump for '0.x' packages to 'minor', to prevent releasing the first
    // stable version, which may not be wanted.
    const skipMajor =
      new SemVer(pkg.version).major === 0 &&
      option(options, "promotions")?.[pkg.name] !== "major" &&
      !option(options, "allowFirstMajor");
    if (skipMajor && compareBump(bump, "major") >= 0) {
      bump = "minor";
    }

    // Calculate new version.
    let newVersion = baseVersion.inc(bump);
    newVersion.prerelease = currentVersion.prerelease;

    if (isPreRelease(currentVersion)) {
      // When the main version (stable version before pre-release suffix) has
      // not changed, revert to the current version.
      const noMainBump = currentVersion.compareMain(newVersion) >= 0;
      if (noMainBump) {
        newVersion = new SemVer(currentVersion.format());
      }

      // Increment or reset the pre-release number.
      if (noMainBump || option(options, "preservePreRelease")) {
        incrementPreRelease(newVersion);
      } else {
        resetPreRelease(
          newVersion,
          option(options, "initialPreRelease") ??
            DEFAULT_OPTIONS.initialPreRelease
        );
      }
    }

    versioning.push({
      name: pkg.name,
      oldVersion: currentVersion.format(),
      newVersion: newVersion.format(),
      bump,
    });
  }

  return versioning;
}

function inferBumpFromCommits(
  workspace: Workspace,
  pkg: Package,
  history: CommitHistory,
  options?: Options
) {
  let bump: Bump | undefined;

  const typeMap = {
    ...DEFAULT_TYPES,
    ...option(options, "customTypes"),
  };

  const workspaceRoot = resolveWorkspaceRoot(workspace);
  const packageRoot = resolvePackageRoot(workspace, pkg);

  const inputs = option(options, "inputs").map((pattern) =>
    pattern
      // preferred
      .replaceAll("{workspace}", workspaceRoot)
      .replaceAll("{package}", packageRoot)
      // aliases
      .replaceAll("{root}", workspaceRoot)
      .replaceAll("{workspaceRoot}", workspaceRoot)
      .replaceAll("{packageRoot}", packageRoot)
      .replaceAll("{pkg}", packageRoot)
      .replaceAll("{project}", packageRoot)
      .replaceAll("{projectRoot}", packageRoot)
  );
  const include = inputs.filter((pattern) => !pattern.startsWith("!"));
  const exclude = inputs
    .filter((pattern) => pattern.startsWith("!"))
    .map((pattern) => pattern.slice(1));

  for (const commit of history) {
    if (!commit.type) {
      continue;
    }

    const affected = commit.diff.some(
      (change) =>
        // another package cannot contain the file
        !workspace.packages
          .filter((theirs) => theirs.name !== pkg.name)
          .some((theirs) => containsPath(theirs.path, change.path)) &&
        // and must match patterns
        include.some((pattern) => minimatch(change.path, pattern)) &&
        !exclude.some((pattern) => minimatch(change.path, pattern))
    );
    if (!affected) {
      continue;
    }

    const comparator = typeMap[commit.type];
    if (comparator && (!bump || compareBump(bump, comparator) > 0)) {
      bump = comparator;
    }
  }

  return bump;
}

function resolveWorkspaceRoot(workspace: Workspace) {
  let workspaceRoot = workspace.path;
  if (!isAbsolute(workspaceRoot)) {
    workspaceRoot = resolve(workspaceRoot);
  }
  return workspaceRoot;
}

function resolvePackageRoot(workspace: Workspace, pkg: Package) {
  let packageRoot = pkg.path;
  if (!isAbsolute(packageRoot)) {
    packageRoot = join(resolveWorkspaceRoot(workspace), packageRoot);
  }
  return packageRoot;
}

export function validateVersions(
  workspace: Workspace,
  updates: VersionUpdate[],
  options?: Options
) {
  const packagesWithMajorBump = workspace.packages.filter(
    (pkg) =>
      updates.find((update) => update.name === pkg.name)?.bump === "major"
  );

  if (packagesWithMajorBump.length > 0 && option(options, "preventMajorBump")) {
    logger.fatal(
      "Commit history includes breaking changes, however major bump are not allowed. " +
        "You have to manually promote the packages:\n" +
        renderList(packagesWithMajorBump.map((pkg) => pkg.name))
    );
  }
}

export async function updateVersions(
  workspace: Workspace,
  updates: VersionUpdate[],
  options?: Options
) {
  validateVersions(workspace, updates, options);

  for (const pkg of workspace.packages) {
    const packageJsonPath = join(pkg.path, "package.json");
    const packageJson = (await readJsoncFile(packageJsonPath)) as {
      version: string;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      peerDependencies: Record<string, string>;
      optionalDependencies: Record<string, string>;
    };

    // Update our package's version.
    const update = updates.find((update) => update.name === pkg.name);
    if (update) {
      pkg.version = update.newVersion;
      packageJson.version = update.newVersion;
    }

    for (const dependencyKey of DEPENDENCY_KEYS) {
      const dependencies = packageJson[dependencyKey];
      if (!dependencies) continue;

      for (const entry of Object.entries(dependencies)) {
        const name = entry[0];
        let value = entry[1];

        // Check if internal package.
        const dependencyPackage = workspace.packages.find(
          (pkg) => pkg.name === name
        )!;
        if (!dependencyPackage) {
          continue;
        }

        // Extract range from workspace protocol.
        const isWorkspaceProtocol = value.startsWith("workspace:");
        if (isWorkspaceProtocol) {
          value = value.slice("workspace:".length);

          if (["*", "^", "~"].includes(value)) {
            continue;
          }
        }

        // Unknown protocol.
        if (value.includes(":")) {
          continue;
        }

        if (option(options, "onlyWorkspaceProtocol") && !isWorkspaceProtocol) {
          continue;
        }

        const range = new Range(value);

        /** If the range allows any major bump. */
        const allowAnyMajor = range.range === "";

        /** If the range consists souly of a version. */
        const onlyVersion = isVersion(range.raw);

        /** If the range consists of a version and optionally a comparator. */
        const isSimple = onlyVersion || /$[*^~]/.test(range.raw);

        /** If the range is too complex to understand. */
        const isComplex = !isSimple;

        const comparator = isSimple ? range.raw.charAt(0) : undefined;
        const protocol = isWorkspaceProtocol ? "workspace:" : "";

        /** The version specified in the range. */
        const version = onlyVersion
          ? new SemVer(range.raw)
          : isSimple
            ? new SemVer(range.raw.slice(1))
            : undefined;

        /** Wether range allows pre-release(s) or not. */
        const allowsPreRelease = version ? isPreRelease(version) : undefined;

        if (isPreRelease(dependencyPackage.version)) {
          if (allowsPreRelease || option(options, "updateStableToPreRelease")) {
            dependencies[name] = protocol + dependencyPackage.version;
          }
        } else {
          if (allowAnyMajor) {
            continue;
          }

          if (allowsPreRelease) {
            if (!option(options, "ignoreOutdatedPreRelease")) {
              logger.warn(
                `In '${relative(process.cwd(), packageJsonPath)}', dependency "${name}" is set to a pre-release, even though a newer stable version is available.`
              );
            }
            continue;
          }

          if (isComplex && !option(options, "overrideComplexRange")) {
            continue;
          }

          dependencies[name] =
            protocol + comparator + dependencyPackage.version;
        }
      }
    }

    await writeJsoncFile(packageJsonPath, packageJson);
  }

  if (updates.length > 0) {
    logger.info(
      chalk.underline("Updated versions:") + "\n" + renderVersioning(updates)
    );
  } else {
    logger.info("No updates were made!");
  }
}
