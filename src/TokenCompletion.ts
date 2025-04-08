import * as vscode from "vscode";
import * as jsonc from "jsonc-parser";
import { findNearestType, getColorPreview, renderChain } from "./utils";
import { icons as defaultIcons } from "./constants";

export interface TokenData {
	value: string;
	result: string;
	chain: string;
	type?: string;
}

export interface TokenResolution {
	finalValue?: string;
	props?: Record<string, TokenData>;
	chain?: string;
	type: string;
	extensions?: any;
}

export interface TokenDefinition {
	value: any;
	type?: string;
	file?: string;
	extensions?: any;
	props?: any;
}

export interface TokenResolver {
	mapping: Record<string, TokenDefinition>;
	resolveToken(tokenRef: string): TokenResolution;
}

export interface ExtensionConfig {
	inheritanceStyle?: string;
	maxSuggestions?: number;
	showIcons?: boolean;
	[key: string]: any;
}

export class TokenCompletion implements vscode.CompletionItemProvider {
	tokenResolver: TokenResolver;
	config: ExtensionConfig;
	inheritanceStyle: string;
	maxSuggestions: number;

	constructor(tokenResolver: TokenResolver, config: ExtensionConfig) {
		this.tokenResolver = tokenResolver;
		this.config = config;
		this.inheritanceStyle = config.inheritanceStyle || "compact";
		this.maxSuggestions = config.maxSuggestions || 300;
	}

	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.CompletionItem[]> {
		const line = document.lineAt(position).text;
		if (!line.includes('"$value"')) return;

		const index = line.lastIndexOf("{", position.character);
		if (index === -1) return;

		// Текст после открытой фигурной скобки, который уже набран
		const prefix = line.substring(index + 1, position.character);
		const rootNode = jsonc.parseTree(document.getText());
		if (!rootNode) return;

		const node = jsonc.findNodeAtOffset(rootNode, document.offsetAt(position));
		if (!node) return;

		const detectedType = findNearestType(node);
		const items: vscode.CompletionItem[] = [];

		// Текущий диапазон для замены (без открывающей скобки)
		const tokenStart = new vscode.Position(position.line, index + 1);
		const tokenRange = new vscode.Range(tokenStart, position);

		for (const [key, def] of Object.entries(this.tokenResolver.mapping)) {
			if (items.length >= this.maxSuggestions) break;
			if (!key.startsWith(prefix)) continue;
			if (detectedType && def.type && def.type !== detectedType) continue;

			const resolved = this.tokenResolver.resolveToken(`{${key}}`);
			const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Value);
			// Если уже набрана открывающая фигурная скобка – вставляем только token и закрывающую скобку
			item.insertText = new vscode.SnippetString(`${key}}`);
			item.range = tokenRange;

			const md = new vscode.MarkdownString("", true);
			md.isTrusted = true;

			let content = "";
			// Заголовок для блока Result с иконкой (если включены)
			if (this.config.showIcons !== false && resolved.type && defaultIcons[resolved.type]) {
				content += "### " + defaultIcons[resolved.type] + " Result\n\n";
			} else {
				content += "### Result\n\n";
			}

			// Превью для цветовых токенов
			if (resolved.type === "color" && resolved.finalValue && resolved.finalValue.startsWith("#")) {
				content += getColorPreview(resolved.finalValue) + "\n\n";
			}

			content += "#### Details\n\n";
			if (resolved.props) {
				for (const [prop, data] of Object.entries(resolved.props)) {
					const tokenData = data as TokenData;
					content += `- **${prop}**: ${tokenData.result} ${tokenData.value}\n`;
				}
			} else {
				content += `- ${resolved.finalValue}\n`;
			}

			// Разделитель между блоками Result и Source (используем Markdown горизонтальную линию)
			content += "\n\n---\n\n";
			content += "### Source\n\n";
			if (resolved.props) {
				for (const [prop, data] of Object.entries(resolved.props)) {
					const tokenData = data as TokenData;
					content += `- **${prop}**: ${tokenData.value} → ${tokenData.chain}\n`;
				}
			} else {
				content += renderChain(resolved.chain || "", this.tokenResolver.mapping, this.config);
			}

			item.detail = resolved.finalValue || "Token";
			md.appendMarkdown(content);
			item.documentation = md;
			items.push(item);
		}

		return items;
	}
}
