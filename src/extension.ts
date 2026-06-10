/**
 * SXL Resolver — VS Code extension entry point.
 *
 * Provides design token intellisense: hover previews with resolved values,
 * visual type previews, inheritance chains, autocomplete, and go-to-definition.
 * Works in JSON (token references) and CSS/SCSS/TSX (var(--token-name)).
 */

import * as vscode from "vscode";
import * as path from "path";
import * as jsonc from "jsonc-parser";
import { TokenStore } from "./core/TokenStore";
import { TokenResolver } from "./core/TokenResolver";
import { getConfig, type ExtensionConfig } from "./core/types";
import { CssMapping } from "./utils/cssMapping";
import { CssVariableStore } from "./utils/cssVariableStore";
import { JsonHoverProvider } from "./providers/JsonHoverProvider";
import { CssHoverProvider, CSS_LANGUAGES } from "./providers/CssHoverProvider";
import { CompletionProvider } from "./providers/CompletionProvider";
import { CssCompletionProvider } from "./providers/CssCompletionProvider";
import { DefinitionProvider } from "./providers/DefinitionProvider";

let store: TokenStore;
let resolver: TokenResolver;
let cssMapping: CssMapping;
let cssVarStore: CssVariableStore;
let config: ExtensionConfig;
let statusBar: vscode.StatusBarItem;
let reloadTimer: ReturnType<typeof setTimeout> | undefined;
let dynamicWatchers: vscode.Disposable[] = [];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoots = getWorkspaceRoots();
  if (!workspaceRoots.length) {
    vscode.window.showWarningMessage("SXL Resolver: No workspace folder found.");
    return;
  }

  config = readConfig();

  // Status bar
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(loading~spin) SXL Resolver: loading...";
  statusBar.tooltip = "SXL Resolver – Design Token Intellisense";
  statusBar.show();
  context.subscriptions.push(statusBar);

  const refreshBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  refreshBtn.text = "$(sync) Refresh Tokens";
  refreshBtn.tooltip = "Force reload all design tokens";
  refreshBtn.command = "sxlResolver.forceRefresh";
  refreshBtn.show();
  context.subscriptions.push(refreshBtn);

  // Initialize core
  store = new TokenStore();
  store.configure(workspaceRoots, config);
  resolver = new TokenResolver(store);
  cssMapping = new CssMapping();
  cssVarStore = new CssVariableStore();

  await loadTokens(workspaceRoots);
  context.subscriptions.push({
    dispose: () => {
      for (const disposable of dynamicWatchers) {
        disposable.dispose();
      }
      dynamicWatchers = [];
    },
  });

  // Register providers
  const jsonSelector: vscode.DocumentSelector = [
    { language: "json", scheme: "file" },
    { language: "jsonc", scheme: "file" },
  ];

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(jsonSelector, new JsonHoverProvider(resolver, store, config)),
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(CSS_LANGUAGES, new CssHoverProvider(resolver, store, cssMapping, cssVarStore, config)),
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(jsonSelector, new CompletionProvider(resolver, store, config), "{"),
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      CSS_LANGUAGES,
      new CssCompletionProvider(cssVarStore, config),
      "-",
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      [...jsonSelector as vscode.DocumentFilter[], ...CSS_LANGUAGES as vscode.DocumentFilter[]],
      new DefinitionProvider(store, cssMapping, cssVarStore),
    ),
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("sxlResolver.forceRefresh", async () => {
      const roots = getWorkspaceRoots();
      if (!roots.length) {
        vscode.window.showWarningMessage("SXL Resolver: No workspace folder found.");
        return;
      }
      store.configure(roots, config);
      statusBar.text = "$(sync~spin) SXL Resolver: refreshing...";
      await loadTokens(roots);
      resetWatchers(roots);
      vscode.window.showInformationMessage(`SXL Resolver: Reloaded ${store.size} tokens + ${cssVarStore.size} CSS vars.`);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sxlResolver.revealToken", async (params: { file: string; token: string }) => {
      await revealTokenInFile(params.file, params.token, getWorkspaceRoots());
    }),
  );

  resetWatchers(workspaceRoots);

  // Config change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("sxlResolver")) {
        const roots = getWorkspaceRoots();
        if (!roots.length) return;
        Object.assign(config, readConfig());
        store.configure(roots, config);
        await loadTokens(roots);
        resetWatchers(roots);
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      const roots = getWorkspaceRoots();
      if (!roots.length) {
        statusBar.text = "$(warning) SXL Resolver: no workspace";
        return;
      }
      store.configure(roots, config);
      await loadTokens(roots);
      resetWatchers(roots);
    }),
  );
}

function getWorkspaceRoots(): string[] {
  const folders = vscode.workspace.workspaceFolders ?? [];
  return folders.map((f) => f.uri.fsPath);
}

function readConfig(): ExtensionConfig {
  const raw = vscode.workspace.getConfiguration("sxlResolver");
  return getConfig(raw as unknown as Record<string, unknown>);
}

