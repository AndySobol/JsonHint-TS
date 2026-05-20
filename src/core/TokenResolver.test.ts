import test from "node:test";
import assert from "node:assert/strict";
import { TokenResolver } from "./TokenResolver";
import type { TokenEntry } from "./types";
import type { TokenStore } from "./TokenStore";

function createResolver(entries: Array<[string, TokenEntry]>): TokenResolver {
  const mapping = new Map<string, TokenEntry>(entries);
  const storeLike = {
    mapping,
    getEntry: (key: string) => mapping.get(key) ?? null,
    getScopeKey: () => "__test__",
  } as unknown as TokenStore;
  return new TokenResolver(storeLike);
}

test("TokenResolver resolves alias chains for simple tokens", () => {
  const resolver = createResolver([
    ["color.base", { value: "#101010", type: "color", file: "/tmp/colors.json" }],
    ["color.text", { value: "{color.base}", type: "color", file: "/tmp/colors.json" }],
  ]);

  const resolved = resolver.resolve("{color.text}");
  assert.ok(resolved);
  assert.equal(resolved.kind, "simple");
  assert.equal(resolved.rawValue, "{color.base}");
  assert.equal(resolved.finalValue, "#101010");
  assert.equal(resolved.chain.length, 2);
  assert.equal(resolved.chain[0].token, "color.text");
  assert.equal(resolved.chain[1].token, "color.base");
});

test("TokenResolver evaluates numeric expressions and resolves composite props", () => {
  const resolver = createResolver([
    ["spacing.base", { value: "4", type: "spacing", file: "/tmp/space.json" }],
    ["spacing.md", { value: "{spacing.base} * 2", type: "spacing", file: "/tmp/space.json" }],
    [
      "typography.title",
      {
        value: {
          fontSize: "{spacing.md}",
          lineHeight: "20",
        },
        type: "typography",
        file: "/tmp/typo.json",
      },
    ],
  ]);

  const spacing = resolver.resolve("{spacing.md}");
  assert.ok(spacing);
  assert.equal(spacing.kind, "simple");
  assert.equal(spacing.rawValue, "{spacing.base} * 2");
  assert.equal(spacing.finalValue, "8px");

  const typography = resolver.resolve("{typography.title}");
  assert.ok(typography);
  assert.equal(typography.kind, "composite");
  assert.equal(typography.props.fontSize.resolvedValue, "8px");
  assert.equal(typography.props.lineHeight.resolvedValue, "20");
});
