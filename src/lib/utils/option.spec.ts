import { describe, expect, it } from "@jest/globals";
import { Options } from "../options.js";
import { option } from "./option.js";

describe("option", () => {
  it("gets option from options object", () => {
    const options: Options = {
      onlyWorkspaceProtocol: true,
    };
    const value = option(options, "onlyWorkspaceProtocol");
    expect(value).toStrictEqual(true);
  });

  it("fallbacks to using the default options", () => {
    const options: Options = {
      onlyWorkspaceProtocol: undefined,
    };
    const value = option(options, "onlyWorkspaceProtocol");
    expect(value).toStrictEqual(false);
  });
});