async function loadTokens(workspaceRoots: string[]): Promise<void> {
  try {
    await Promise.all([
      store.load(),
      cssVarStore.scanWorkspaces(workspaceRoots, config.cssVariableSources),
    ]);
    resolver.clearCache();
    cssMapping.rebuild(store.mapping, config.cssVariablePrefix);
    statusBar.text = `$(zap) SXL: ${store.size} tokens · ${cssVarStore.size} vars`;
  } catch (error) {
    statusBar.text = "$(warning) SXL Resolver: load failed";
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`SXL Resolver: ${message}`);
  }
}

function debounceReload(workspaceRoots: string[]): void {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    void loadTokens(workspaceRoots);
  }, 300);
}

function resetWatchers(workspaceRoots: string[]): void {
  for (const disposable of dynamicWatchers) {
    disposable.dispose();
  }
  dynamicWatchers = [];

  const roots = workspaceRoots.length > 0 ? workspaceRoots : getWorkspaceRoots();
  if (!roots.length) return;

  for (const dir of store.tokenDirs) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(dir), "**/*.{json,jsonc}"),
    );
    watcher.onDidChange(() => debounceReload(getWorkspaceRoots()));
    watcher.onDidCreate(() => debounceReload(getWorkspaceRoots()));
    watcher.onDidDelete(() => debounceReload(getWorkspaceRoots()));
    dynamicWatchers.push(watcher);
  }

  for (const root of roots) {
    const cssWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(root), "**/*.{css,scss,less,sass}"),
    );
    cssWatcher.onDidChange(() => debounceReload(getWorkspaceRoots()));
    cssWatcher.onDidCreate(() => debounceReload(getWorkspaceRoots()));
    cssWatcher.onDidDelete(() => debounceReload(getWorkspaceRoots()));
    dynamicWatchers.push(cssWatcher);
  }

  for (const root of cssVarStore.watchRoots) {
    if (roots.some((workspaceRoot) => path.resolve(workspaceRoot) === path.resolve(root))) continue;
    const cssSourceWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(root), "**/*.{css,scss,less,sass,json}"),
    );
    cssSourceWatcher.onDidChange(() => debounceReload(getWorkspaceRoots()));
    cssSourceWatcher.onDidCreate(() => debounceReload(getWorkspaceRoots()));
    cssSourceWatcher.onDidDelete(() => debounceReload(getWorkspaceRoots()));
    dynamicWatchers.push(cssSourceWatcher);
  }

}

async function revealTokenInFile(file: string, token: string, workspaceRoots: string[]): Promise<void> {
  try {
    let fullPath: string;
    if (path.isAbsolute(file)) {
      fullPath = file;
    } else {
      const absPath = store.getAbsolutePath(file);
      if (absPath) {
        fullPath = absPath;
      } else if (workspaceRoots[0]) {
        fullPath = path.join(workspaceRoots[0], "tokens", file);
      } else {
        vscode.window.showWarningMessage("SXL Resolver: No workspace folder available for relative token path.");
        return;
      }
    }

    const doc = await vscode.workspace.openTextDocument(fullPath);
    const editor = await vscode.window.showTextDocument(doc);

    if (!token || token.startsWith("--")) {
      editor.revealRange(new vscode.Range(0, 0, 0, 0), vscode.TextEditorRevealType.InCenter);
      return;
    }

    const root = jsonc.parseTree(doc.getText());
    if (!root) {
      vscode.window.showWarningMessage("SXL Resolver: Failed to parse JSON.");
      return;
    }

    const tokenNode = findTokenNode(root, token.split("."));
    if (tokenNode?.children?.[0]) {
      const keyNode = tokenNode.children[0];
      const range = new vscode.Range(
        doc.positionAt(keyNode.offset),
        doc.positionAt(keyNode.offset + keyNode.length),
      );
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      editor.selection = new vscode.Selection(range.start, range.end);

      const decoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor("editor.wordHighlightStrongBackground"),
        borderRadius: "2px",
      });
      editor.setDecorations(decoration, [range]);
      setTimeout(() => decoration.dispose(), 1500);
    } else {
      vscode.window.showWarningMessage(`SXL Resolver: Token "${token}" not found.`);
    }
  } catch (e) {
    vscode.window.showErrorMessage(`SXL Resolver: ${(e as Error).message}`);
  }
}

function findTokenNode(node: jsonc.Node, parts: string[]): jsonc.Node | null {
  if (!node || parts.length === 0) return null;
  if (node.type === "object" && node.children) {
    for (const prop of node.children) {
      if (prop.type === "property" && prop.children?.[0]?.value === parts[0]) {
        if (parts.length === 1) return prop;
        return findTokenNode(prop.children[1], parts.slice(1));
      }
    }
  }
  return null;
}

export function deactivate(): void {
  // cleanup handled by disposables
}
