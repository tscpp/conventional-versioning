import { isAbsolute, relative } from "node:path";

export function spliceValueFromArray<T>(array: T[], value: T) {
  const index = array.findIndex((v) => v === value);
  if (index !== -1) {
    array.splice(index, 1);
  }
}

export function containsPath(directory: string, path: string) {
  const rel = relative(directory, path);
  return rel && !rel.startsWith("..") && !isAbsolute(rel);
}
