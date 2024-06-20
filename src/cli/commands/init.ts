import { writeFile } from "node:fs/promises";
import { declareCommand } from "../cli.js";
import { existsSync } from "node:fs";
import { logger } from "../../lib/logger.js";
import { ExecaError } from "execa";
import enquirer from "enquirer";
import isTTY from "../../lib/utils/is-tty.js";
import { createGit } from "../../lib/utils/git.js";

export default declareCommand({
  command: ["init"],
  describe: "Adds the configuration file.",
  builder: (cli) =>
    cli.options({
      branch: {
        type: "string",
      },
      base: {
        type: "string",
      },
    }),
  handler: async (args) => {
    if (existsSync("conver.json")) {
      logger.error("conver.json file already exists.");
      return;
    }

    const git = await createGit();

    let branch: string;
    if (args.branch) {
      branch = args.branch;
    } else {
      const currentBranch = await git.getCurrentBranch();

      if (args.ci || !isTTY) {
        branch = currentBranch;
      } else {
        branch = (
          await enquirer.prompt<{ branch: string }>({
            name: "branch",
            message: "What is the main branch?",
            type: "input",
            initial: currentBranch,
          })
        ).branch;
      }
    }

    let base: string | undefined;
    if (args.base) {
      base = args.base;
    } else {
      try {
        base = await git.revParse("HEAD~1");
      } catch (error) {
        if (
          !(
            error instanceof ExecaError &&
            (error.stderr! as string).includes("Needed a single revision")
          )
        ) {
          throw error;
        }
      }
    }

    if (!base) {
      logger.warn(
        "Missing commit history. Next versioning will include entire commit history."
      );
    }

    await writeFile(
      "conver.json",
      JSON.stringify(
        {
          $schema: `./node_modules/conventional-versioning/schema.json`,
          options: {},
          branch,
          base,
        },
        undefined,
        2
      )
    );

    logger.info("Created conver.json file!");
  },
});
