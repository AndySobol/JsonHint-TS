const vscode = require("vscode");
const jsonc = require("jsonc-parser");
const path = require("path");

const TokenResolver = require("./src/TokenParser");
const TokenHoverProvider = require("./src/TokenHoverProvider");
const TokenCompletion = require("./src/TokenCompletion");

let tokenResolver; 
let reloadTimer;
let extensionConfig = {}; 

let statusBarItem;

async function activate(context) {
	if (!vscode.workspace.workspaceFolders?.length) {
		vscode.window.showErrorMessage("JsonHint-TS: workspace not found.");
		return;
	}

	extensionConfig = vscode.workspace.getConfiguration("jsonTokensHint");

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.text = "JsonHint-TS: Initializing...";
	statusBarItem.tooltip = "JsonHint-TS is active";
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	if (!tokenResolver) {
		const tokensDir = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "tokens");
		tokenResolver = new TokenResolver(tokensDir, extensionConfig);
		await tokenResolver.loadTokens();
		statusBarItem.text = `$(zap) JsonHint-TS: Loaded ${Object.keys(tokenResolver.mapping).length} tokens`;
	}

	const selector = { language: "json", scheme: "file" };

	// --- Hover ---
	context.subscriptions.push(vscode.languages.registerHoverProvider(selector, new TokenHoverProvider(tokenResolver, extensionConfig)));

	// --- Completion ---
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, new TokenCompletion(tokenResolver, extensionConfig), "{"));

	// --- File Watcher ---
	const tokensPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "tokens");
	const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(tokensPath, "**/*.json"));

	watcher.onDidChange(() => debounceReload());
	watcher.onDidCreate(() => debounceReload());
	watcher.onDidDelete(() => debounceReload());
	context.subscriptions.push(watcher);

	// --- Config Watcher ---
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("jsonTokensHint")) {
				vscode.window.showInformationMessage("JsonHint-TS: Config updated. Please reload window (Ctrl+R)");
			}
		})
	);

	// --- Reveal token ---
	context.subscriptions.push(
		vscode.commands.registerCommand("jsonTokensHint.revealToken", async ({ file, token }) => {
			try {
				const doc = await vscode.workspace.openTextDocument(file);
				const editor = await vscode.window.showTextDocument(doc);
				const root = jsonc.parseTree(doc.getText());
				if (!root) {
					vscode.window.showWarningMessage("Failed to parse JSON");
					return;
				}

				function findTokenNode(node, tokenParts) {
					if (!node) return null;
					if (node.type === "object" && Array.isArray(node.children)) {
						for (const prop of node.children) {
							if (prop.type === "property" && prop.children && prop.children[0].value === tokenParts[0]) {
								if (tokenParts.length === 1) {
									return prop;
								}
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
			} catch (e) {
				vscode.window.showErrorMessage(`Error moving to token: ${e.message}`);
			}
		})
	);
}

// --- Debounced Reload ---
function debounceReload() {
	clearTimeout(reloadTimer);
	reloadTimer = setTimeout(() => reloadTokens(), 300);
}

// --- Reload tokens with progress ---
async function reloadTokens() {
	statusBarItem.text = "JsonHint-TS: Reloading tokens...";
	await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "JsonHint-TS: Reloading tokens..." }, async () => {
		await tokenResolver.loadTokens();
	});
	const tokenCount = Object.keys(tokenResolver.mapping).length;
	vscode.window.setStatusBarMessage(`JsonHint-TS: Reloaded ${tokenCount} tokens`, 2000);
	statusBarItem.text = `$(zap) JsonHint-TS: Loaded ${tokenCount} tokens`;
}

module.exports = { activate };
