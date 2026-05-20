import test from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { TokenStore } from "./TokenStore";
import { getConfig } from "./types";

test("TokenStore loads tokens from multiple workspace roots and supports JSONC", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sxl-resolver-"));
  const wsA = path.join(tempRoot, "workspace-a");
  const wsB = path.join(tempRoot, "workspace-b");
  const tokensA = path.join(wsA, "tokens");
  const tokensB = path.join(wsB, "tokens");

  await fs.mkdir(tokensA, { recursive: true });
  await fs.mkdir(tokensB, { recursive: true });

  await fs.writeFile(
    path.join(tokensA, "colors.json"),
    JSON.stringify({
      color: {
        primary: { $type: "color", $value: "#ffffff" },
      },
    }, null, 2),
  );

  await fs.writeFile(
    path.join(tokensB, "spacing.jsonc"),
    `{
      // JSONC + trailing comma
      "spacing": {
        "sm": { "$type": "spacing", "$value": "8", },
      },
    }`,
  );

  const store = new TokenStore();
  const config = getConfig({ tokenPaths: ["tokens"], allowNoDollar: true });
  store.configure([wsA, wsB], config);
  await store.load();

  assert.equal(store.mapping.get("color.primary")?.value, "#ffffff");
  assert.equal(store.mapping.get("spacing.sm")?.value, "8");
  assert.equal(store.size, 2);
});

test("TokenStore resolves relative token file paths only when file exists", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sxl-resolver-path-"));
  const tokensDir = path.join(tempRoot, "tokens");
  await fs.mkdir(tokensDir, { recursive: true });
  await fs.writeFile(path.join(tokensDir, "a.json"), "{}");

  const store = new TokenStore();
  const config = getConfig({ tokenPaths: ["tokens"] });
  store.configure(tempRoot, config);

  assert.equal(store.getAbsolutePath("a.json"), path.join(tokensDir, "a.json"));
  assert.equal(store.getAbsolutePath("missing.json"), null);
});

test("TokenStore selects scoped token entries by nearest token directory", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sxl-resolver-scope-"));
  const tokensA = path.join(tempRoot, "ds-a", "tokens");
  const tokensB = path.join(tempRoot, "ds-b", "tokens");
  const compA = path.join(tempRoot, "ds-a", "components", "WBadge", "WBadge.vue");
  const compB = path.join(tempRoot, "ds-b", "components", "WBadge", "WBadge.vue");
  await fs.mkdir(tokensA, { recursive: true });
  await fs.mkdir(tokensB, { recursive: true });
  await fs.mkdir(path.dirname(compA), { recursive: true });
  await fs.mkdir(path.dirname(compB), { recursive: true });
  await fs.writeFile(compA, "<template></template>");
  await fs.writeFile(compB, "<template></template>");

  await fs.writeFile(
    path.join(tokensA, "colors.json"),
    JSON.stringify({ color: { accent: { $type: "color", $value: "#111111" } } }),
  );
  await fs.writeFile(
    path.join(tokensB, "colors.json"),
    JSON.stringify({ color: { accent: { $type: "color", $value: "#ff5500" } } }),
  );

  const store = new TokenStore();
  const config = getConfig({ tokenPaths: [tokensA, tokensB], allowNoDollar: true });
  store.configure(tempRoot, config);
  await store.load();

  const entryA = store.getEntry("color.accent", compA);
  const entryB = store.getEntry("color.accent", compB);
  assert.ok(entryA);
  assert.ok(entryB);
  assert.equal(entryA.value, "#111111");
  assert.equal(entryB.value, "#ff5500");
});
