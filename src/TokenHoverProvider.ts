import * as vscode from "vscode";
import { renderChain, getFontPreview } from "./utils"; // getFontPreview – для превью шрифта
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

// Оборачиваем текст в inline-code для бейджа (используется в Details)
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
		// Копируем иконки из constants
		this.icons = { ...defaultIcons };
	}

	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
		const range = document.getWordRangeAtPosition(position, /{[^}]+}/);
		if (!range) return null;

		const tokenRef = document.getText(range);
		const resolved = this.tokenResolver.resolveToken(tokenRef);
		if (!resolved) return null;

		// Создаем MarkdownString с разрешением HTML (isTrusted = true)
		const md = new vscode.MarkdownString("", true);
		md.isTrusted = true;

		let content = "";
		// Если токен типа boxShadow – выводим две секции отдельно
		if (resolved.type === "boxShadow" && resolved.props) {
			// Секция Result с заголовком: "## <иконка> Result"
			content += "## " + this.icons["boxShadow"] + " Result\n\n";
			content += "Details:\n\n";
			content += hr.renderBoxShadowGroup("Box Shadow", resolved.props, resolved.file, "result");
			// Разделитель между блоками Result и Source (Markdown горизонтальная линия)
			content += "\n\n---\n\n";
			content += "## Source\n\n";
			content += hr.renderBoxShadowGroup("Box Shadow", resolved.props, resolved.file, "source");
		} else {
			// Для остальных токенов: если включены иконки – выводим их в заголовке
			if (this.config.showIcons !== false && resolved.type && this.icons[resolved.type]) {
				content += "## " + this.icons[resolved.type] + " Result\n\n";
			} else {
				content += "## Result\n\n";
			}

			// Цветовые токены: показываем превью цвета
			if (resolved.type === "color" && resolved.finalValue && resolved.finalValue.startsWith("#")) {
				const { getColorPreview } = require("./utils");
				content += `${getColorPreview(resolved.finalValue)}\n\n`;
			}

			// Типографические токены: генерируем превью шрифта
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

			// Остальные токены – выводим итоговое значение
			if (resolved.finalValue !== undefined && resolved.type !== "typography" && resolved.type !== "color") {
				content += `- ${resolved.finalValue}\n\n`;
			}

			// Раздел Details – вывод для каждого свойства
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

			// Разделитель между блоком Result и блоком Source
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
