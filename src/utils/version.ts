import { ReleaseType, SemVer } from "semver";
import { Workspace } from "./workspace.js";
import { DEPENDENCY_KEYS, hasDependency } from "./dependency.js";
import { Commit } from "./commit.js";
import { Config } from "./config.js";
import logger from "./logger.js";

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
  const pkgBumpMap = new Map<string, Bump>();

  // Sort by workspace dependencies
  workspace.packages = workspace.packages
    .slice()
    .sort((a, b) => (hasDependency(a, b.name) ? 1 : -1));

  for (const pkg of workspace.packages) {
    let bump = Bump.None;

    for (const detail of commits) {
      if (!detail.cc.type) {
        continue;
      }

      const bumpLike = config.options.releaseTypes[detail.cc.type];
      if (!bumpLike) {
        await logger.warn(
          `Did not recognize CC commit type "${detail.cc.type}". Add it to the 'bump' record in the config.`
        );
      }

      const currentBump = toBump(bumpLike ?? "ignore");
      if (currentBump > bump) {
        bump = currentBump;
      }
    }

    for (const dependencyKey of DEPENDENCY_KEYS) {
      const dependencies = pkg.config[dependencyKey];
      if (!dependencies) {
        continue;
      }

      for (const name of Object.keys(dependencies)) {
        // Check if internal package.
        const pkg = workspace.packages.find((pkg) => pkg.name === name)!;
        if (!pkg) {
          continue;
        }

        const theirBump = pkgBumpMap.get(name);
        if (!theirBump) {
          continue;
        }

        if (dependencyKey === "peerDependencies" && theirBump >= Bump.Minor) {
          bump = Bump.Major;
        }

        if (theirBump >= Bump.Patch) {
          bump = Math.max(bump, Bump.Patch);
        }
      }
    }

    pkgBumpMap.set(pkg.name, bump);
  }

  const updates: Versioning[] = [];

  for (const pkg of workspace.packages) {
    let bump = pkgBumpMap.get(pkg.name) ?? Bump.None;

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

    let skipMajor = originalVersion.major === 0;

    const promotion = config.getPromotion(pkg.name);
    if (promotion > Bump.None) {
      skipMajor = false;
      bump = promotion;
      config.setPromotion(pkg.name, Bump.None);
    }

    const releaseType = toReleaseType(bump, skipMajor);
    if (releaseType) {
      const currentVersion = new SemVer(pkg.version.format());
      const newVersion = originalVersion.inc(releaseType);

      if (isPreRelease(currentVersion)) {
        newVersion.prerelease = currentVersion.prerelease;
      }

      const equalStableVersion =
        currentVersion.patch === newVersion.patch &&
        currentVersion.minor === newVersion.minor &&
        currentVersion.major === newVersion.major;

      if (equalStableVersion || config.options.preservePreRelaseSequence) {
        incrementPreRelease(newVersion);
      } else {
        resetPreRelease(newVersion, config.options.initialPreReleaseVersion);
      }

      await logger.debug(
        `Increment package '${
          pkg.name
        }' version '${currentVersion.format()}' with '${releaseType}' results in '${newVersion.format()}'.`
      );

      // Push update
      updates.push({
        name: pkg.name,
        oldVersion: currentVersion.format(),
        newVersion: newVersion.format(),
        bump,
      });
    } else if (includeUnchanged) {
      updates.push({
        name: pkg.name,
        oldVersion: pkg.version.format(),
        newVersion: pkg.version.format(),
        bump,
      });
    }
  }

  return updates;
}
