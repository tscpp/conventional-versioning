import { describe, expect, it } from "@jest/globals";
import Pipeline from "./pipeline.js";

describe("pipeline", () => {
  it("pipes value through multiple callbacks", () => {
    const pipeline = new Pipeline<number>();
    pipeline.pipe((number) => number + 1);
    pipeline.pipe((number) => number + 10);
    pipeline.pipe((number) => number + 100);
    const value = pipeline.write(0);
    expect(value).toBe(111);
  });

  it("clones pipeline", () => {
    const pipeline1 = new Pipeline<number>();
    pipeline1.pipe((number) => number + 1);
    const pipeline2 = pipeline1.clone();
    pipeline2.pipe((number) => number + 2);
    const value = pipeline2.write(0);
    expect(value).toBe(2);
  });
});
