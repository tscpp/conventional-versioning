import chalk from "chalk";
import { declareCommand } from "../cli.js";
import { logger } from "../../lib/logger.js";
import { renderTable, renderVersioning } from "../../lib/utils/tui.js";
import { createVersioningPlan } from "../../lib/versioning.js";
import { getWorkspace } from "../../lib/workspace.js";
import { getCommitHistory } from "../../lib/history.js";
import { option } from "../../lib/utils/option.js";
import { readJsoncFile } from "../../lib/utils/jsonc.js";
import { Options } from "../../lib/options.js";
import { SemVer } from "semver";

export default declareCommand({
  command: ["status"],
  describe: "Prints the current status.",
  builder: (cli) => cli,
  handler: async (args) => {
    const configPath = args.config;
    const options = (await readJsoncFile(configPath)) as Options;
    const workspace = await getWorkspace(options);
    const commits = await getCommitHistory(options);
    const updates = createVersioningPlan(workspace, commits, options);

    process.stdout.write("\n");
    logger.info(
      chalk.underline("Packages:") +
        "\n" +
        renderTable(
          workspace.packages.map((pkg) => [
            chalk.cyan(pkg.name),
            chalk.dim("@"),
            chalk.blue(pkg.version),
            new SemVer(pkg.version).prerelease.length > 0
              ? chalk.yellow("(pre-release)")
              : new SemVer(pkg.version).major === 0
                ? chalk.yellow("(0.x)")
                : chalk.dim("(stable)"),
          ])
        )
    );
    process.stdout.write("\n");

    logger.info(
      chalk.underline("Promotions:") +
        "\n" +
        renderTable(
          Object.entries(option(options, "promotions"))
            .filter((entry) => !!entry[1])
            .map(([name, bump]) => [chalk.cyan(name), chalk.dim("@"), bump!])
        )
    );
    process.stdout.write("\n");

    logger.info(
      chalk.underline("Pending updates:") + "\n" + renderVersioning(updates)
    );
    process.stdout.write("\n");
  },
});
