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

test("CssVariableStore resolves configured package CSS sources through nearest package.json", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sxl-css-package-"));
  const siteRoot = path.join(tempRoot, "packages", "site");
  const adminRoot = path.join(tempRoot, "packages", "admin");
  const pkgRoot = path.join(siteRoot, "node_modules", "@scope", "project-styles");
  const adminPkgRoot = path.join(adminRoot, "node_modules", "@scope", "project-styles");

  await fs.mkdir(path.join(pkgRoot, "bk-ui"), { recursive: true });
  await fs.mkdir(path.join(pkgRoot, "components"), { recursive: true });
  await fs.mkdir(path.join(adminPkgRoot, "admin-ui"), { recursive: true });

  await fs.writeFile(path.join(siteRoot, "package.json"), JSON.stringify({
    dependencies: { "@scope/project-styles": "1.0.0" },
  }));
  await fs.writeFile(path.join(adminRoot, "package.json"), JSON.stringify({
    dependencies: { "@scope/project-styles": "1.0.0" },
  }));
  await fs.writeFile(path.join(pkgRoot, "package.json"), JSON.stringify({
    name: "@scope/project-styles",
    version: "1.0.0",
  }));
  await fs.writeFile(path.join(adminPkgRoot, "package.json"), JSON.stringify({
    name: "@scope/project-styles",
    version: "1.0.0",
  }));
  await fs.writeFile(path.join(pkgRoot, "bk-ui", "index.css"), "@import './core.css';\n");
  await fs.writeFile(path.join(pkgRoot, "bk-ui", "core.css"), ":root { --accent: #123456; }");
  await fs.writeFile(path.join(adminPkgRoot, "admin-ui", "index.css"), "@import './core.css';\n");
  await fs.writeFile(path.join(adminPkgRoot, "admin-ui", "core.css"), ":root { --accent: #abcdef; }");
  await fs.writeFile(path.join(pkgRoot, "components", "index.css"), "@import url(./WButton.css);\n");
  await fs.writeFile(path.join(pkgRoot, "components", "WButton.css"), ":root { --button-bg: var(--accent); }");

  const store = new CssVariableStore();
  await store.scanWorkspaces([tempRoot], [
    {
      name: "site styles",
      packageName: "@scope/project-styles",
      cssPaths: ["bk-ui/index.css", "components/index.css"],
      manifests: [],
      appliesTo: ["packages/site/**"],
    },
    {
      name: "admin styles",
      packageName: "@scope/project-styles",
      cssPaths: ["admin-ui/index.css"],
      manifests: [],
      appliesTo: ["packages/admin/**"],
    },
  ]);

  const siteFile = path.join(siteRoot, "src", "component.css");
  const adminFile = path.join(adminRoot, "src", "component.css");
  const siteAccent = store.resolveToToken("--accent", { documentPath: siteFile, line: 1 });
  const adminAccent = store.resolveToToken("--accent", { documentPath: adminFile, line: 1 });
  const buttonBg = store.resolveToToken("--button-bg", { documentPath: siteFile, line: 1 });

  assert.ok(siteAccent);
  assert.equal(siteAccent.kind, "simple");
  assert.equal(siteAccent.finalValue.toLowerCase(), "#123456");

  assert.ok(adminAccent);
  assert.equal(adminAccent.kind, "simple");
  assert.equal(adminAccent.finalValue.toLowerCase(), "#abcdef");

  assert.ok(buttonBg);
  assert.equal(buttonBg.kind, "simple");
  assert.equal(buttonBg.rawValue, "var(--accent)");
  assert.equal(buttonBg.finalValue.toLowerCase(), "#123456");
  assert.deepEqual(store.findVarNames("--but", { documentPath: siteFile, line: 1 }), ["--button-bg"]);
});

test("CssVariableStore keeps package source versions scoped to the consuming package", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sxl-css-package-version-"));

  async function createConsumer(packageName: string, value: string): Promise<string> {
    const appRoot = path.join(tempRoot, "packages", packageName);
    const projectStylesRoot = path.join(appRoot, "node_modules", "@scope", "project-styles");
    await fs.mkdir(path.join(projectStylesRoot, "theme"), { recursive: true });
    await fs.writeFile(path.join(appRoot, "package.json"), JSON.stringify({
      dependencies: { "@scope/project-styles": "1.0.0" },
    }));
    await fs.writeFile(path.join(projectStylesRoot, "package.json"), JSON.stringify({
      name: "@scope/project-styles",
      version: "1.0.0",
    }));
    await fs.writeFile(path.join(projectStylesRoot, "theme", "index.css"), `:root { --accent: ${value}; }`);
    return path.join(appRoot, "src", "component.css");
  }

  const appAFile = await createConsumer("app-a", "#aaaaaa");
  const appBFile = await createConsumer("app-b", "#bbbbbb");

  const store = new CssVariableStore();
  await store.scanWorkspaces([tempRoot], [
    {
      name: "theme",
      packageName: "@scope/project-styles",
      cssPaths: ["theme/index.css"],
      manifests: [],
      appliesTo: ["packages/**"],
    },
  ]);

  const appA = store.resolveToToken("--accent", { documentPath: appAFile, line: 1 });
  const appB = store.resolveToToken("--accent", { documentPath: appBFile, line: 1 });

  assert.ok(appA);
  assert.ok(appB);
  assert.equal(appA.kind, "simple");
  assert.equal(appB.kind, "simple");
  assert.equal(appA.finalValue.toLowerCase(), "#aaaaaa");
  assert.equal(appB.finalValue.toLowerCase(), "#bbbbbb");
});

