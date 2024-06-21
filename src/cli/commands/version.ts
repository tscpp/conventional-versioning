import { declareCommand } from "../cli.js";
import {
  createVersioningPlan,
  updateVersions,
  validateVersions,
} from "../../lib/versioning.js";
import { getWorkspace } from "../../lib/workspace.js";
import { getCommitHistory } from "../../lib/history.js";
import chalk from "chalk";
import { renderVersioning } from "../../lib/utils/tui.js";
import enquirer from "enquirer";
import isTTY from "../../lib/utils/is-tty.js";
import { logger } from "../../lib/logger.js";
import {
  JSONCEdit,
  modifyJsoncFile,
  readJsoncFile,
} from "../../lib/utils/jsonc.js";
import { Options } from "../../lib/options.js";
import { createGit } from "../../lib/utils/git.js";

export default declareCommand({
  command: "version",
  describe: "Version packages.",
  builder: (cli) => cli,
  handler: async (args) => {
    const configPath = args.config;
    const options = (await readJsoncFile(configPath)) as Options;
    const workspace = await getWorkspace(options);
    const history = await getCommitHistory(options);
    const updates = createVersioningPlan(workspace, history, options);
    const git = await createGit(options);

    if (updates.length === 0) {
      logger.info("No version updates available. Exiting.");
      return;
    }

    process.stdout.write("\n");
    process.stdout.write(
      chalk.underline("Pending updates:") +
        "\n" +
        renderVersioning(updates) +
        "\n",
    );
    process.stdout.write("\n");

    if (!args.yes && !args.ci && isTTY) {
      const { confirm } = await enquirer.prompt<{ confirm: boolean }>({
        name: "confirm",
        type: "confirm",
        message: "Are you sure you want to make these changes?",
        initial: true,
      });
      if (!confirm) {
        return;
      }
      process.stdout.write("\n");
    }

    // Get new base commit.
    const base = git.revParse("HEAD");

    if (args.dry) {
      validateVersions(workspace, updates, options);
    } else {
      await updateVersions(workspace, updates, options);

      const edits: JSONCEdit[] = [];

      // Reset promotions
      edits.push(
        ...workspace.packages.map((pkg) => ({
          path: ["promotions", pkg.name],
          value: undefined,
        })),
      );

      // Update base commit
      edits.push({
        path: ["base"],
        value: base,
      });

      await modifyJsoncFile(configPath, edits);
    }

    logger.info(
      "All packages' version were successfully updated! Make sure to commit changes.",
    );
  },
});
