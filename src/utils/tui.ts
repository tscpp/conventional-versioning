export function renderList(items: string[]): string {
  return items.map((item) => "  * " + item).join("\n");
}
