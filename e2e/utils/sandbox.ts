import { $, ExecaScriptMethod } from "execa";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import jsonc from "jsonc-parser";

export default async function sandbox(
  callback: (sandbox: Sandbox) => Promise<void>,
) {
  const name = generateRandomHash();
  const root = resolve("e2e/out", name);
  await mkdir(root, { recursive: true });
  const sandbox = new Sandbox(root);
  try {
    await callback(sandbox);
  } finally {
    if (!sandbox.preserve) {
      await rm(root, { force: true, recursive: true });
    }
  }
}

export class Sandbox {
  // eslint-disable-next-line @typescript-eslint/ban-types
  readonly $: ExecaScriptMethod<{}>;

  preserve = false;

  constructor(private root: string) {
    this.$ = $({ cwd: root });
  }

  async writeFiles(files: Record<string, string>): Promise<void> {
    for (const [name, data] of Object.entries(files)) {
      const path = join(this.root, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
    }
  }

  async removeFiles(files: string[]): Promise<void> {
    for (const name of files) {
      await rm(join(this.root, name), { force: true, recursive: true });
    }
  }

  async readFile(name: string): Promise<string> {
    return readFile(join(this.root, name), "utf8");
  }

  async readJsoncFile(name: string): Promise<unknown> {
    const text = await this.readFile(name);
    return jsonc.parse(text) as unknown;
  }
}

function generateRandomHash() {
  return createHash("sha256")
    .update(Math.random().toString())
    .digest("base64url")
    .slice(0, 7);
}