test("CssVariableStore reads configured manifest sources as resolved-value fallback", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sxl-css-manifest-"));
  const manifestPath = path.join(tempRoot, "tokens-manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify({
    schemaVersion: "1.0",
    tokens: [
      {
        name: "accent-medium",
        cssVar: "--accent-medium",
        type: "color",
        value: "#fe5e01",
        resolvedValue: "#fe5e01",
        originalValue: "{cfg.accent.500}",
      },
    ],
  }));

  const store = new CssVariableStore();
  await store.scanWorkspaces([tempRoot], [
    {
      name: "manifest",
      cssPaths: [],
      manifests: ["tokens-manifest.json"],
      appliesTo: [],
    },
  ]);

  const resolved = store.resolveToToken("--accent-medium");
  assert.ok(resolved);
  assert.equal(resolved.kind, "simple");
  assert.equal(resolved.type, "color");
  assert.equal(resolved.rawValue, "{cfg.accent.500}");
  assert.equal(resolved.finalValue.toLowerCase(), "#fe5e01");
});

test("CssVariableStore enriches CSS declarations with manifest token metadata", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sxl-css-manifest-metadata-"));
  const cssPath = path.join(tempRoot, "styles", "index.css");
  const manifestPath = path.join(tempRoot, "styles", "tokens-manifest.json");
  await fs.mkdir(path.dirname(cssPath), { recursive: true });
  await fs.writeFile(cssPath, ":root { --weight-semibold: 600; --space-md: 8px; }");
  await fs.writeFile(manifestPath, JSON.stringify({
    schemaVersion: "1.0",
    tokens: [
      {
        cssVar: "--weight-semibold",
        type: "fontWeight",
        value: "600",
        resolvedValue: "600",
      },
      {
        cssVar: "--space-md",
        type: "spacing",
        value: "8px",
        resolvedValue: "8px",
      },
    ],
  }));

  const store = new CssVariableStore();
  await store.scanWorkspaces([tempRoot], [
    {
      name: "styles",
      cssPaths: ["styles/index.css"],
      manifests: ["styles/tokens-manifest.json"],
      appliesTo: [],
    },
  ]);

  const fontWeight = store.resolveToToken("--weight-semibold", { documentPath: cssPath, line: 1 });
  const spacing = store.resolveToToken("--space-md", { documentPath: cssPath, line: 1 });

  assert.ok(fontWeight);
  assert.equal(fontWeight.kind, "simple");
  assert.equal(fontWeight.rawValue, "600");
  assert.equal(fontWeight.type, "fontWeight");
  assert.equal(fontWeight.file, cssPath);

  assert.ok(spacing);
  assert.equal(spacing.kind, "simple");
  assert.equal(spacing.rawValue, "8px");
  assert.equal(spacing.type, "spacing");
  assert.equal(spacing.file, cssPath);
});

test("CssVariableStore prioritizes configured CSS sources over unrelated workspace declarations", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sxl-css-source-priority-"));
  const workspaceCss = path.join(tempRoot, "packages", "legacy", "variables.css");
  const sourceCss = path.join(tempRoot, "styles", "index.css");
  const manifestPath = path.join(tempRoot, "styles", "tokens-manifest.json");
  const contextFile = path.join(tempRoot, "packages", "app", "component.css");
  await fs.mkdir(path.dirname(workspaceCss), { recursive: true });
  await fs.mkdir(path.dirname(sourceCss), { recursive: true });
  await fs.mkdir(path.dirname(contextFile), { recursive: true });
  await fs.writeFile(workspaceCss, ":root { --bg-weaker: rgba(var(--legacy-color)); }");
  await fs.writeFile(sourceCss, ":root { --bg-weaker: var(--core-bg); --core-bg: #f2f5f8; }");
  await fs.writeFile(manifestPath, JSON.stringify({
    schemaVersion: "1.0",
    tokens: [
      {
        cssVar: "--bg-weaker",
        type: "color",
        value: "{core.bg}",
        resolvedValue: "#f2f5f8",
      },
    ],
  }));

  const store = new CssVariableStore();
  await store.scanWorkspaces([tempRoot], [
    {
      name: "project",
      cssPaths: ["styles/index.css"],
      manifests: ["styles/tokens-manifest.json"],
      appliesTo: ["packages/app/**"],
    },
  ]);

  const resolved = store.resolveToToken("--bg-weaker", { documentPath: contextFile, line: 1 });

  assert.ok(resolved);
  assert.equal(resolved.kind, "simple");
  assert.equal(resolved.type, "color");
  assert.equal(resolved.finalValue.toLowerCase(), "#f2f5f8");
  assert.equal(resolved.file, sourceCss);
});
