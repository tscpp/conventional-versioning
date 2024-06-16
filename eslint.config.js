import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: ["tsconfig.json", "test/tsconfig.json"],
      },
    },
    ignores: ["**/*", "!src/**/*"],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
];
