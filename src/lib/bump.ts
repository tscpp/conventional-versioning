export type Bump = "patch" | "minor" | "major";

export function compareBump(a: Bump, b: Bump): number {
  const compare = ["patch", "minor", "major"] as const;
  return compare.indexOf(a) - compare.indexOf(b);
}
