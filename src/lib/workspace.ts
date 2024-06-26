import { getPackages } from "@manypkg/get-packages";
import { Options } from "./options.js";
import { option } from "./utils/option.js";
import escapeStringRegexp from "escape-string-regexp";
import { DEPENDENCY_KEYS } from "./utils/dependencies.js";
import logger from "./logger.js";

export interface Workspace {
  path: string;
  packages: Package[];
}

export interface Package {
  name: string;
  version: string;
  path: string;
  dependencies: Dependency[];
}

export interface Dependency {
  name: string;
  version: string;
  isPeer: boolean;
}

export async function getWorkspace(options?: Options): Promise<Workspace> {
  logger.debug("Getting packages in workspace.");

  const manypkg = await getPackages(option(options, "workspaceRoot"));

  const include = option(options, "include").map(packagePatternToRegExp);
  const exclude = option(options, "exclude").map(packagePatternToRegExp);

  const packages = manypkg.packages
    .filter(
      (pkg) => !pkg.packageJson.private || option(options, "includePrivate"),
    )
    .map(
      (pkg): Package => ({
        name: pkg.packageJson.name,
        version: pkg.packageJson.version,
        path: pkg.dir,
        dependencies: DEPENDENCY_KEYS.flatMap((key) =>
          Object.entries(pkg.packageJson[key] ?? {}).map(
            ([name, version]): Dependency => ({
              name,
              version,
              isPeer: key === "peerDependencies",
            }),
          ),
        ),
      }),
    )
    .filter(
      (pkg) =>
        (!include.length || include.some((regex) => regex.test(pkg.name))) &&
        exclude.every((regex) => !regex.test(pkg.name)),
    );

  logger.debug(
    `Found ${manypkg.packages.length} packages in workspace, but only ${manypkg.packages.length} were included.`,
  );

  return {
    path: manypkg.rootDir,
    packages,
  };
}

export function packagePatternToRegExp(pattern: string) {
  return new RegExp(
    "^" + escapeStringRegexp(pattern).replaceAll("\\*", ".+") + "$",
  );
}
