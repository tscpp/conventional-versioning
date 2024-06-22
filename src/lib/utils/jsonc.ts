import * as jsonc from "jsonc-parser";
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
  let text = await readFile(path, "utf8");

  // Formatting
  const indent = detectIndent(text);
  const formattingOptions: jsonc.FormattingOptions = {
    eol: detectNewline(text) ?? "\n",
    tabSize: indent.amount,
    insertSpaces: (indent.type ?? "space") === "space",
  };

  // Apply edits
  for (const edit of edits) {
    const jsoncEdits = jsonc.modify(
      //
      text,
      edit.path,
      edit.value,
      { formattingOptions },
    );
    text = jsonc.applyEdits(text, jsoncEdits);
  }

  // Save file
  await writeFile(path, text);
}
