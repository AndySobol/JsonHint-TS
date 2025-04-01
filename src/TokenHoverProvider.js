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

		let content = "## Result\n\n";

		// Processing color modifier (alpha)
		if (resolved.extensions && resolved.extensions["studio.tokens"] && resolved.extensions["studio.tokens"].modify) {
			const modObj = resolved.extensions["studio.tokens"].modify;
			let modifiers = [];
			if (modObj.type && modObj.value) {
				// Get transparency value from token
				const alphaTokenResolved = this.tokenResolver.resolveToken(modObj.value);
				// Convert a decimal value (e.g. "0.04") to a percentage. I'm so tired at this stage. =))
				const numericAlpha = Math.round(parseFloat(alphaTokenResolved.finalValue) * 100);
				modifiers.push(`${modObj.type}(${numericAlpha}%)`);
			}
			const baseColor = resolved.finalValue;
			const modifiedColor = utils.applyColorModifiers(baseColor, modifiers);
			content += utils.getColorModifiersPreview(modifiedColor, modifiers) + "\n\n";
			content += `${modifiedColor}\n\n`;
		} else if (resolved.finalValue && typeof resolved.finalValue === "string" && resolved.finalValue.startsWith("linear-gradient(")) {
			// If it is a gradient, generate a preview for the gradient
			content += utils.getGradientPreview(resolved.finalValue) + "\n\n";
			content += `${resolved.finalValue}\n\n`;
		} else if (resolved.type === "color" && resolved.finalValue && resolved.finalValue.startsWith("#")) {
			content += utils.getColorPreview(resolved.finalValue) + "\n\n";
		} else {
			content += `- ${resolved.finalValue}\n`;
		}

		// Source display (token chain)
		if (resolved.props) {
			for (const [prop, data] of Object.entries(resolved.props)) {
				if (data.type === "boxShadow") {
					content += hr.renderBoxShadowGroup(prop, data.props);
				} else if (data.props) {
					content += hr.renderComplexTable(prop, data.props, "result");
				} else if (data.value !== undefined) {
					content += `- **${prop}**: ${data.value} → ${data.result}\n`;
				}
			}
		}
		content += "\n## Source\n\n";
		if (resolved.props) {
			for (const [prop, data] of Object.entries(resolved.props)) {
				if (data.type === "boxShadow") continue;
				if (data.props) {
					content += hr.renderComplexTable(prop, data.props, "source");
				} else if (data.chain) {
					content += `- **${prop}**: ${data.chain.includes("⚠️") ? "⚠️ " : ""}${data.chain}\n`;
				}
			}
		} else {
			const pathChain = this.tokenResolver.getResolutionPath(tokenRef.replace(/[{}]/g, ""));
			content += hr.renderSimpleChainTable(pathChain, this.icons, this.config);
		}

		md.appendMarkdown(content);
		return new vscode.Hover(md, range);
	}
}

module.exports = TokenHoverProvider;