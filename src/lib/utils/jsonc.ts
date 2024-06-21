import * as jsonc from "jsonc-parser";
import MagicString from "magic-string";
import detectIndent from "detect-indent";
import { detectNewline } from "detect-newline";
import { readFile, writeFile } from "node:fs/promises";

export async function readJsoncFile(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  return jsonc.parse(text) as unknown;
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
      { formattingOptions },
    ),
  );
  for (const change of changes) {
    modified.update(
      //
      change.offset,
      change.offset + change.length,
      change.content,
    );
  }

  // Save file
  const modifiedText = modified.toString();
  await writeFile(path, modifiedText);
}
