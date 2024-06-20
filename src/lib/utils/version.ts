import { SemVer } from "semver";

export function isPreRelease(version: string | SemVer) {
  version = new SemVer(version);
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

export function incrementPreRelease(version: SemVer) {
  version.prerelease = version.prerelease.map((id) =>
    typeof id === "number" ? id + 1 : id
  );
}

export function resetPreRelease(version: SemVer, number: number) {
  version.prerelease = version.prerelease.map((id) =>
    typeof id === "number" ? number : id
  );
}
