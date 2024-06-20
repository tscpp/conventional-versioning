import { isAbsolute, relative } from "node:path";

export function containsPath(directory: string, path: string) {
  const rel = relative(directory, path);
  return !!rel && !rel.startsWith("..") && !isAbsolute(rel);
}
