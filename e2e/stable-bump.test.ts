import { expect, it } from "@jest/globals";
import sandbox from "./utils/sandbox.js";
import json from "./utils/json.js";
import { CONVER } from "./utils/binary.js";

it("bumps stable version", async () => {
  await sandbox("stable-bump", async ({ $, name, sandbox }) => {
    // package.json
    await sandbox.writeFiles({
      "package.json": json({
        name,
        version: "1.2.3",
      }),
    });

    // init sandbox
    await $`git init`;
    await $`${CONVER} init --yes`;
    await $`git commit -m ${"chore: first commit"} --allow-empty`;

    // check status
    let status = await getStatus();
    expect(status).toEqual([]);

    // add commit
    await sandbox.writeFiles({
      "foo.txt": "foo",
    });
    await $`git add foo.txt`;
    await $`git commit -m ${"feat: add foo"}`;

    // check status
    status = await getStatus();
    expect(status).toEqual([
      {
        name,
        oldVersion: "1.2.3",
        newVersion: "1.3.0",
        bump: "minor",
      },
    ]);

    async function getStatus() {
      const result = await $`${CONVER} status --json`;
      const status = JSON.parse(result.stdout) as unknown;
      return status;
    }
  });
});
