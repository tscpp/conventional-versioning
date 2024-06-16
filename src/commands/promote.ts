import { declareCommand } from "../cli.js";
import { readConfig, writeConfig } from "../utils/config.js";
import logger from "../utils/logger.js";
import { formatBump, toBump } from "../utils/version.js";
import { getWorkspace } from "../utils/workspace.js";
import enquirer from "enquirer";

export default declareCommand({
  command: ["promote [pkgs...]"],
  describe: "Promote a major bump to a package on the next versioning",
  builder: (cli) =>
    cli
      .positional("pkgs", {
        type: "string",
        array: true,
        default: [] as string[],
      })
      .options({
        bump: {
          type: "string",
        },
      }),
  handler: async (args) => {
    const config = await readConfig(args.config);
    const workspace = await getWorkspace(args.workspaceDir);

    let filter: string[];
    if (args.pkgs.length > 0) {
      filter = args.pkgs;
    } else if (args.ci) {
      throw await logger.fatal("Provide one or more packages to be promoted.");
    } else {
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
              value: "*",
              choices: workspace.packages.map((pkg) => ({
                type: "choice",
                name: pkg.name,
                value: pkg.name,
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
      filter = workspace.packages.map((pkg) => pkg.name);
    }

    if (filter.length === 0) {
      throw await logger.fatal("No packages are available for promotion.");
    }

    const packages = workspace.packages.filter((pkg) =>
      filter.includes(pkg.name)
    );

    let bumpText: string;
    if (args.bump) {
      bumpText = args.bump;
    } else if (args.ci) {
      throw await logger.fatal(
        "Provide the '--bump' flag with a valid version bump."
      );
    } else {
      bumpText = (
        await enquirer.prompt<{
          bump: string;
        }>({
          name: "bump",
          type: "list",
          message: "What bump?",
          choices: [{ name: "patch" }, { name: "minor" }, { name: "major" }],
        })
      ).bump;
    }
    const bump = toBump(bumpText);

    config.pre ??= {};
    config.pre.promote ??= {};

    for (const pkg of packages) {
      const current = toBump(config.pre.promote[pkg.name] ?? "none");

      if (bump > current) {
        config.pre.promote[pkg.name] = formatBump(bump);
      }
    }

    if (!args.dryRun) {
      await writeConfig(args.config, config);
    }

    logger.warn(
      `Added ${packages.length} package(s) for major promotion on the next versioning.`
    );
  },
});
