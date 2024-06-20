import { describe, expect, it } from "@jest/globals";
import { compareJsoncObjects } from "./jsonc.js";

describe("jsonc", () => {
  it("compares two jsonc objects", () => {
    const obj1 = {
      a: 1,
      b: {
        c: 2,
        d: 3,
      },
      e: [1, 2, 3],
    };

    const obj2 = {
      a: 1,
      b: {
        c: 3,
        d: 3,
      },
      e: [1, 2, 4],
      f: 5,
    };

    const edits = compareJsoncObjects(obj1, obj2);
    expect(edits).toEqual([
      {
        path: ["b", "c"],
        value: 3,
      },
      {
        path: ["e", 2],
        value: 4,
      },
      {
        path: ["f"],
        value: 5,
      },
    ]);
  });
});
