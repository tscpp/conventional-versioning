import { ReleaseType, SemVer } from "semver";
import { Workspace, WorkspacePackage } from "./workspace.js";
import { DEPENDENCY_KEYS, hasDependency } from "./dependency.js";
import { Commit } from "./commit.js";
import { Config } from "./config.js";
import logger from "./logger.js";
import { containsPath } from "./misc.js";

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

  let changes = false;
  do {
    for (const ourPackage of sortedPackages) {
      for (const dependencyKey of DEPENDENCY_KEYS) {
        const dependencies = ourPackage.config[dependencyKey];
        if (!dependencies) continue;

        const ourBump = bumps.get(ourPackage)!;

        for (const name of Object.keys(dependencies)) {
          const theirPackage = workspace.packages.find(
            (pkg) => pkg.name === name
          )!;
          const theirBump = bumps.get(theirPackage)!;

          if (
            dependencyKey === "peerDependencies" &&
            theirBump >= Bump.Minor &&
            ourBump < Bump.Major
          ) {
            bumps.set(ourPackage, Bump.Major);
            changes = true;
          }

          if (theirBump >= Bump.Patch && ourBump < Bump.Patch) {
            bumps.set(ourPackage, Bump.Patch);
            changes = true;
          }
        }
      }
    }
  } while (changes);

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
