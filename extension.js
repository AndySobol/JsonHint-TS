"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const jsonc = __importStar(require("jsonc-parser"));
const path = __importStar(require("path"));
const TokenParser_1 = require("./src/TokenParser");
const TokenHoverProvider_1 = require("./src/TokenHoverProvider");
const TokenCompletion_1 = require("./src/TokenCompletion");
let tokenResolver;
let reloadTimer;
let extensionConfig;
let statusBarItem;
function activate(context) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (!((_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a.length)) {
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
            tokenResolver = new TokenParser_1.TokenResolver(tokensDir, extensionConfig);
            yield tokenResolver.loadTokens();
            statusBarItem.text = `$(zap) JsonHint-TS: Loaded ${Object.keys(tokenResolver.mapping).length} tokens`;
        }
        const selector = { language: "json", scheme: "file" };
        // Регистрируем Hover Provider
        context.subscriptions.push(vscode.languages.registerHoverProvider(selector, new TokenHoverProvider_1.TokenHoverProvider(tokenResolver, extensionConfig)));
        // Регистрируем Completion Provider
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, new TokenCompletion_1.TokenCompletion(tokenResolver, extensionConfig), "{"));
        // Файловый наблюдатель
        const tokensPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "tokens");
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(tokensPath, "**/*.json"));
        watcher.onDidChange(() => debounceReload());
        watcher.onDidCreate(() => debounceReload());
        watcher.onDidDelete(() => debounceReload());
        context.subscriptions.push(watcher);
        // Наблюдатель за изменением конфигураций
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("jsonTokensHint")) {
                vscode.window.showInformationMessage("JsonHint-TS: Config updated. Please reload window (Ctrl+R)");
            }
        }));
        // Команда «revealToken»
        context.subscriptions.push(vscode.commands.registerCommand("jsonTokensHint.revealToken", ({ file, token }) => __awaiter(this, void 0, void 0, function* () {
            try {
                const doc = yield vscode.workspace.openTextDocument(file);
                const editor = yield vscode.window.showTextDocument(doc);
                const root = jsonc.parseTree(doc.getText());
                if (!root) {
                    vscode.window.showWarningMessage("Failed to parse JSON");
                    return;
                }
                function findTokenNode(node, tokenParts) {
                    if (!node)
                        return null;
                    if (node.type === "object" && Array.isArray(node.children)) {
                        for (const prop of node.children) {
                            if (prop.type === "property" && prop.children && prop.children[0].value === tokenParts[0]) {
                                if (tokenParts.length === 1)
                                    return prop;
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
                }
                else {
                    vscode.window.showWarningMessage(`Variable "${token}" not found in JSON`);
                }
            }
            catch (e) {
                vscode.window.showErrorMessage(`Error moving to token: ${e.message}`);
            }
        })));
    });
}
exports.activate = activate;
function debounceReload() {
    if (reloadTimer)
        clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => reloadTokens(), 300);
}
function reloadTokens() {
    return __awaiter(this, void 0, void 0, function* () {
        statusBarItem.text = "JsonHint-TS: Reloading tokens...";
        yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "JsonHint-TS: Reloading tokens..." }, () => __awaiter(this, void 0, void 0, function* () {
            yield tokenResolver.loadTokens();
        }));
        const tokenCount = Object.keys(tokenResolver.mapping).length;
        vscode.window.setStatusBarMessage(`JsonHint-TS: Reloaded ${tokenCount} tokens`, 2000);
        statusBarItem.text = `$(zap) JsonHint-TS: Loaded ${tokenCount} tokens`;
    });
}
//# sourceMappingURL=extension.js.map