import { declareCommand } from "../cli.js";
import { readConfig, writeConfig } from "../utils/config.js";
import logger from "../utils/logger.js";
import { getWorkspace } from "../utils/workspace.js";
import enquirer from "enquirer";

export default declareCommand({
  command: ["promote [pkgs...]"],
  describe: "Promote a major bump to a package on the next versioning",
  builder: (cli) =>
    cli.positional("pkgs", {
      type: "string",
      array: true,
      default: [] as string[],
    }),
  handler: async (args) => {
    const config = await readConfig(args.config);
    const workspace = await getWorkspace(args.workspaceDir);

    const available = workspace.packages.filter(
      (pkg) => !config.pre?.promote?.includes(pkg.name)
    );

    let filter: string[];
    if (args.pkgs.length > 0) {
      filter = args.pkgs;
    } else if (args.ci) {
      throw await logger.fatal("Provide one or more packages to be promoted.");
    } else {
      if (available.length === 0) {
        throw await logger.fatal("No packages are available for promotion.");
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
              value: "*",
              choices: workspace.packages.map((pkg) => ({
                type: "choice",
                name: pkg.name,
                value: pkg.name,
                disabled: config.pre?.promote?.includes(pkg.name),
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
      throw await logger.fatal("No packages are available for promotion.");
    }

    const duplicates = filter.filter((name) =>
      config.pre?.promote?.includes(name)
    );
    if (duplicates.length > 0) {
      throw await logger.fatal(
        "Packages are already promoted:\n" +
          duplicates.map((name) => "  * " + name).join("\n")
      );
    }

    const packages = workspace.packages.filter((pkg) =>
      filter.includes(pkg.name)
    );

    config.pre ??= {};
    config.pre.promote ??= [];

    for (const pkg of packages) {
      config.pre.promote.push(pkg.name);
    }

    if (!args.dryRun) {
      await writeConfig(args.config, config);
    }

    logger.warn(
      `Added ${packages.length} package(s) for major promotion on the next versioning.`
    );
  },
});
