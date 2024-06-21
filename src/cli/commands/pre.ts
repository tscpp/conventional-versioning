import { SemVer } from "semver";
import { declareCommand } from "../cli.js";
import enquirer from "enquirer";
import isTTY from "../../lib/utils/is-tty.js";
import { logger } from "../../lib/logger.js";
import { isPreRelease } from "../../lib/utils/version.js";
import { getWorkspace } from "../../lib/workspace.js";
import { join } from "node:path";
import { option } from "../../lib/utils/option.js";
import { modifyJsoncFile, readJsoncFile } from "../../lib/utils/jsonc.js";
import { Options } from "../../lib/options.js";

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
          const options = (await readJsoncFile(args.config)) as Options;
          const workspace = await getWorkspace(options);

          const available = workspace.packages.filter(
            (pkg) => !isPreRelease(pkg.version),
          );

          let filter: string[];
          if (args.pkgs.length > 0) {
            filter = args.pkgs;
          } else if (workspace.packages.length === 1) {
            filter = ["*"];
          } else if (args.ci || !isTTY) {
            throw logger.fatal(
              "Provide one or more packages to be pre-released.",
            );
          } else {
            if (available.length === 0) {
              throw logger.fatal("No packages are available for pre-release.");
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
            throw logger.fatal("No packages are available for pre-release.");
          }

          let id: string;
          if (args.id) {
            id = args.id;
          } else if (args.ci || !isTTY) {
            throw logger.fatal(
              "You must provide a pre-release identifier using the '--id' flag.",
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
            throw logger.fatal(
              "You must provide a tag using the '--tag' flag.",
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
            filter.includes(pkg.name),
          );

          for (const pkg of packages) {
            if (!args.dry) {
              await modifyJsoncFile(configPath, [
                {
                  path: ["preReleases", pkg.name],
                  value: pkg.version,
                },
              ]);
            }

            const newVersion = new SemVer(pkg.version);
            newVersion.prerelease = [id, option(options, "initialPreRelease")];

            if (!args.dry) {
              await modifyJsoncFile(join(pkg.path, "package.json"), [
                {
                  path: ["version"],
                  value: newVersion.format(),
                },
                {
                  path: ["publishConfig", "tag"],
                  value: tag,
                },
              ]);
            }
          }

          logger.warn(
            `Added ${packages.length} package(s) to pre-release on the next versioning.`,
          );
        },
      )
      .command(
        "exit",
        "Exit prerelease.",
        (cli) => cli,
        async (args) => {
          const configPath = args.config;
          const options = (await readJsoncFile(configPath)) as Options;
          const workspace = await getWorkspace(options);

          const available = workspace.packages.filter((pkg) =>
            isPreRelease(pkg.version),
          );

          let filter: string[];
          if (args.pkgs.length > 0) {
            filter = args.pkgs;
          } else if (args.ci || !isTTY) {
            throw logger.fatal(
              "Provide one or more packages to exit pre-release.",
            );
          } else {
            if (available.length === 0) {
              throw logger.fatal("No packages are configured to pre-release.");
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
            throw logger.fatal("No packages are configured to pre-release.");
          }

          const packages = workspace.packages.filter((pkg) =>
            filter.includes(pkg.name),
          );

          for (const pkg of packages) {
            const originalVersion = option(options, "preReleases")[pkg.name];

            const currentVersion = new SemVer(pkg.version);
            currentVersion.prerelease = [];

            // If the below condition is true, that means the version has not
            // been bumped since pre-released was enabled, meaning that we
            // safely revert the version to the original (stable) version.
            if (originalVersion === currentVersion.format()) {
              if (!args.dry) {
                await modifyJsoncFile(join(pkg.path, "package.json"), [
                  {
                    path: ["version"],
                    value: originalVersion,
                  },
                  {
                    path: ["publishConfig", "tag"],
                    value: undefined,
                  },
                ]);
              }
            }

            if (!args.dry) {
              await modifyJsoncFile(configPath, [
                {
                  path: ["preRelease", pkg.name],
                  value: undefined,
                },
              ]);
            }
          }

          logger.info(
            `Removed ${packages.length} package(s) from pre-release on the next versioning.`,
          );
        },
      ),
  handler: undefined!,
});
