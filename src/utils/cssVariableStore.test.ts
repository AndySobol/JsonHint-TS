import test from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { CssVariableStore } from "./cssVariableStore";

test("CssVariableStore resolves cross-file var references and keeps raw value", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sxl-css-vars-"));
  await fs.writeFile(path.join(tempRoot, "a.css"), ":root { --space-sm: 8px; }");
  await fs.writeFile(path.join(tempRoot, "b.scss"), ":root { --space-md: var(--space-sm); }");

  const store = new CssVariableStore();
  await store.scanWorkspace(tempRoot);

  const resolved = store.resolveToToken("--space-md");
  assert.ok(resolved);
  assert.equal(resolved.kind, "simple");
  assert.equal(resolved.rawValue, "var(--space-sm)");
  assert.equal(resolved.finalValue, "8px");
  assert.equal(resolved.type, "dimension");
  assert.equal(resolved.chain.length >= 2, true);
});

test("CssVariableStore infers typography for font shorthand custom property", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sxl-css-font-"));
  await fs.writeFile(
    path.join(tempRoot, "tokens.css"),
    ":root { --font-title: 600 16px/24px Inter, system-ui, sans-serif; }",
  );

  const store = new CssVariableStore();
  await store.scanWorkspace(tempRoot);

  const resolved = store.resolveToToken("--font-title");
  assert.ok(resolved);
  assert.equal(resolved.kind, "simple");
  assert.equal(resolved.type, "typography");
  assert.equal(resolved.finalValue.includes("16px/24px"), true);
});

test("CssVariableStore prioritizes local CSS variable definitions by document context", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sxl-css-scope-"));
  const rootCss = path.join(tempRoot, "styles", "root.css");
  const componentCss = path.join(tempRoot, "components", "badge.css");
  await fs.mkdir(path.dirname(rootCss), { recursive: true });
  await fs.mkdir(path.dirname(componentCss), { recursive: true });

  await fs.writeFile(rootCss, ":root { --accent: #111111; }");
  await fs.writeFile(componentCss, ":root { --accent: #ff5500; --chip-bg: var(--accent); }");

  const store = new CssVariableStore();
  await store.scanWorkspace(tempRoot);

  const inComponent = store.resolveToToken("--accent", { documentPath: componentCss, line: 1 });
  assert.ok(inComponent);
  assert.equal(inComponent.kind, "simple");
  assert.equal(inComponent.finalValue.toLowerCase(), "#ff5500");

  const inRoot = store.resolveToToken("--accent", { documentPath: rootCss, line: 1 });
  assert.ok(inRoot);
  assert.equal(inRoot.kind, "simple");
  assert.equal(inRoot.finalValue.toLowerCase(), "#111111");

  const chipBg = store.resolveToToken("--chip-bg", { documentPath: componentCss, line: 1 });
  assert.ok(chipBg);
  assert.equal(chipBg.kind, "simple");
  assert.equal(chipBg.finalValue.toLowerCase(), "#ff5500");
  assert.equal(chipBg.chain.length >= 2, true);
});
