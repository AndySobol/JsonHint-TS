const vscode = require("vscode");
const utils = require("./utils");
const hr = require("./hoverRenderer");

class TokenHoverProvider {
	constructor(tokenResolver, config) {
		this.tokenResolver = tokenResolver;
		this.config = config;
		this.icons = utils.icons;
	}

	provideHover(document, position) {
		const range = document.getWordRangeAtPosition(position, /{[^}]+}/);
		if (!range) return null;

		const tokenRef = document.getText(range);
		const resolved = this.tokenResolver.resolveToken(tokenRef);
		if (!resolved) return null;

		const md = new vscode.MarkdownString();
		md.isTrusted = true;

		let content = "";

		// --- Result
		content += `## Result\n\n`;

		if (resolved.props) {
			for (const [prop, data] of Object.entries(resolved.props)) {
				if (data.type === "boxShadow") {
					content += hr.renderBoxShadowGroup(prop, data.props);
				} else if (data.props) {
					content += hr.renderComplexTable(prop, data.props, "result");
				} else if (data.value !== undefined) {
					content += `- **${prop}**: \`${data.value}\` → ${data.result}\n`;
				}
			}
		} else {
			if (resolved.type === "color" && resolved.finalValue?.startsWith("#")) {
				content += utils.getColorPreview(resolved.finalValue) + "\n\n";
			}
			content += `- ${resolved.finalValue}\n`;
		}

		// --- Source
		content += `\n## Source\n\n`;

		if (resolved.props) {
			for (const [prop, data] of Object.entries(resolved.props)) {
				if (data.type === "boxShadow") continue; // already rendered
				if (data.props) {
					content += hr.renderComplexTable(prop, data.props, "source");
				} else if (data.chain) {
					content += `- **${prop}**: ${data.chain.includes("⚠️") ? "⚠️ " : ""}${data.chain}\n`;
				}
			}
		} else {
			const path = this.tokenResolver.getResolutionPath(tokenRef.replace(/[{}]/g, ""));
			content += hr.renderSimpleChainTable(path, this.icons, this.config);
		}

		md.appendMarkdown(content);
		return new vscode.Hover(md, range);
	}
}

module.exports = TokenHoverProvider;