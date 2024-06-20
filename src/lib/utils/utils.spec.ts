import { describe, expect, it } from "@jest/globals";
import { containsPath } from "./utils.js";

describe("containsPath", () => {
  it("returns true for file under directory", () => {
    const value = containsPath("/home/elias", "/home/elias/file.txt");
    expect(value).toBe(true);
  });

  it("returns false when not contained", () => {
    const value = containsPath("/home/not-elias", "/home/elias/file.txt");
    expect(value).toBe(false);
  });

  it("returns true for deeply nested file under directory", () => {
    const value = containsPath("/home/elias", "/home/elias/desktop/file.txt");
    expect(value).toBe(true);
  });

  it("works with backslashes", () => {
    const value = containsPath("C:\\Users\\elias", "C:\\Users\\elias\\file.txt");
    expect(value).toBe(true);
  });
});
