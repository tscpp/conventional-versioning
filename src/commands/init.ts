import { writeFile } from "node:fs/promises";
import { declareCommand } from "../cli.js";
import { existsSync } from "node:fs";
import { PACKAGE_NAME } from "../utils/constants.js";
import { createGit } from "../utils/git.js";
import logger from "../utils/logger.js";
import { ExecaError } from "execa";
import isTTY from "../utils/is-tty.js";
import enquirer from "enquirer";

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
      await logger.error("conver.json file already exists.");
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
        base = await git.revParse("HEAD");
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

    await writeFile(
      "conver.json",
      JSON.stringify(
        {
          $schema: `${PACKAGE_NAME}/schema.json`,
          options: {},
          branch,
          base,
        },
        undefined,
        2
      )
    );
  },
});
