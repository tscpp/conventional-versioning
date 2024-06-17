import chalk from "chalk";
import { declareCommand } from "../cli.js";
import { getCommits } from "../utils/commit.js";
import { Config } from "../utils/config.js";
import { createGit } from "../utils/git.js";
import logger from "../utils/logger.js";
import { renderBump, renderTable, renderVersioning } from "../utils/tui.js";
import { createVersioningPlan } from "../utils/version.js";
import { getWorkspace } from "../utils/workspace.js";

export default declareCommand({
  command: ["status"],
  describe: "Prints the current status.",
  builder: (cli) => cli,
  handler: async (args) => {
    const config = await Config.read(args.config);
    const workspace = await getWorkspace({
      directory: args.workspaceDir,
      config,
    });
    const git = await createGit(args.rootDir);
    const commits = await getCommits({ git, config });
    const promitions = config.getPromotions();
    const versioning = await createVersioningPlan({
      workspace,
      commits,
      config,
    });

    await logger.info(
      chalk.underline("Packages:") +
        "\n" +
        renderTable(
          workspace.packages.map((pkg) => [
            chalk.cyan(pkg.name),
            chalk.dim("@"),
            chalk.blue(pkg.version.format()),
            config.isPreRelease(pkg.name)
              ? chalk.yellow("(pre-release)")
              : chalk.dim("(stable)"),
          ])
        )
    );
    process.stdout.write("\n");

    await logger.info(
      chalk.underline("Promotes:") +
        "\n" +
        renderTable(
          Array.from(promitions).map(([name, bump]) => [
            chalk.cyan(name),
            chalk.dim("@"),
            renderBump(bump),
          ])
        )
    );
    process.stdout.write("\n");

    await logger.info(
      chalk.underline("Next versioning:") + "\n" + renderVersioning(versioning)
    );
    process.stdout.write("\n");
  },
});
