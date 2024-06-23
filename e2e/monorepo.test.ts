import { expect, it } from "@jest/globals";
import sandbox from "./utils/sandbox.js";
import json from "./utils/json.js";
import { CONVER } from "./utils/binary.js";

it("bumps only affected packages", async () => {
  await sandbox(async (sandbox) => {
    // package.json
    await sandbox.writeFiles({
      "package.json": json({
        name: "my-workspace",
        version: "0.0.0",
        workspaces: ["package-a", "package-b"],
      }),
      "package-a/package.json": json({
        name: "package-a",
        version: "1.2.3",
      }),
      "package-b/package.json": json({
        name: "package-b",
        version: "1.2.3",
      }),
    });

    // init sandbox
    await sandbox.$`git init`;
    await sandbox.$`${CONVER} init --yes`;
    await sandbox.$`git commit -m ${"chore: first commit"} --allow-empty`;

    // add commit for package A
    await sandbox.writeFiles({
      "package-a/foo.txt": "foo",
    });
    await sandbox.$`git add package-a/foo.txt`;
    await sandbox.$`git commit -m ${"patch: fix foo"}`;

    // add commit for package B
    await sandbox.writeFiles({
      "package-b/bar.txt": "bar",
    });
    await sandbox.$`git add package-b/bar.txt`;
    await sandbox.$`git commit -m ${"feat: add bar"}`;

    // versioning
    await sandbox.$`${CONVER} version`;

    // check version for package A
    const pkgA = (await sandbox.readJsoncFile("package-a/package.json")) as {
      version?: string;
    };
    expect(pkgA.version).toBe("1.2.4");

    // check version for package B
    const pkgB = (await sandbox.readJsoncFile("package-b/package.json")) as {
      version?: string;
    };
    expect(pkgB.version).toBe("1.3.0");
  });
});

it("bumps nested packages", async () => {
  await sandbox(async (sandbox) => {
    // package.json
    await sandbox.writeFiles({
      "package.json": json({
        name: "my-workspace",
        version: "0.0.0",
        workspaces: ["package-a", "package-a/package-b"],
      }),
      "package-a/package.json": json({
        name: "package-a",
        version: "1.2.3",
      }),
      "package-a/package-b/package.json": json({
        name: "package-b",
        version: "1.2.3",
      }),
    });

    // init sandbox
    await sandbox.$`git init`;
    await sandbox.$`${CONVER} init --yes`;
    await sandbox.$`git commit -m ${"chore: first commit"} --allow-empty`;

    // add commit
    await sandbox.writeFiles({
      "package-a/package-b/foo.txt": "foo",
    });
    await sandbox.$`git add package-a/package-b/foo.txt`;
    await sandbox.$`git commit -m ${"patch: fix foo"}`;

    // versioning
    await sandbox.$`${CONVER} version`;

    // check version for package A
    const pkgA = (await sandbox.readJsoncFile("package-a/package.json")) as {
      version?: string;
    };
    expect(pkgA.version).toBe("1.2.4");

    // check version for package B
    const pkgB = (await sandbox.readJsoncFile(
      "package-a/package-b/package.json",
    )) as {
      version?: string;
    };
    expect(pkgB.version).toBe("1.2.4");
  });
});

it("bumps packages with cyclic dependency", async () => {
  await sandbox(async (sandbox) => {
    // package.json
    await sandbox.writeFiles({
      "package.json": json({
        name: "my-workspace",
        version: "0.0.0",
        workspaces: ["package-a", "package-b"],
      }),
      "package-a/package.json": json({
        name: "package-a",
        version: "1.2.3",
        dependencies: {
          "package-b": "workspace:^",
        },
      }),
      "package-b/package.json": json({
        name: "package-b",
        version: "1.2.3",
        dependencies: {
          "package-a": "workspace:^",
        },
      }),
    });

    // init sandbox
    await sandbox.$`git init`;
    await sandbox.$`${CONVER} init --yes`;
    await sandbox.$`git commit -m ${"chore: first commit"} --allow-empty`;

    // add commit for package B
    await sandbox.writeFiles({
      "package-b/bar.txt": "bar",
    });
    await sandbox.$`git add package-b/bar.txt`;
    await sandbox.$`git commit -m ${"feat: add bar"}`;

    // versioning
    await sandbox.$`${CONVER} version`;

    // check version for package A
    const pkgA = (await sandbox.readJsoncFile("package-a/package.json")) as {
      version?: string;
    };
    expect(pkgA.version).toBe("1.2.4");

    // check version for package B
    const pkgB = (await sandbox.readJsoncFile("package-b/package.json")) as {
      version?: string;
    };
    expect(pkgB.version).toBe("1.3.0");
  });
});
