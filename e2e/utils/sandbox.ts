import { $, ExecaScriptMethod } from "execa";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface SandboxContext {
  // eslint-disable-next-line @typescript-eslint/ban-types
  $: ExecaScriptMethod<{}>;
  root: string;
  name: string;
  sandbox: Sandbox;
}

export default async function sandbox(
  name: string,
  callback: (sandbox: SandboxContext) => Promise<void>,
) {
  const root = resolve("e2e/out", name);
  await mkdir(root, { recursive: true });
  try {
    await callback({
      $: $({ cwd: root }),
      root,
      name,
      sandbox: new Sandbox(root),
    });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

export class Sandbox {
  constructor(private root: string) {}

  async writeFiles(files: Record<string, string>): Promise<void> {
    for (const [name, data] of Object.entries(files)) {
      await writeFile(join(this.root, name), data);
    }
  }

  async removeFiles(files: string[]): Promise<void> {
    for (const name of files) {
      await rm(join(this.root, name), { force: true, recursive: true });
    }
  }
}
