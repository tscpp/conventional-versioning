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
import { isPreRelease } from "../../lib/utils/version.js";
import { ExecaError } from "execa";

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

    if (updates.length > 0) {
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
          process.exit(1);
        }
        process.stdout.write("\n");
      }

      if (args.dry) {
        validateVersions(workspace, updates, options);
      } else {
        await updateVersions(workspace, updates, options);
      }
    }

    // Get new base commit.
    const git = await createGit(options);
    let base: string;
    try {
      base = await git.revParse("HEAD");
    } catch (error) {
      if (
        error instanceof ExecaError &&
        (error.stderr! as string).includes("Needed a single revision")
      ) {
        throw logger.fatal(
          "Cannot set base commit since no commit history is available on this branch.",
        );
      } else {
        throw error;
      }
    }

    const edits: JSONCEdit[] = [];

    // Reset promotions
    edits.push(
      ...workspace.packages
        .filter((pkg) => !!options.promotions?.[pkg.name])
        .map((pkg) => ({
          path: ["promotions", pkg.name],
          value: undefined,
        })),
    );

    // Reset pre-releases
    edits.push(
      ...workspace.packages
        .filter(
          (pkg) =>
            !isPreRelease(pkg.version) && !!options.preReleases?.[pkg.name],
        )
        .map((pkg) => ({
          path: ["preReleases", pkg.name],
          value: undefined,
        })),
    );

    if (!args.dry && edits.length > 0) {
      // Update base commit
      edits.push({
        path: ["base"],
        value: base,
      });

      await modifyJsoncFile(configPath, edits);
    }

    if (updates.length > 0) {
      logger.info(
        "All packages' version were successfully updated! Make sure to commit changes.",
      );
    }

    logger.info("Finished!");
  },
});
