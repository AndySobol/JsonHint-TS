import test from "node:test";
import assert from "node:assert/strict";
import { getConfig } from "./types";

test("getConfig applies safe defaults for invalid values", () => {
  const config = getConfig({
    tokenPaths: ["", "tokens", 42],
    maxChainLength: 0,
    maxSuggestions: Number.NaN,
    cssVariablePrefix: "",
  } as unknown as Record<string, unknown>);

  assert.deepEqual(config.tokenPaths, ["tokens"]);
  assert.equal(config.maxChainLength, 1);
  assert.equal(config.maxSuggestions, 300);
  assert.equal(config.cssVariablePrefix, "--");
  assert.equal(config.allowNoDollar, true);
  assert.equal(config.enableCssHover, true);
  assert.equal(config.enableCssCompletion, true);
  assert.deepEqual(config.cssVariableSources, []);
});

test("getConfig normalizes numeric values and keeps valid inputs", () => {
  const config = getConfig({
    tokenPaths: ["tokens", "brand"],
    maxChainLength: 7.9,
    maxSuggestions: 99.3,
    cssVariablePrefix: "var-",
    showIcons: false,
    allowNoDollar: false,
    enableCssHover: false,
    enableCssCompletion: false,
    cssVariableSources: [
      "styles/tokens.css",
      {
        name: "project styles",
        package: "@scope/project-styles",
        entrypoints: ["bk-ui/index.css"],
        paths: ["components/index.css"],
        manifests: ["bk-ui/tokens-manifest.json"],
        appliesTo: ["packages/site/**"],
      },
      {
        package: "@scope/empty",
      },
    ],
  });

  assert.deepEqual(config.tokenPaths, ["tokens", "brand"]);
  assert.equal(config.maxChainLength, 7);
  assert.equal(config.maxSuggestions, 99);
  assert.equal(config.cssVariablePrefix, "var-");
  assert.equal(config.showIcons, false);
  assert.equal(config.allowNoDollar, false);
  assert.equal(config.enableCssHover, false);
  assert.equal(config.enableCssCompletion, false);
  assert.deepEqual(config.cssVariableSources, [
    {
      name: "styles/tokens.css",
      cssPaths: ["styles/tokens.css"],
      manifests: [],
      appliesTo: [],
    },
    {
      name: "project styles",
      packageName: "@scope/project-styles",
      cssPaths: ["components/index.css", "bk-ui/index.css"],
      manifests: ["bk-ui/tokens-manifest.json"],
      appliesTo: ["packages/site/**"],
    },
    {
      name: "@scope/empty",
      packageName: "@scope/empty",
      cssPaths: [],
      manifests: [],
      appliesTo: [],
    },
  ]);
});
