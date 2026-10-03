import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  // The rules are for the plugin's own code; build output, tests and node
  // scripts are not plugin code
  { ignores: ["main.js", "node_modules/", "test/", "scripts/", "*.mjs"] },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: {
        window: "readonly",
        document: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        localStorage: "readonly",
        console: "readonly",
        navigator: "readonly",
        createDiv: "readonly",
      },
    },
    rules: {
      "obsidianmd/sample-names": "off",
      "@typescript-eslint/require-await": "error",
    },
  },
]);
