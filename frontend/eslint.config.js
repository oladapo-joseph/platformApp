import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

// Colours come only from design tokens (docs/06 §10): a hex literal in src/ is an error.
const HEX = "/#[0-9a-fA-F]{3,8}\b/";

export default tseslint.config(
  { ignores: ["dist", "src/api/schema.d.ts", "public"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${HEX}]`, message: "Use a design token (var(--…)) instead of a hex colour." },
        { selector: `TemplateElement[value.raw=${HEX}]`, message: "Use a design token instead of a hex colour." },
      ],
    },
  },
);
