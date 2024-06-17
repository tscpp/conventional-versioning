import { SemVer } from "semver";
import { declareCommand } from "../cli.js";
import logger from "../utils/logger.js";
import { isPreRelease } from "../utils/version.js";
import { getWorkspace, savePackageConfig } from "../utils/workspace.js";
import enquirer from "enquirer";
import isTTY from "../utils/is-tty.js";
import { Config } from "../utils/config.js";

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
          const config = await Config.read(configPath);
          const workspace = await getWorkspace(args.workspaceDir);

          const available = workspace.packages.filter(
            (pkg) => !isPreRelease(pkg.version)
          );

          let filter: string[];
          if (args.pkgs.length > 0) {
            filter = args.pkgs;
          } else if (args.ci || !isTTY) {
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
                /* eslint-disable */
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
                /* eslint-enable */
              })
            ).filter;

            if (filter.length === 0) {
              return;
            }

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
          } else if (args.ci || !isTTY) {
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
          } else if (args.ci || !isTTY) {
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

          for (const pkg of packages) {
            config.setPreRelease(pkg.name, true);

            if (!config.hasOriginalVersion(pkg.name)) {
              config.setOriginalVersion(pkg.name, pkg.version.format());
            }

            pkg.version.prerelease = [
              id,
              config.options.initialPreReleaseVersion,
            ];
            pkg.config.version = pkg.version.format();
            pkg.config.publishConfig ??= {};
            pkg.config.publishConfig.tag = tag;

            if (!args.dryRun) {
              await savePackageConfig(pkg);
            }
          }

          if (!args.dryRun) {
            await config.save();
          }

          await logger.warn(
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
          const config = await Config.read(configPath);
          const workspace = await getWorkspace(args.workspaceDir);

          const available = workspace.packages.filter((pkg) =>
            isPreRelease(pkg.version)
          );

          let filter: string[];
          if (args.pkgs.length > 0) {
            filter = args.pkgs;
          } else if (args.ci || !isTTY) {
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
                /* eslint-disable */
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
                /* eslint-enable */
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
            const originalVersion = config.getOriginalVersion(pkg.name);

            const currentVersion = new SemVer(pkg.version);
            currentVersion.prerelease = [];

            // If the below condition is true, that means the version has not
            // been bumped since pre-released was enabled, meaning that we
            // safely revert the version to the original (stable) version.
            if (originalVersion === currentVersion.format()) {
              pkg.version = currentVersion;
              pkg.config.version = pkg.version.format();
            }

            config.setPreRelease(pkg.name, false);
            config.setOriginalVersion(pkg.name, undefined);

            // Remove tag from publishConfig.
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
            await config.save();
          }

          await logger.info(
            `Removed ${packages.length} package(s) from pre-release on the next versioning.`
          );
        }
      ),
  handler: undefined!,
});
