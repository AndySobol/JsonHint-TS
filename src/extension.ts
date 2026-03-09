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
import { DefinitionProvider } from "./providers/DefinitionProvider";

let store: TokenStore;
let resolver: TokenResolver;
let cssMapping: CssMapping;
let cssVarStore: CssVariableStore;
let config: ExtensionConfig;
let statusBar: vscode.StatusBarItem;
let reloadTimer: ReturnType<typeof setTimeout> | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    vscode.window.showErrorMessage("SXL Resolver: No workspace folder found.");
    return;
  }

  const workspaceRoot = folders[0].uri.fsPath;

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
  store.configure(workspaceRoot, config);
  resolver = new TokenResolver(store);
  cssMapping = new CssMapping();
  cssVarStore = new CssVariableStore();

  await loadTokens(workspaceRoot);

  // Register providers
  const jsonSelector: vscode.DocumentSelector = [
    { language: "json", scheme: "file" },
    { language: "jsonc", scheme: "file" },
  ];

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(jsonSelector, new JsonHoverProvider(resolver, store, config)),
  );

  if (config.enableCssHover) {
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(CSS_LANGUAGES, new CssHoverProvider(resolver, store, cssMapping, cssVarStore, config)),
    );
  }

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(jsonSelector, new CompletionProvider(resolver, store, config), "{"),
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      [...jsonSelector as vscode.DocumentFilter[], ...CSS_LANGUAGES as vscode.DocumentFilter[]],
      new DefinitionProvider(store, cssMapping),
    ),
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("sxlResolver.forceRefresh", async () => {
      statusBar.text = "$(sync~spin) SXL Resolver: refreshing...";
      await loadTokens(workspaceRoot);
      vscode.window.showInformationMessage(`SXL Resolver: Reloaded ${store.size} tokens + ${cssVarStore.size} CSS vars.`);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sxlResolver.revealToken", async (params: { file: string; token: string }) => {
      await revealTokenInFile(params.file, params.token, workspaceRoot);
    }),
  );

  // File watchers for token directories (JSON)
  for (const dir of store.tokenDirs) {
    const relPattern = path.relative(workspaceRoot, dir);
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, `${relPattern}/**/*.json`),
    );
    watcher.onDidChange(() => debounceReload(workspaceRoot));
    watcher.onDidCreate(() => debounceReload(workspaceRoot));
    watcher.onDidDelete(() => debounceReload(workspaceRoot));
    context.subscriptions.push(watcher);
  }

  // File watcher for CSS files
  const cssWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, "**/*.{css,scss,less,sass}"),
  );
  cssWatcher.onDidChange(() => debounceReload(workspaceRoot));
  cssWatcher.onDidCreate(() => debounceReload(workspaceRoot));
  cssWatcher.onDidDelete(() => debounceReload(workspaceRoot));
  context.subscriptions.push(cssWatcher);

  // Config change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sxlResolver")) {
        config = readConfig();
        store.configure(workspaceRoot, config);
        vscode.window.showInformationMessage("SXL Resolver: Config updated. Reloading...");
        loadTokens(workspaceRoot);
      }
    }),
  );
}

function readConfig(): ExtensionConfig {
  const raw = vscode.workspace.getConfiguration("sxlResolver");
  return getConfig(raw as unknown as Record<string, unknown>);
}

async function loadTokens(workspaceRoot: string): Promise<void> {
  await Promise.all([
    store.load(),
    cssVarStore.scanWorkspace(workspaceRoot),
  ]);
  resolver.clearCache();
  cssMapping.rebuild(store.mapping, config.cssVariablePrefix);
  statusBar.text = `$(zap) SXL: ${store.size} tokens · ${cssVarStore.size} vars`;
}

function debounceReload(workspaceRoot: string): void {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => loadTokens(workspaceRoot), 300);
}

async function revealTokenInFile(file: string, token: string, workspaceRoot: string): Promise<void> {
  try {
    let fullPath: string;
    if (path.isAbsolute(file)) {
      fullPath = file;
    } else {
      const absPath = store.getAbsolutePath(file);
      fullPath = absPath ?? path.join(workspaceRoot, "tokens", file);
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
