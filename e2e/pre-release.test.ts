import { expect, it } from "@jest/globals";
import sandbox from "./utils/sandbox.js";
import json from "./utils/json.js";
import { CONVER } from "./utils/binary.js";
import { Options } from "../src/lib/options.js";

it("enters pre-release", async () => {
  await sandbox(async (sandbox) => {
    // package.json
    await sandbox.writeFiles({
      "package.json": json({
        name: "my-package",
        version: "1.2.3",
      }),
    });

    // init sandbox
    await sandbox.$`git init`;
    await sandbox.$`${CONVER} init --yes`;

    // enter pre-release
    await sandbox.$`${CONVER} pre enter my-package --id=rc --tag=next`;

    // check package
    const pkg = (await sandbox.readJsoncFile("package.json")) as {
      version?: string;
      publishConfig?: {
        tag?: string;
      };
    };
    expect(pkg.version).toBe("1.2.3-rc.0");
    expect(pkg.publishConfig?.tag).toBe("next");

    // check config
    const config = (await sandbox.readJsoncFile("conver.json")) as Options;
    expect(config.preReleases).toMatchObject({ "my-package": "1.2.3" });
  });
});

it("exists pre-release", async () => {
  await sandbox(async (sandbox) => {
    // package.json
    await sandbox.writeFiles({
      "package.json": json({
        name: "my-package",
        version: "1.3.0-rc.5",
        publishConfig: {
          tag: "next",
        },
      }),
      "conver.json": json({
        preReleases: {
          "my-package": "1.2.3",
        },
      }),
    });

    // init sandbox
    await sandbox.$`git init`;
    await sandbox.$`git commit -m ${"chore: first commit"} --allow-empty`;

    // exit pre-release
    await sandbox.$`${CONVER} pre exit my-package`;

    // check package
    const pkg = (await sandbox.readJsoncFile("package.json")) as {
      version?: string;
      publishConfig?: {
        tag?: string;
      };
    };
    expect(pkg.version).toBe("1.3.0");
    expect(pkg.publishConfig?.tag).toBe(undefined);

    // versioning
    await sandbox.$`${CONVER} version`;

    // check config
    const options = (await sandbox.readJsoncFile("conver.json")) as Options;
    console.log(options);
    expect(Object.keys(options.preReleases ?? {})).not.toContain("my-package");
  });
});

it("bumps pre-release version", async () => {
  await sandbox(async (sandbox) => {
    // package.json
    await sandbox.writeFiles({
      "package.json": json({
        name: "my-package",
        version: "1.2.3-rc.0",
        publishConfig: {
          tag: "next",
        },
      }),
      "conver.json": json({
        preReleases: {
          "my-package": "1.2.3",
        },
      }),
    });

    // init sandbox
    await sandbox.$`git init`;
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
    expect(pkg.version).toBe("1.3.0-rc.0");
  });
});
