import { describe, expect, it } from "@jest/globals";
import {
  incrementPreRelease,
  isPreRelease,
  isVersion,
  resetPreRelease,
} from "./version.js";
import { SemVer } from "semver";

describe("isPreRelease", () => {
  it("returns true for pre-release", () => {
    const value = isPreRelease("1.0.0-rc.1");
    expect(value).toBe(true);
  });

  it("returns false for stable version", () => {
    const value = isPreRelease("0.1.0");
    expect(value).toBe(false);
  });

  it("works with SemVer class", () => {
    const version = new SemVer("1.2.3");
    const value = isPreRelease(version);
    expect(value).toBe(false);
  });
});

describe("isVersion", () => {
  it("returns true for valid version", () => {
    const value = isVersion("1.2.3");
    expect(value).toBe(true);
  });

  it("returns false for invalid version", () => {
    const value = isVersion("1.2.3.");
    expect(value).toBe(false);
  });
});

describe("incrementPreRelease", () => {
  it("increments pre-release", () => {
    const version = new SemVer("1.2.3-rc.0");
    incrementPreRelease(version);
    expect(version.prerelease).toEqual(["rc", 1]);
  });

  it("increments multiple pre-releases", () => {
    const version = new SemVer("1.2.3-rc.1.beta.2");
    incrementPreRelease(version);
    expect(version.prerelease).toEqual(["rc", 2, "beta", 3]);
  });

  it("works when not pre-release", () => {
    const version = new SemVer("1.2.3");
    incrementPreRelease(version);
    expect(version.prerelease).toEqual([]);
  });
});

describe("resetPreRelease", () => {
  it("resets pre-release", () => {
    const version = new SemVer("1.2.3-rc.2");
    resetPreRelease(version, 0);
    expect(version.prerelease).toEqual(["rc", 0]);
  });

  it("resets multiple pre-releases", () => {
    const version = new SemVer("1.2.3-rc.1.beta.2");
    resetPreRelease(version, 0);
    expect(version.prerelease).toEqual(["rc", 0, "beta", 0]);
  });

  it("works when not pre-release", () => {
    const version = new SemVer("1.2.3");
    resetPreRelease(version, 0);
    expect(version.prerelease).toEqual([]);
  });
});
