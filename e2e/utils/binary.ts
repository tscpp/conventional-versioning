import { resolve } from "node:path";
import packageJson from "../../package.json";
import { $ } from "execa";

export const CONVER = resolve(packageJson.bin.conver);

if (process.platform !== "win32") {
  await $`chmod +x ${CONVER}`;
}
