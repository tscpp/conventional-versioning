import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: ["tsconfig.lib.json", "tsconfig.test.json"],
      },
    },
    ignores: ["**/*", "!src/**/*", "!e2e/**/*"],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      "@typescript-eslint/only-throw-error": "off"
    }
  }
];
