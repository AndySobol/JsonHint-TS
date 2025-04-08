import * as vscode from "vscode";
import * as path from "path";
import { icons } from "./constants";

/**
 * Рендерит табличное представление, где каждая строка содержит указанные столбцы.
 */
export function renderTableLike(rows: any[], columns: string[]): string {
	return rows.map((row: any) => columns.map((col: string) => `**${col}**: ${row[col] || "-"}`).join(" | ")).join("\n\n") + "\n";
}

/**
 * Рендерит комплексную таблицу для сложных объектов (например, для typography).
 */
export function renderComplexTable(propName: string, props: Record<string, any>, mode: "result" | "source" = "result"): string {
	const rows = Object.entries(props).map(([subProp, subData]: [string, any]) =>
		mode === "result"
			? {
					Property: subProp,
					Value: subData.value,
					Resolved: subData.result,
			  }
			: {
					Property: subProp,
					Chain: subData.chain || "-",
			  }
	);
	const columns = mode === "result" ? ["Property", "Value", "Resolved"] : ["Property", "Chain"];
	return `---\n\n**${propName}**\n\n${renderTableLike(rows, columns)}`;
}

/**
 * Рендерит группу теней (boxShadow).
 * Если передан parentFile, выводится кликабельная ссылка «Go Variable».
 * Для каждого свойства выводится строка вида:
 *    <имя>: {токен} → <значение>  (если mode == "result")
 * или
 *    <имя>: {токен} → <цепочка> (если mode == "source")
 * Группы разделяются строкой из подчёркиваний.
 */
export function renderBoxShadowGroup(propName: string, props: Record<string, any>, parentFile?: string, mode: "result" | "source" = "result"): string {
	// Группируем свойства по индексу теней (до первой точки)
	const groups: Record<string, Record<string, any>> = {};
	Object.keys(props).forEach((key) => {
		const parts = key.split(".");
		// Первый элемент – номер группы, остальные – имя свойства
		const group = parts[0];
		const subProp = parts.slice(1).join(".");
		if (!groups[group]) {
			groups[group] = {};
		}
		groups[group][subProp] = props[key];
	});
	// Если указан родительский файл, формируем ссылку "Go Variable"
	let header = "";
	if (parentFile) {
		const fileName = parentFile.split("/").pop() || parentFile;
		const args = encodeURIComponent(JSON.stringify([{ file: parentFile, token: "" }]));
		header = ` ([Go Variable](command:jsonTokensHint.revealToken?${args}))`;
	}
	const groupKeys = Object.keys(groups).sort();
	let result = `**${propName}**${header}\n\n`;
	groupKeys.forEach((groupKey, index) => {
		const groupProps = groups[groupKey];
		// Для каждой группы выводим каждое свойство в новой строке с принудительным переносом (два пробела перед переносом)
		Object.keys(groupProps).forEach((subProp) => {
			const item = groupProps[subProp];
			const display = mode === "source" ? item.chain : item.result;
			result += `${subProp}: ${item.value} → ${display}  \n`;
		});
		// Если это не последняя группа, добавляем разделитель
		if (index < groupKeys.length - 1) {
			result += "\n____________\n\n";
		}
	});
	return result;
}

/**
 * Рендерит цепочку токена в виде кликабельных ссылок.
 */
export function renderSimpleChainTable(chain: any[], iconsObj: { [key: string]: string }, config: any): string {
	if (!Array.isArray(chain) || chain.length === 0) return "";
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) return "";

	const seen = new Set<string>();
	return (
		chain
			.filter((step: any) => {
				if (seen.has(step.token)) return false;
				seen.add(step.token);
				return true;
			})
			.map((step: any) => {
				const workspaceFolder = vscode.workspace.workspaceFolders![0];
				const absPath = path.join(workspaceFolder.uri.fsPath, "tokens", step.file);
				const args = encodeURIComponent(JSON.stringify([{ file: absPath, token: step.token }]));
				const tokenLink = `[${step.token}](command:jsonTokensHint.revealToken?${args})`;
				const relativeFile = step.file.split("/").pop();
				return `${tokenLink} → ${relativeFile}`;
			})
			.join("\n\n") + "\n"
	);
}
