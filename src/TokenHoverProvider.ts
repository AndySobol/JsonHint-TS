import * as vscode from "vscode";
import { renderChain, getFontPreview } from "./utils"; // getFontPreview for font preview
import * as hr from "./hoverRenderer";
import { icons as defaultIcons } from "./constants";

export interface TokenResolver {
	resolveToken(tokenRef: string): any;
	getResolutionPath(tokenKey: string, visited?: Set<string>): any[];
	mapping: Record<string, any>;
}

export interface ExtensionConfig {
	maxChainLength?: number;
	showIcons?: boolean;
	[key: string]: any;
}

// Wrap text in inline code for badge display
function wrapBadge(text: string): string {
	return `\`${text}\``;
}

export class TokenHoverProvider implements vscode.HoverProvider {
	tokenResolver: TokenResolver;
	config: ExtensionConfig;
	icons: { [key: string]: string };

	constructor(tokenResolver: TokenResolver, config: ExtensionConfig) {
		this.tokenResolver = tokenResolver;
		this.config = config;
		// Copy icons from constants
		this.icons = { ...defaultIcons };
	}

	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
		const range = document.getWordRangeAtPosition(position, /{[^}]+}/);
		if (!range) return null;

		const tokenRef = document.getText(range);
		const resolved = this.tokenResolver.resolveToken(tokenRef);
		if (!resolved) return null;

		// Create a MarkdownString with trusted HTML
		const md = new vscode.MarkdownString("", true);
		md.isTrusted = true;

		let content = "";
		// For boxShadow tokens, render two separate sections
		if (resolved.type === "boxShadow" && resolved.props) {
			// Result section with title "## <icon> Result"
			content += "## " + this.icons["boxShadow"] + " Result\n\n";
			content += "Details:\n\n";
			content += hr.renderBoxShadowGroup("Box Shadow", resolved.props, resolved.file, "result");
			// Divider between Result and Source blocks (using Markdown divider)
			content += "\n\n---\n\n";
			content += "## Source\n\n";
			content += hr.renderBoxShadowGroup("Box Shadow", resolved.props, resolved.file, "source");
		} else {
			// For other tokens, render standard display with icon in header if enabled
			if (this.config.showIcons !== false && resolved.type && this.icons[resolved.type]) {
				content += "## " + this.icons[resolved.type] + " Result\n\n";
			} else {
				content += "## Result\n\n";
			}

			// For color tokens, show color preview
			if (resolved.type === "color" && resolved.finalValue && resolved.finalValue.startsWith("#")) {
				const { getColorPreview } = require("./utils");
				content += `${getColorPreview(resolved.finalValue)}\n\n`;
			}

			// For typography tokens, generate a font preview
			if (resolved.type === "typography" && resolved.props) {
				const fontFamily = resolved.props.fontFamily ? resolved.props.fontFamily.result || resolved.props.fontFamily.value : "inherit";
				const fontWeight = resolved.props.fontWeight ? resolved.props.fontWeight.result || resolved.props.fontWeight.value : "normal";
				const fontSize = resolved.props.fontSize ? resolved.props.fontSize.result || resolved.props.fontSize.value : "14px";
				const lineHeight = resolved.props.lineHeight ? resolved.props.lineHeight.result || resolved.props.lineHeight.value : "normal";
				const textDecoration = resolved.props.textDecoration ? resolved.props.textDecoration.result || resolved.props.textDecoration.value : "none";
				const textCase = resolved.props.textCase ? resolved.props.textCase.result || resolved.props.textCase.value : "none";

				const preview = getFontPreview(fontFamily, fontWeight, fontSize, lineHeight, textDecoration, textCase);
				content += `${preview}\n\n`;
			}

			// For other tokens, display the final value
			if (resolved.finalValue !== undefined && resolved.type !== "typography" && resolved.type !== "color") {
				content += `- ${resolved.finalValue}\n\n`;
			}

			// Details section for each property
			if (resolved.props) {
				content += "**Details:**\n\n";
				for (const [prop, data] of Object.entries(resolved.props)) {
					const tokenData = data as any;
					if (tokenData.type === "boxShadow" && tokenData.props) {
						content += hr.renderBoxShadowGroup(prop, tokenData.props, resolved.file, "result");
					} else {
						const originalValue = tokenData.value || "";
						const resultValue = tokenData.result || "N/A";
						const computedBadge = wrapBadge(resultValue);
						content += `- **${prop}**: ${originalValue} → ${computedBadge}\n`;
					}
				}
			}

			// Divider between Result and Source
			content += "\n\n---\n\n";
			content += "## Source\n\n";
			if (resolved.props) {
				for (const [prop, data] of Object.entries(resolved.props)) {
					const tokenData = data as any;
					if (tokenData.type === "boxShadow" && tokenData.props) {
						content += hr.renderBoxShadowGroup(prop, tokenData.props, resolved.file, "source");
					} else if (tokenData.chain) {
						content += `- **${prop}**: ${tokenData.value} → ${tokenData.chain}\n`;
					} else {
						content += `- **${prop}**: ${tokenData.value}\n`;
					}
				}
			} else {
				const tokenKey = tokenRef.replace(/[{}]/g, "");
				const resolutionPath = this.tokenResolver.getResolutionPath(tokenKey);
				content += hr.renderSimpleChainTable(resolutionPath, this.icons, this.config);
			}
		}

		md.appendMarkdown(content);
		return new vscode.Hover(md, range);
	}
}