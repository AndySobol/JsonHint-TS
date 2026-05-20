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
  });

  assert.deepEqual(config.tokenPaths, ["tokens", "brand"]);
  assert.equal(config.maxChainLength, 7);
  assert.equal(config.maxSuggestions, 99);
  assert.equal(config.cssVariablePrefix, "var-");
  assert.equal(config.showIcons, false);
  assert.equal(config.allowNoDollar, false);
  assert.equal(config.enableCssHover, false);
});
