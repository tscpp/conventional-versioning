import { writeFile } from "node:fs/promises";
import { declareCommand } from "../cli.js";
import { existsSync } from "node:fs";
import { PACKAGE_NAME } from "../utils/constants.js";

export default declareCommand({
  command: ["init"],
  describe: "Adds the configuration file.",
  builder: (cli) => cli,
  handler: async () => {
    if (existsSync("conver.json")) {
      return;
    }

    await writeFile(
      "conver.json",
      JSON.stringify(
        {
          $schema: `${PACKAGE_NAME}/schema.json`,
          options: {},
        },
        undefined,
        2,
      ),
    );
  },
});
