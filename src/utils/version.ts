import { ReleaseType, SemVer } from "semver";

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

export function toBump(value: string): Bump {
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
  skipMajor: boolean,
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
