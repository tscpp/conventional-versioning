import { resolve } from "node:path";
import packageJson from "../../package.json";

export const CONVER = resolve(packageJson.bin.conver);
