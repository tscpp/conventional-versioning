import isTTY from "../../lib/utils/is-tty.js";
import logger from "../../lib/logger.js";
import { renderList } from "../../lib/utils/tui.js";
import { getWorkspace } from "../../lib/workspace.js";
import { declareCommand } from "../cli.js";
import enquirer from "enquirer";
import { Bump, compareBump } from "../../lib/bump.js";
import { option } from "../../lib/utils/option.js";
import {
  JSONCEdit,
  modifyJsoncFile,
  readJsoncFile,
} from "../../lib/utils/jsonc.js";
import { Options } from "../../lib/options.js";

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
          choices: ["patch", "minor", "major"],
        },
        override: {
          type: "boolean",
          default: false,
        },
      }),
  handler: async (args) => {
    const configPath = args.config;
    const options = (await readJsoncFile(configPath)) as Options;
    const workspace = await getWorkspace(options);

    let filter: string[];
    if (args.pkgs.length > 0) {
      filter = args.pkgs;
    } else if (workspace.packages.length === 1) {
      filter = ["*"];
    } else if (args.ci || !isTTY || args.json) {
      throw logger.fatal("Provide one or more packages to be promoted.");
    } else {
      process.stdout.write("\n");
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
            },
          ] as any,
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
      throw logger.fatal("No packages are available for promotion.");
    }

    const packages = workspace.packages.filter((pkg) =>
      filter.includes(pkg.name),
    );

    let bump: Bump;
    if (args.bump) {
      bump = args.bump as Bump;
    } else if (args.ci || !isTTY || args.json) {
      throw logger.fatal(
        "Provide the '--bump' flag with a valid version bump.",
      );
    } else {
      bump = (
        await enquirer.prompt<{
          bump: Bump;
        }>({
          name: "bump",
          type: "select",
          message: "What bump?",
          choices: [{ name: "patch" }, { name: "minor" }, { name: "major" }],
        })
      ).bump;
      process.stdout.write("\n");
    }

    const conflicts: string[] = [];
    const updated: string[] = [];

    const edits: JSONCEdit[] = [];

    for (const pkg of packages) {
      const current = option(options, "promotions")[pkg.name];

      if (args.override || !current || compareBump(bump, current) > 0) {
        edits.push({
          path: ["promotions", pkg.name],
          value: bump,
        });
        updated.push(pkg.name);
      } else {
        conflicts.push(pkg.name);
      }
    }

    if (conflicts.length > 0) {
      logger.warn(
        "Following packages already have an equal or greater promotion:\n" +
          renderList(conflicts),
      );
    }

    await modifyJsoncFile(configPath, edits);

    if (updated.length > 0) {
      logger.warn(
        `Following packages recieved '${bump}' promotion:\n` +
          renderList(updated),
      );
    } else {
      logger.warn("No changes!");
    }
  },
});
