import * as vscode from "vscode";
import * as path from "path";
import { icons } from "./constants";

/**
 * Renders a table-like view, where each row contains the specified columns.
 */
export function renderTableLike(rows: any[], columns: string[]): string {
	return rows.map((row: any) => columns.map((col: string) => `**${col}**: ${row[col] || "-"}`).join(" | ")).join("\n\n") + "\n";
}

/**
 * Renders a complex table for structured objects (e.g. typography).
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
 * Renders a boxShadow group.
 * If parentFile is provided, a clickable "Go Variable" link is shown.
 * Each property is displayed on a new line in the format:
 *   <name>: {token} → <value>   (if mode == "result")
 * or
 *   <name>: {token} → <chain>   (if mode == "source")
 * Groups are separated by a divider (line of dashes).
 */
export function renderBoxShadowGroup(propName: string, props: Record<string, any>, parentFile?: string, mode: "result" | "source" = "result"): string {
	// Group properties by shadow group (based on the number before the first dot)
	const groups: Record<string, Record<string, any>> = {};
	Object.keys(props).forEach((key) => {
		const parts = key.split(".");
		const group = parts[0];
		const subProp = parts.slice(1).join(".");
		if (!groups[group]) {
			groups[group] = {};
		}
		groups[group][subProp] = props[key];
	});
	// If parentFile is provided, create a "Go Variable" link
	let header = "";
	if (parentFile) {
		const fileName = parentFile.split("/").pop() || parentFile;
		const args = encodeURIComponent(JSON.stringify([{ file: parentFile, token: "" }]));
		header = ` ([Go Variable](command:jsonhintTs.revealToken?${args}))`;
	}
	const groupKeys = Object.keys(groups).sort();
	let result = `**${propName}**${header}\n\n`;
	groupKeys.forEach((groupKey, index) => {
		const groupProps = groups[groupKey];
		// Render each property on a new line (two trailing spaces force line break)
		Object.keys(groupProps).forEach((subProp) => {
			const item = groupProps[subProp];
			const display = mode === "source" ? item.chain : item.result;
			result += `${subProp}: ${item.value} → ${display}  \n`;
		});
		if (index < groupKeys.length - 1) {
			result += "\n____________\n\n";
		}
	});
	return result;
}

/**
 * Renders the token resolution chain as clickable links.
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
				const tokenLink = `[${step.token}](command:jsonhintTs.revealToken?${args})`;
				const relativeFile = step.file.split("/").pop();
				return `${tokenLink} → ${relativeFile}`;
			})
			.join("\n\n") + "\n"
	);
}