import { WorkspacePackage } from "./workspace.js";

export const DEPENDENCY_KEYS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export function hasDependency(pkg: WorkspacePackage, name: string) {
  for (const dependencyKey of DEPENDENCY_KEYS) {
    const dependencies = pkg.config[dependencyKey];
    if (dependencies) {
      for (const key of Object.keys(dependencies)) {
        if (key === name) {
          return true;
        }
      }
    }
  }
  return false;
}
