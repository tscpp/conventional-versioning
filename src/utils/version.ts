import { ReleaseType, SemVer } from "semver";
import { Workspace, WorkspacePackage } from "./workspace.js";
import { DEPENDENCY_KEYS, hasDependency } from "./dependency.js";
import { Commit } from "./commit.js";
import { Config, patternToRegex } from "./config.js";
import logger from "./logger.js";
import { containsPath } from "./misc.js";
import { renderList } from "./tui.js";

export enum Bump {
  None,
  Patch,
  Minor,
  Major,
}

export function formatBump(bump: Bump): string {
  switch (bump) {
    case Bump.None:
      return "none";

    case Bump.Patch:
      return "patch";

    case Bump.Minor:
      return "minor";

    case Bump.Major:
      return "major";
  }
}

export function formatBumpOrUndefined(bump: Bump): string | undefined {
  switch (bump) {
    case Bump.None:
      return undefined;

    case Bump.Patch:
      return "patch";

    case Bump.Minor:
      return "minor";

    case Bump.Major:
      return "major";
  }
}

export function toBump(value: string | Bump): Bump {
  switch (value) {
    case "patch":
    case "fix":
      return Bump.Patch;

    case "minor":
    case "feat":
      return Bump.Minor;

    case "major":
    case "breaking":
      return Bump.Major;

    case "ignore":
    case "none":
    default:
      return Bump.None;
  }
}

export function toReleaseType(
  bump: Bump,
  skipMajor: boolean
): ReleaseType | null {
  if (skipMajor) {
    bump = Math.min(bump, Bump.Minor);
  }

  switch (bump) {
    case Bump.Patch:
      return "patch";
    case Bump.Minor:
      return "minor";
    case Bump.Major:
      return "major";
    default:
      return null;
  }
}

export function isPreRelease(version: SemVer) {
  return version.prerelease.length > 0;
}

export function isVersion(string: string) {
  try {
    new SemVer(string);
    return true;
  } catch {
    return false;
  }
}

export function getPreReleaseIdentifier(version: SemVer) {
  const id = version.prerelease[0];
  return typeof id === "string" ? id : undefined;
}

export function incrementPreRelease(version: SemVer) {
  const nth = version.prerelease.at(-1);
  if (typeof nth === "number") {
    version.prerelease = [...version.prerelease.slice(0, -1), nth + 1];
  }
}

export function resetPreRelease(version: SemVer, sequence: number) {
  if (typeof version.prerelease.at(-1) === "number") {
    version.prerelease = [...version.prerelease.slice(0, -1), sequence];
  }
}

export interface Versioning {
  name: string;
  oldVersion: string;
  newVersion: string;
  bump: Bump;
}

