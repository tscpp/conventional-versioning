import { SemVer } from "semver";
import { declareCommand } from "../cli.js";
import { normalizeOptions, readConfig, writeConfig } from "../utils/config.js";
import logger from "../utils/logger.js";
import { spliceValueFromArray } from "../utils/misc.js";
import { isPreRelease } from "../utils/version.js";
import { getWorkspace, savePackageConfig } from "../utils/workspace.js";
import enquirer from "enquirer";

export default declareCommand({
  command: ["pre <enter|exit> [pkgs...]"],
  describe: "Enter or exit prerelease.",
  builder: (cli) =>
    cli
      .positional("pkgs", {
        type: "string",
        array: true,
        default: [],
      })
      .command(
        "enter",
        "Enter prerelease.",
        (cli) =>
          cli.options({
            id: {
              type: "string",
              alias: ["i"],
            },
            tag: {
              type: "string",
              alias: ["t", "dist-tag"],
            },
          }),
        async (args) => {
          const configPath = args.config;
          const config = await readConfig(configPath);
          const options = normalizeOptions(config.options);
          const workspace = await getWorkspace(args.workspaceDir);

          const available = workspace.packages.filter(
            (pkg) => !isPreRelease(pkg.version)
          );

          let filter: string[];
          if (args.pkgs.length > 0) {
            filter = args.pkgs;
          } else if (args.ci) {
            throw await logger.fatal(
              "Provide one or more packages to be pre-released."
            );
          } else {
            if (available.length === 0) {
              throw await logger.fatal(
                "No packages are available for pre-release."
              );
            }

            filter = (
              await enquirer.prompt<{
                filter: string[];
              }>({
                name: "filter",
                type: "multiselect",
                message: "What packages?",
                choices: [
                  {
                    name: "All packages",
                    choices: workspace.packages.map((pkg) => ({
                      type: "choice",
                      name: pkg.name,
                      value: pkg.name,
                      disabled: isPreRelease(pkg.version),
                    })),
                  } as any,
                ],
              })
            ).filter;

            if (filter.includes("All packages")) {
              filter = ["*"];
            }
          }

          if (filter.includes("*")) {
            filter = available.map((pkg) => pkg.name);
          }

          if (filter.length === 0) {
            throw await logger.fatal(
              "No packages are available for pre-release."
            );
          }

          let id: string;
          if (args.id) {
            id = args.id;
          } else if (args.ci) {
            throw await logger.fatal(
              "You must provide a pre-release identifier using the '--id' flag."
            );
          } else {
            id = (
              await enquirer.prompt<{ id: string }>({
                name: "id",
                type: "input",
                message: "What pre-release identifier?",
              })
            ).id;
          }

          let tag: string;
          if (args.tag) {
            tag = args.tag;
          } else if (args.ci) {
            throw await logger.fatal(
              "You must provide a tag using the '--tag' flag."
            );
          } else {
            tag = (
              await enquirer.prompt<{ tag: string }>({
                name: "tag",
                type: "input",
                message: "What dist tag?",
              })
            ).tag;
          }

          const packages = workspace.packages.filter((pkg) =>
            filter.includes(pkg.name)
          );

          config.pre ??= {};
          config.pre.prerelease ??= [];
          config.pre.original ??= {};

          for (const pkg of packages) {
            if (!config.pre.prerelease.includes(pkg.name)) {
              config.pre.prerelease.push(pkg.name);
            }

            if (!Object.hasOwn(config.pre.original, pkg.name)) {
              config.pre.original[pkg.name] = pkg.version.format();
            }

            pkg.version.prerelease = [id, options.initialPreReleaseVersion];
            pkg.config.version = pkg.version.format();
            pkg.config.publishConfig ??= {};
            pkg.config.publishConfig.tag = tag;

            if (!args.dryRun) {
              await savePackageConfig(pkg);
            }
          }

          if (!args.dryRun) {
            await writeConfig(configPath, config);
          }

          logger.warn(
            `Added ${packages.length} package(s) to pre-release on the next versioning.`
          );
        }
      )
      .command(
        "exit",
        "Exit prerelease.",
        (cli) => cli,
        async (args) => {
          const configPath = args.config;
          const config = await readConfig(configPath);
          const workspace = await getWorkspace(args.workspaceDir);

          const available = workspace.packages.filter((pkg) =>
            isPreRelease(pkg.version)
          );

          let filter: string[];
          if (args.pkgs.length > 0) {
            filter = args.pkgs;
          } else if (args.ci) {
            throw await logger.fatal(
              "Provide one or more packages to exit pre-release."
            );
          } else {
            if (available.length === 0) {
              throw await logger.fatal(
                "No packages are configured to pre-release."
              );
            }

            filter = (
              await enquirer.prompt<{
                filter: string[];
              }>({
                name: "filter",
                type: "multiselect",
                message: "What packages?",
                choices: [
                  {
                    name: "All packages",
                    choices: workspace.packages.map((pkg) => ({
                      type: "choice",
                      name: pkg.name,
                      value: pkg.name,
                      disabled: !isPreRelease(pkg.version),
                    })),
                  } as any,
                ],
              })
            ).filter;

            if (filter.includes("All packages")) {
              filter = ["*"];
            }
          }

          if (filter.includes("*")) {
            filter = available.map((pkg) => pkg.name);
          }

          if (filter.length === 0) {
            throw await logger.fatal(
              "No packages are configured to pre-release."
            );
          }

          const packages = workspace.packages.filter((pkg) =>
            filter.includes(pkg.name)
          );

          for (const pkg of packages) {
            if (config.pre?.prerelease) {
              spliceValueFromArray(config.pre.prerelease, pkg.name);
            }

            const originalVersion = config.pre?.original?.[pkg.name];
            if (originalVersion) {
              delete config.pre!.original![pkg.name];
            }

            const index = config.pre?.prerelease?.indexOf(pkg.name);
            if (index !== undefined && index !== -1) {
              config.pre!.prerelease!.splice(index, 1);
            }

            const withoutSuffix = new SemVer(pkg.version);
            withoutSuffix.prerelease = [];
            if (originalVersion === withoutSuffix.format()) {
              pkg.version = withoutSuffix;
              pkg.config.version = pkg.version.format();
            }

            if (pkg.config.publishConfig) {
              delete pkg.config.publishConfig.tag;

              if (Object.entries(pkg.config.publishConfig).length === 0) {
                delete pkg.config.publishConfig;
              }
            }

            if (!args.dryRun) {
              await savePackageConfig(pkg);
            }
          }

          if (!args.dryRun) {
            await writeConfig(configPath, config);
          }

          logger.info(
            `Removed ${packages.length} package(s) from pre-release on the next versioning.`
          );
        }
      ),
  handler: undefined!,
});
