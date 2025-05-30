import * as vscode from "vscode";
import * as jsonc from "jsonc-parser";
import * as path from "path";
import { TokenResolver } from "./TokenParser";
import { TokenHoverProvider } from "./TokenHoverProvider";
import { TokenCompletion } from "./TokenCompletion";
import { TokenTooltipView } from "./tokenTooltipView";

let tokenResolver: TokenResolver;
let reloadTimer: NodeJS.Timeout | undefined;
let extensionConfig: vscode.WorkspaceConfiguration;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	if (!vscode.workspace.workspaceFolders?.length) {
		vscode.window.showErrorMessage("jsonhintTs: Workspace not found.");
		return;
	}

	// Using the "jsonhintTs" settings space
	extensionConfig = vscode.workspace.getConfiguration("jsonhintTs");

	// The main status bar element that displays the status of token loading.
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = "jsonhintTs: Initializing...";
	statusBarItem.tooltip = "jsonhintTs is active";
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// *** New: Add token refresh button (refresh icon) to status bar ***
	const refreshStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	refreshStatusBarItem.text = "$(sync) Refresh Tokens";
	refreshStatusBarItem.tooltip = "Force refresh tokens";
	refreshStatusBarItem.command = "jsonhintTs.forceRefresh";
	refreshStatusBarItem.show();
	context.subscriptions.push(refreshStatusBarItem);

	// Registering a command to manually update tokens
	context.subscriptions.push(
		vscode.commands.registerCommand("jsonhintTs.forceRefresh", async () => {
			statusBarItem.text = "$(sync~spin) jsonhintTs: Refreshing tokens...";
			await reloadTokens();
			vscode.window.showInformationMessage("Tokens successfully refreshed.");
		})
	);

	const tokensDir = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "tokens");
	if (!tokenResolver) {
		tokenResolver = new TokenResolver(tokensDir, extensionConfig);
		await tokenResolver.loadTokens();
		statusBarItem.text = `$(zap) jsonhintTs: Loaded ${Object.keys(tokenResolver.mapping).length} tokens`;
	}

	const selector = { language: "json", scheme: "file" };

	// РHover Provider Registration
	context.subscriptions.push(vscode.languages.registerHoverProvider(selector, new TokenHoverProvider(tokenResolver, extensionConfig)));

	// Registering Completion Provider for the symbol "{"
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, new TokenCompletion(tokenResolver, extensionConfig), "{"));

	// Command to open detailed view of token in WebView
	context.subscriptions.push(
		vscode.commands.registerCommand("jsonhintTs.viewTokenTooltip", async (params: { tokenKey: string }[]) => {
			const tokenKey = params && params.length ? params[0].tokenKey : "";
			if (!tokenKey) {
				vscode.window.showWarningMessage("Token key not provided.");
				return;
			}
			vscode.window.showInformationMessage(`viewTokenTooltip invoked with tokenKey: ${tokenKey}`);
			TokenTooltipView.createOrShow(context.extensionUri, tokenKey, tokenResolver);
		})
	);

	// File watcher for JSON files with tokens
	const tokensPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "tokens");
	const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(tokensPath, "**/*.json"));
	watcher.onDidChange(() => debounceReload());
	watcher.onDidCreate(() => debounceReload());
	watcher.onDidDelete(() => debounceReload());
	context.subscriptions.push(watcher);

	// Monitoring changes in settings
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("jsonhintTs")) {
				vscode.window.showInformationMessage("jsonhintTs: Config updated. Please reload window (Ctrl+R)");
			}
		})
	);

	// The "revealToken" command to navigate to the location of the token definition in the file
	context.subscriptions.push(
		vscode.commands.registerCommand("jsonhintTs.revealToken", async (params: { file: string; token: string }) => {
			const { file, token } = params;
			try {
				const workspaceFolder = vscode.workspace.workspaceFolders![0].uri.fsPath;

				// If the path is absolute, we use it, otherwise we supplement the path to the tokens
				let fullFilePath = "";
				if (path.isAbsolute(file)) {
					fullFilePath = file;
				} else {
					fullFilePath = path.join(workspaceFolder, "tokens", file);
				}

				const doc = await vscode.workspace.openTextDocument(fullFilePath);
				const editor = await vscode.window.showTextDocument(doc);

				// If token is empty, show start of file
				if (!token) {
					const position = new vscode.Position(0, 0);
					editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
					return;
				}

				const root = jsonc.parseTree(doc.getText());
				if (!root) {
					vscode.window.showWarningMessage("Failed to parse JSON");
					return;
				}

				function findTokenNode(node: any, tokenParts: string[]): any {
					if (!node) return null;
					if (node.type === "object" && Array.isArray(node.children)) {
						for (const prop of node.children) {
							if (prop.type === "property" && prop.children && prop.children[0].value === tokenParts[0]) {
								if (tokenParts.length === 1) return prop;
								return findTokenNode(prop.children[1], tokenParts.slice(1));
							}
						}
					}
					return null;
				}

				const tokenParts = token.split(".");
				const tokenNode = findTokenNode(root, tokenParts);
				if (tokenNode) {
					const keyNode = tokenNode.children[0];
					const range = new vscode.Range(doc.positionAt(keyNode.offset), doc.positionAt(keyNode.offset + keyNode.length));
					editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
					editor.selection = new vscode.Selection(range.start, range.end);
					const decorationType = vscode.window.createTextEditorDecorationType({
						backgroundColor: new vscode.ThemeColor("editor.wordHighlightStrongBackground"),
						borderRadius: "2px",
					});
					editor.setDecorations(decorationType, [range]);
					setTimeout(() => decorationType.dispose(), 1500);
				} else {
					vscode.window.showWarningMessage(`Variable "${token}" not found in JSON`);
				}
			} catch (e: any) {
				vscode.window.showErrorMessage(`Error moving to token: ${e.message}`);
			}
		})
	);
}

function debounceReload(): void {
	if (reloadTimer) clearTimeout(reloadTimer);
	reloadTimer = setTimeout(() => {
		reloadTokens();
	}, 300);
}

async function reloadTokens(): Promise<void> {
	statusBarItem.text = "jsonhintTs: Reloading tokens...";
	await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "jsonhintTs: Reloading tokens..." }, async () => {
		await tokenResolver.loadTokens();
	});
	const tokenCount = Object.keys(tokenResolver.mapping).length;
	vscode.window.setStatusBarMessage(`jsonhintTs: Reloaded ${tokenCount} tokens`, 2000);
	statusBarItem.text = `$(zap) jsonhintTs: Loaded ${tokenCount} tokens`;
}