export async function createVersioningPlan({
  workspace,
  commits,
  config,
  includeUnchanged = false,
}: {
  workspace: Workspace;
  commits: Commit[];
  config: Config;
  includeUnchanged?: boolean;
}): Promise<Versioning[]> {
  const bumps = new Map<WorkspacePackage, Bump>();

  for (const pkg of workspace.packages) {
    const inferred = await inferBumpFromCommits({
      commits,
      config,
      package: pkg,
    });
    const promotion = config.getPromotion(pkg.name);
    config.setPromotion(pkg.name, Bump.None);
    const bump = Math.max(inferred, promotion);
    bumps.set(pkg, bump);
  }

  const sortedPackages = workspace.packages
    .slice()
    .sort((a, b) => (hasDependency(a, b.name) ? 1 : -1));

  let repeat = false;
  // TODO: This is somewhat of a hack. We repeat this until no more changes can
  // be done.
  do {
    for (const ourPackage of sortedPackages) {
      // Check if we need to update any internal dependencies used in the
      // workspace packages.
      for (const dependencyKey of DEPENDENCY_KEYS) {
        const dependencies = ourPackage.config[dependencyKey];
        if (!dependencies) continue;

        const ourBump = bumps.get(ourPackage)!;

        for (const name of Object.keys(dependencies)) {
          const theirPackage = workspace.packages.find(
            (pkg) => pkg.name === name
          )!;
          const theirBump = bumps.get(theirPackage)!;

          // Minor bumps in peer dependencies causes major bump in parent package.
          // https://github.com/tscpp/conventional-versioning/discussions/2
          if (
            dependencyKey === "peerDependencies" &&
            theirBump >= Bump.Minor &&
            ourBump < Bump.Major
          ) {
            bumps.set(ourPackage, Bump.Major);
            repeat = true;
          }

          // Any bump in a dependency causes a patch bump in the parent package.
          if (theirBump >= Bump.Patch && ourBump < Bump.Patch) {
            bumps.set(ourPackage, Bump.Patch);
            repeat = true;
          }
        }
      }
    }

    // Check for any linked/fixed relations between workspace packages.
    for (const type of ["linked", "fixed"] as const) {
      const relations = config.options[type];

      for (const patterns of relations) {
        const included = patterns.flatMap((pattern) =>
          workspace.packages.filter((pkg) =>
            patternToRegex(pattern).test(pkg.name)
          )
        );

        if (included.length === 0) {
          await logger.warn(
            `Following patterns specified in the "${type}" option matches no packages:\n` +
              renderList(patterns)
          );
        }

        const stablePkgs = included.filter((pkg) => !isPreRelease(pkg.version));
        const prePkgs = included.filter((pkg) => isPreRelease(pkg.version));

        const greatestStable = stablePkgs
          .map((pkg) => pkg.version)
          .reduce((a, b) => (a.compare(b) >= 0 ? a : b));
        const greatestPre = prePkgs
          .map((pkg) => pkg.version)
          .reduce((a, b) => (a.compare(b) >= 0 ? a : b));

        for (const pkg of included) {
          // Stable versions set the minimum for both stable and pre-release
          // versions, while pre-release versions only set the minimum for
          // pre-release versions. Meaning that stable versions can bump both
          // as stable and pre-release siblings, while pre-releases only can
          // bump other pre-release siblings.

          const greatest = isPreRelease(pkg.version)
            ? greatestPre
            : greatestStable;

          if (greatest.major > pkg.version.major) {
            pkg.version.inc("major");
            repeat = true;
          } else if (greatest.minor > pkg.version.minor) {
            pkg.version.inc("minor");
            repeat = true;
          } else if (greatest.patch > pkg.version.patch && type === "fixed") {
            pkg.version.inc("patch");
            repeat = true;
          }
        }
      }
    }
  } while (repeat);

  const versioning: Versioning[] = [];

  for (const [pkg, bump] of bumps) {
    if (bump === Bump.None && !includeUnchanged) {
      continue;
    }

    const skipMajor = config.getPromotion(pkg.name) !== Bump.Major;

    let originalVersion = isPreRelease(pkg.version)
      ? config.getOriginalVersion(pkg.name)
      : pkg.version;
    if (!originalVersion) {
      // This should be already caught. Just to be safe.
      throw await logger.fatal(
        `Original version for pre-release package '${pkg.name}' is not configured.`
      );
    }
    originalVersion = new SemVer(originalVersion);

    const currentVersion = new SemVer(pkg.version.format());
    let newVersion = currentVersion;

    const releaseType = toReleaseType(bump, skipMajor);
    if (releaseType) {
      newVersion = originalVersion.inc(releaseType);
      newVersion.prerelease = currentVersion.prerelease;

      if (isPreRelease(currentVersion)) {
        const noMainBump = currentVersion.compareMain(newVersion) >= 0;
        if (noMainBump) {
          newVersion = new SemVer(currentVersion.format());
        }

        if (noMainBump || config.options.preservePreRelaseSequence) {
          incrementPreRelease(newVersion);
        } else {
          resetPreRelease(newVersion, config.options.initialPreReleaseVersion);
        }
      }

      await logger.debug(
        `Increment package '${
          pkg.name
        }' version '${currentVersion.format()}' with '${releaseType}' results in '${newVersion.format()}'.`
      );
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

async function inferBumpFromCommits({
  commits,
  config,
  package: pkg,
}: {
  commits: Commit[];
  config: Config;
  package: WorkspacePackage;
}) {
  let bump = Bump.None;

  for (const detail of commits) {
    if (!detail.cc.type) {
      continue;
    }

    const affected = commits
      .flatMap((commit) => commit.diff)
      .some((status) => containsPath(pkg.dir, status.filename));

    if (!affected) {
      continue;
    }

    const bumpLike = config.options.releaseTypes[detail.cc.type];
    if (!bumpLike) {
      await logger.warn(
        `Did not recognize CC commit type "${detail.cc.type}". Add it to the 'bump' record in the config.`
      );
    }

    const currentBump = toBump(bumpLike ?? "ignore");
    bump = Math.max(bump, currentBump);
  }

  return bump;
}
