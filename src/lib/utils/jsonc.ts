import * as jsonc from "jsonc-parser";
import MagicString from "magic-string";
import detectIndent from "detect-indent";
import { detectNewline } from "detect-newline";
import { readFile, writeFile } from "node:fs/promises";

export async function readJsoncFile(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  return jsonc.parse(text) as unknown;
}

export async function writeJsoncFile(
  path: string,
  value: unknown
): Promise<void> {
  const originalValue = await readJsoncFile(path);
  const edits = compareJsoncObjects(originalValue, value);
  await modifyJsoncFile(path, edits);
}

export interface JSONCEdit {
  path: (string | number)[];
  value: unknown;
}

export async function modifyJsoncFile(path: string, edits: JSONCEdit[]) {
  const originalText = await readFile(path, "utf8");
  const modified = new MagicString(originalText);

  // Formatting
  const indent = detectIndent(originalText);
  const formattingOptions: jsonc.FormattingOptions = {
    eol: detectNewline(originalText) ?? "\n",
    tabSize: indent.amount,
    insertSpaces: (indent.type ?? "space") === "space",
  };

  // Apply edits
  const changes = edits.flatMap((edit) =>
    jsonc.modify(
      //
      originalText,
      edit.path,
      edit.value,
      { formattingOptions }
    )
  );
  for (const change of changes) {
    modified.update(
      //
      change.offset,
      change.offset + change.length,
      change.content
    );
  }

  // Save file
  const modifiedText = modified.toString();
  await writeFile(path, modifiedText);
}

export function compareJsoncObjects(
  obj1: unknown,
  obj2: unknown,
  path: (string | number)[] = []
) {
  let differences: JSONCEdit[] = [];

  if (typeof obj1 !== "object" || !obj1 || typeof obj2 !== "object" || !obj2) {
    if (obj1 !== obj2) {
      differences.push({ path, value: obj2 });
    }
    return differences;
  }

  const keys = new Set<string | number>([
    ...Object.keys(obj1),
    ...Object.keys(obj2),
  ]);

  for (let key of keys) {
    if (Array.isArray(obj1)) {
      key = Number(key);
    }
    const newPath = path.concat(key);
    if (!Object.hasOwn(obj2, key)) {
      differences.push({ path: newPath, value: undefined });
    } else if (!Object.hasOwn(obj1, key)) {
      differences.push({
        path: newPath,
        value: (obj2 as Record<string, unknown>)[key],
      });
    } else {
      differences = differences.concat(
        compareJsoncObjects(
          (obj1 as Record<string, unknown>)[key],
          (obj2 as Record<string, unknown>)[key],
          newPath
        )
      );
    }
  }

  return differences;
}
