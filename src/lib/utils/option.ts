import { Options, DEFAULT_OPTIONS } from "../options.js";

export function option<K extends keyof Options>(
  options: Options | undefined,
  key: K
) {
  return (options?.[key] ??
    DEFAULT_OPTIONS[key]) as (typeof DEFAULT_OPTIONS)[K] extends undefined
    ? Options[K] | undefined
    : Exclude<Options[K], undefined>;
}
