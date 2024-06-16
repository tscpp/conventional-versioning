import { getPackages } from "@manypkg/get-packages";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SemVer } from "semver";
import detectIndent from "detect-indent";

export interface WorkspacePackageConfig {
  [key: string]: unknown;
  name: string;
  version: string;
  dependencies?: {
    [key: string]: string;
  };
  peerDependencies?: {
    [key: string]: string;
  };
  devDependencies?: {
    [key: string]: string;
  };
  optionalDependencies?: {
    [key: string]: string;
  };
  private?: boolean;
  publishConfig?: {
    [key: string]: unknown;
    access?: string;
    directory?: string;
    registry?: string;
    tag?: string;
  };
}

export interface WorkspacePackage {
  name: string;
  version: SemVer;
  config: WorkspacePackageConfig;
  configPath: string;
  dir: string;
  relativeDir: string;
}

export interface Workspace {
  packages: WorkspacePackage[];
  rootDir: string;
}

export async function getWorkspace(dir: string): Promise<Workspace> {
  const { packages, rootDir } = await getPackages(dir);

  return {
    packages: packages.map((pkg) => {
      const version = new SemVer(pkg.packageJson.version ?? "0.0.0");

      return {
        name: pkg.packageJson.name,
        version,
        config: pkg.packageJson as WorkspacePackageConfig,
        configPath: join(pkg.dir, "package.json"),
        dir: pkg.dir,
        relativeDir: pkg.relativeDir,
      };
    }),
    rootDir,
  };
}

export async function savePackageConfig(pkg: WorkspacePackage) {
  const text = await readFile(pkg.configPath, "utf-8");
  const indent = text ? detectIndent(text) : undefined;
  await writeFile(
    pkg.configPath,
    JSON.stringify(pkg.config, undefined, indent?.indent ?? 2),
  );
}
