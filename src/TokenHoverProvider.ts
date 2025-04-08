import * as vscode from "vscode";
import { getFontPreview } from "./utils";
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

// Удобная функция для бэйджа
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
		this.icons = { ...defaultIcons };
	}

	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
		const range = document.getWordRangeAtPosition(position, /{[^}]+}/);
		if (!range) return null;

		const tokenRef = document.getText(range);
		const resolved = this.tokenResolver.resolveToken(tokenRef);
		if (!resolved) return null;

		const md = new vscode.MarkdownString("", true);
		md.isTrusted = true;

		let content = "";

		// -----------------------------
		// 1) boxShadow — особый случай
		// -----------------------------
		if (resolved.type === "boxShadow" && resolved.props) {
			if (this.config.showIcons !== false && this.icons["boxShadow"]) {
				content += `## ${this.icons["boxShadow"]} Result\n\n`;
			} else {
				content += "## Result\n\n";
			}
			content += "Details:\n\n";

			const boxShadowProps = resolved.props as Record<string, any>;
			content += hr.renderBoxShadowGroup("Box Shadow", boxShadowProps, resolved.file, resolved._originalTokenKey, "result");

			content += "\n\n---\n\n";
			content += "## Source\n\n";
			content += hr.renderBoxShadowGroup("Box Shadow", boxShadowProps, resolved.file, resolved._originalTokenKey, "source");

			md.appendMarkdown(content);
			return new vscode.Hover(md, range);
		}

		// ------------------------------
		// 2) typography (особый заголовок + Aa)
		// ------------------------------
		if (resolved.type === "typography" && resolved.props) {
			// Заголовок "🔤 Result"
			if (this.config.showIcons !== false && this.icons["typography"]) {
				content += `## ${this.icons["typography"]} Result\n\n`;
			} else {
				content += "## Result\n\n";
			}

			// Превью "Aa"
			const props = resolved.props as Record<string, any>;
			const fontFamily = props.fontFamily ? props.fontFamily.result || props.fontFamily.value : "inherit";
			const fontWeight = props.fontWeight ? props.fontWeight.result || props.fontWeight.value : "normal";
			const fontSize = props.fontSize ? props.fontSize.result || props.fontSize.value : "14px";
			const lineHeight = props.lineHeight ? props.lineHeight.result || props.lineHeight.value : "normal";
			const textDecoration = props.textDecoration ? props.textDecoration.result || props.textDecoration.value : "none";
			const textCase = props.textCase ? props.textCase.result || props.textCase.value : "none";

			const preview = getFontPreview(fontFamily, fontWeight, fontSize, lineHeight, textDecoration, textCase);
			content += `${preview}\n\n`;

			// Go Variable
			if (resolved.file && resolved._originalTokenKey) {
				const args = encodeURIComponent(JSON.stringify([{ file: resolved.file, token: resolved._originalTokenKey }]));
				content += `[Go Variable](command:jsonhintTs.revealToken?${args})\n\n`;
			}

			content += "**Result (computed values):**\n\n";
			for (const [prop, data] of Object.entries(props)) {
				const originalValue = data.value || "";
				const resultValue = data.result || "N/A";
				content += `- **${prop}**: ${originalValue} → ${wrapBadge(resultValue)}\n`;
			}

			content += "\n\n---\n\n";
			content += "## Source\n\n";
			for (const [prop, data] of Object.entries(props)) {
				if (data.chain) {
					content += `- **${prop}**: ${data.value} → ${data.chain}\n`;
				} else {
					content += `- **${prop}**: ${data.value}\n`;
				}
			}

			md.appendMarkdown(content);
			return new vscode.Hover(md, range);
		}

		// ------------------------------------------------
		// 3) composition, border (и т.д.)
		// ------------------------------------------------
		const complexTypes = ["composition", "border"];
		if (complexTypes.includes(resolved.type) && resolved.props) {
			let iconLabel = resolved.type;
			if (this.config.showIcons !== false && this.icons[resolved.type]) {
				iconLabel = `${this.icons[resolved.type]} Result`;
			} else {
				iconLabel = "Result";
			}
			content += `## ${iconLabel}\n\n`;

			// Go Variable
			if (resolved.file && resolved._originalTokenKey) {
				const args = encodeURIComponent(JSON.stringify([{ file: resolved.file, token: resolved._originalTokenKey }]));
				content += `[Go Variable](command:jsonhintTs.revealToken?${args})\n\n`;
			}

			content += "**Result (computed values):**\n\n";
			const props = resolved.props as Record<string, any>;
			for (const [prop, data] of Object.entries(props)) {
				const originalValue = data.value || "";
				const resultValue = data.result || "N/A";
				content += `- **${prop}**: ${originalValue} → ${wrapBadge(resultValue)}\n`;
			}

			content += "\n\n---\n\n";
			content += "## Source\n\n";
			for (const [prop, data] of Object.entries(props)) {
				if (data.chain) {
					content += `- **${prop}**: ${data.value} → ${data.chain}\n`;
				} else {
					content += `- **${prop}**: ${data.value}\n`;
				}
			}

			md.appendMarkdown(content);
			return new vscode.Hover(md, range);
		}

		// ------------------------------------------------
		// 4) Прочие (color, number, text, etc.)
		// ------------------------------------------------
		if (this.config.showIcons !== false && resolved.type && this.icons[resolved.type]) {
			content += `## ${this.icons[resolved.type]} Result\n\n`;
		} else {
			content += "## Result\n\n";
		}

		// Если это цвет
		if (resolved.type === "color" && resolved.finalValue && resolved.finalValue.startsWith("#")) {
			// Для цветных токенов показываем только цвет-превью
			const { getColorPreview } = require("./utils");
			content += `${getColorPreview(resolved.finalValue)}\n\n`;
		}

		// Отображаем finalValue (если есть)
		if (resolved.finalValue !== undefined) {
			content += `- ${resolved.finalValue}\n\n`;
		}

		if (resolved.props) {
			content += "**Details:**\n\n";
			const props = resolved.props as Record<string, any>;
			for (const [prop, data] of Object.entries(props)) {
				const originalValue = data.value || "";
				const resultValue = data.result || "N/A";
				content += `- **${prop}**: ${originalValue} → ${wrapBadge(resultValue)}\n`;
			}
		}

		content += "\n\n---\n\n";
		content += "## Source\n\n";

		if (resolved.props) {
			const props = resolved.props as Record<string, any>;
			for (const [prop, data] of Object.entries(props)) {
				if (data.chain) {
					content += `- **${prop}**: ${data.value} → ${data.chain}\n`;
				} else {
					content += `- **${prop}**: ${data.value}\n`;
				}
			}
		} else {
			// Просто цепочка
			const tokenKey = tokenRef.replace(/[{}]/g, "");
			const resolutionPath = this.tokenResolver.getResolutionPath(tokenKey);
			content += hr.renderSimpleChainTable(resolutionPath, this.icons, this.config);
		}

		md.appendMarkdown(content);
		return new vscode.Hover(md, range);
	}
}
