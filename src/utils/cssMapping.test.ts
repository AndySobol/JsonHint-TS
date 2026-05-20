import test from "node:test";
import assert from "node:assert/strict";
import { CssMapping } from "./cssMapping";
import type { TokenEntry } from "../core/types";

test("CssMapping uses figma Web codeSyntax when available", () => {
  const mapping = new Map<string, TokenEntry>([
    [
      "color.brand.primary",
      {
        value: "#0066FF",
        type: "color",
        file: "/tmp/colors.json",
        extensions: { figma: { codeSyntax: { Web: "var(--brand-primary)" } } },
      },
    ],
  ]);

  const cssMapping = new CssMapping();
  cssMapping.rebuild(mapping, "--");

  assert.equal(cssMapping.findToken("--brand-primary"), "color.brand.primary");
  assert.equal(cssMapping.getCssVar("color.brand.primary"), "--brand-primary");
});

test("CssMapping falls back to token path kebab and supports var() fallback syntax", () => {
  const mapping = new Map<string, TokenEntry>([
    [
      "spacing.card.paddingX",
      {
        value: 16,
        type: "spacing",
        file: "/tmp/spacing.json",
      },
    ],
    [
      "color.accent",
      {
        value: "#FF5500",
        type: "color",
        file: "/tmp/colors.json",
        extensions: { figma: { codeSyntax: { Web: "var(--accent, #fff)" } } },
      },
    ],
  ]);

  const cssMapping = new CssMapping();
  cssMapping.rebuild(mapping, "--");

  assert.equal(cssMapping.findToken("--spacing-card-padding-x"), "spacing.card.paddingX");
  assert.equal(cssMapping.getCssVar("spacing.card.paddingX"), "--spacing-card-padding-x");
  assert.equal(cssMapping.findToken("--accent"), "color.accent");
});
