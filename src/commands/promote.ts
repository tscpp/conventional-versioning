import { declareCommand } from "../cli.js";
import { Config } from "../utils/config.js";
import isTTY from "../utils/is-tty.js";
import logger from "../utils/logger.js";
import { renderList } from "../utils/tui.js";
import { toBump } from "../utils/version.js";
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
        override: {
          type: "boolean",
          default: false,
        },
      }),
  handler: async (args) => {
    const config = await Config.read(args.config);
    const workspace = await getWorkspace({
      directory: args.workspaceDir,
      config,
    });

    let filter: string[];
    if (args.pkgs.length > 0) {
      filter = args.pkgs;
    } else if (args.ci || !isTTY) {
      throw await logger.fatal("Provide one or more packages to be promoted.");
    } else {
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
              value: "*",
              choices: workspace.packages.map((pkg) => ({
                type: "choice",
                name: pkg.name,
                value: pkg.name,
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
      filter = workspace.packages.map((pkg) => pkg.name);
    }

    if (filter.length === 0) {
      throw await logger.fatal("No packages are available for promotion.");
    }

    const packages = workspace.packages.filter((pkg) =>
      filter.includes(pkg.name),
    );

    let bumpText: string;
    if (args.bump) {
      bumpText = args.bump;
    } else if (args.ci || !isTTY) {
      throw await logger.fatal(
        "Provide the '--bump' flag with a valid version bump.",
      );
    } else {
      bumpText = (
        await enquirer.prompt<{
          bump: string;
        }>({
          name: "bump",
          type: "select",
          message: "What bump?",
          choices: [{ name: "patch" }, { name: "minor" }, { name: "major" }],
        })
      ).bump;
    }
    const bump = toBump(bumpText);

    const conflicts: string[] = [];
    const updated: string[] = [];

    for (const pkg of packages) {
      const current = config.getPromotion(pkg.name);

      if (args.override || bump > current) {
        config.setPromotion(pkg.name, bump);
        updated.push(pkg.name);
      } else {
        conflicts.push(pkg.name);
      }
    }

    if (conflicts.length > 0) {
      await logger.warn(
        "Following packages already have an equal or greater promotion:\n" +
          renderList(conflicts),
      );
    }

    if (updated.length > 0) {
      await logger.warn(
        `Following packages recieved '${bumpText}' promotion:\n` +
          renderList(updated),
      );
    } else {
      await logger.warn("No changes!");
    }

    if (!args.dryRun) {
      await config.save();
    }
  },
});
