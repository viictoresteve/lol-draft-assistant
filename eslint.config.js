// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      // Allow the conventional `_` prefix to mark deliberately-unused params
      // (RxJS/NgRx callbacks, destructured throwaways, ignored catch vars).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // `any` is confined to untyped JSON boundaries (AI/DDragon responses are
      // validated field-by-field right after). Flag it, don't fail the build.
      "@typescript-eslint/no-explicit-any": "warn",
      // Intentional no-op catch/blocks (best-effort localStorage, silent fallbacks).
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // Tests exercise edge cases with loose typing and fixtures.
    files: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // Auto-focusing the search box the moment its modal opens is the expected
      // UX here (the field is the sole purpose of the popup).
      "@angular-eslint/template/no-autofocus": "off",
      // Click-to-dismiss backdrops and clickable card containers back real
      // keyboard-accessible controls (buttons/inputs) inside them. Surface these
      // as warnings to keep them visible without blocking CI.
      "@angular-eslint/template/click-events-have-key-events": "warn",
      "@angular-eslint/template/interactive-supports-focus": "warn",
    },
  }
]);
