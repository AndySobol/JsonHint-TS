const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				project: "./tsconfig.json",
			},
		},
		files: ["src/**/*.ts"],
		ignores: ["dist/**", "node_modules/**", "**/*.js"],
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" },
			],
		},
	}
);
