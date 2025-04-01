const vscode = require("vscode");
const jsonc = require("jsonc-parser");
const utils = require("./utils");

class TokenCompletion {
	constructor(tokenResolver, config) {
		this.tokenResolver = tokenResolver;
		this.config = config;
		this.inheritanceStyle = config.inheritanceStyle || "compact";
		this.maxSuggestions = config.maxSuggestions || 300;
	}

	provideCompletionItems(document, position) {
		const line = document.lineAt(position).text;
		if (!line.includes('"$value"')) return;

		const index = line.lastIndexOf("{", position.character);
		if (index === -1) return;

		const prefix = line.substring(index + 1, position.character);
		const rootNode = jsonc.parseTree(document.getText());
		if (!rootNode) return;

		const node = jsonc.findNodeAtOffset(rootNode, document.offsetAt(position));
		if (!node) return;

		const detectedType = utils.findNearestType(node);
		const items = [];

		const tokenStart = new vscode.Position(position.line, index + 1);
		const tokenRange = new vscode.Range(tokenStart, position);

		for (const [key, def] of Object.entries(this.tokenResolver.mapping)) {
			if (items.length >= this.maxSuggestions) break;
			if (!key.startsWith(prefix)) continue;
			if (detectedType && def.type && def.type !== detectedType) continue;

			const resolved = this.tokenResolver.resolveToken(`{${key}}`);
			const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Value);
			item.insertText = new vscode.SnippetString(`{${key}}`);
			item.range = tokenRange;

			const md = new vscode.MarkdownString();
			md.isTrusted = true;

			let content = "";

			if (resolved.type === "color" && resolved.finalValue && resolved.finalValue.startsWith("#")) {
				content += utils.getColorPreview(resolved.finalValue) + "\n\n";
			}

			content += "### Result\n\n";
			if (resolved.props) {
				for (const [prop, data] of Object.entries(resolved.props)) {
					content += `- **${prop}**: ${data.result} ${data.value}\n`;
				}
			} else {
				content += `- ${resolved.finalValue}\n`;
			}

			content += "\n### Source\n\n";
			if (resolved.props) {
				for (const [prop, data] of Object.entries(resolved.props)) {
					content += `- **${prop}**: ${data.chain.includes("⚠️") ? "⚠️ " : ""}${data.chain}\n`;
				}
			} else {
				content += utils.renderChain(resolved.chain, this.tokenResolver.mapping, this.config);
			}

			item.detail = resolved.finalValue || "Token";
			md.appendMarkdown(content);
			item.documentation = md;
			items.push(item);
		}

		return items;
	}
}

module.exports = TokenCompletion;