import { expect, it } from "@jest/globals";
import sandbox from "./utils/sandbox.js";
import json from "./utils/json.js";
import { CONVER } from "./utils/binary.js";

it("bumps stable version", async () => {
  await sandbox(async (sandbox) => {
    const name = "my-package";

    // package.json
    await sandbox.writeFiles({
      "package.json": json({
        name,
        version: "1.2.3",
      }),
    });

    // init sandbox
    await sandbox.$`git init`;
    await sandbox.$`${CONVER} init --yes`;
    await sandbox.$`git commit -m ${"chore: first commit"} --allow-empty`;

    // add commit
    await sandbox.writeFiles({
      "foo.txt": "foo",
    });
    await sandbox.$`git add foo.txt`;
    await sandbox.$`git commit -m ${"feat: add foo"}`;

    // versioning
    await sandbox.$`${CONVER} version`;

    // check version
    const pkg = (await sandbox.readJsoncFile("package.json")) as {
      version?: string;
    };
    expect(pkg.version).toBe("1.3.0");
  });
});
