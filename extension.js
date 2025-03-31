const vscode = require("vscode");
const jsonc = require("jsonc-parser");
const path = require("path");

const TokenResolver = require("./src/TokenParser");
const TokenHoverProvider = require("./src/TokenHoverProvider");
const TokenCompletion = require("./src/TokenCompletion");

let tokenResolver; // singleton
let reloadTimer;
let extensionConfig = {}; // shared config

async function activate(context) {
	if (!vscode.workspace.workspaceFolders?.length) {
		vscode.window.showErrorMessage("JsonHint-TS: workspace not found.");
		return;
	}

	extensionConfig = vscode.workspace.getConfiguration("jsonTokensHint");

	if (!tokenResolver) {
		const tokensDir = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "tokens");
		tokenResolver = new TokenResolver(tokensDir, extensionConfig);
		await tokenResolver.loadTokens();
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
			const vscodeVersion = parseFloat(vscode.version.split(".")[0] + "." + vscode.version.split(".")[1]);
			if (process.platform === "darwin" && vscodeVersion >= 1.98) {
				vscode.window.showWarningMessage("Перемещение к токену временно отключено из-за бага VSCode (Mac + Electron 34).");
				return;
			}

			try {
				const doc = await vscode.workspace.openTextDocument(file);
				const editor = await vscode.window.showTextDocument(doc);
				const root = jsonc.parseTree(doc.getText());
				if (!root) {
					vscode.window.showWarningMessage("Не удалось разобрать JSON");
					return;
				}

				function findNode(node) {
					if (node.type === "property" && node.children?.[0]?.value === token) return node;
					return node.children?.map(findNode).find(Boolean) || null;
				}

				const tokenNode = findNode(root);
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
					vscode.window.showWarningMessage(`Переменная "${token}" не найдена в JSON`);
				}
			} catch (e) {
				vscode.window.showErrorMessage(`Ошибка при перемещении к токену: ${e.message}`);
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
	await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "JsonHint-TS: Reloading tokens..." }, async () => await tokenResolver.loadTokens());
	vscode.window.setStatusBarMessage(`JsonHint-TS: Reloaded ${Object.keys(tokenResolver.mapping).length} tokens`, 2000);
}

module.exports = { activate };