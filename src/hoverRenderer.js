const vscode = require("vscode");
const path = require("path");
const { icons } = require("./constants");

function renderTableLike(rows, columns) {
	return rows.map((row) => columns.map((col) => `**${col}**: ${row[col] || "-"}`).join("   |   ")).join("\n\n") + "\n";
}

function renderComplexTable(propName, props, mode = "result") {
	const rows = Object.entries(props).map(([subProp, subData]) =>
		mode === "result"
			? {
					Property: subProp,
					Value: `${subData.value}`,
					Resolved: subData.result,
			  }
			: {
					Property: subProp,
					Chain: subData.chain || "-",
			  }
	);
	return `---\n\n**${propName}**\n\n${renderTableLike(rows, mode === "result" ? ["Property", "Value", "Resolved"] : ["Property", "Chain"])}`;
}

function renderBoxShadowGroup(propName, props) {
	const grouped = Object.keys(props).reduce((acc, key) => {
		const [group, prop] = key.split(".");
		acc[group] ??= {};
		acc[group][prop] = props[key];
		return acc;
	}, {});

	return Object.entries(grouped)
		.map(([groupId, shadowProps]) => {
			const resultRows = Object.entries(shadowProps).map(([subProp, subData]) => ({
				Property: subProp,
				Value: `${subData.value}`,
				Resolved: subData.result,
			}));
			const sourceRows = Object.entries(shadowProps).map(([subProp, subData]) => ({
				Property: subProp,
				Chain: subData.chain || "-",
			}));
			return `---\n\n**${propName} — Shadow #${groupId}**\n\n${renderTableLike(resultRows, ["Property", "Value", "Resolved"])}**Source:**\n\n${renderTableLike(sourceRows, ["Property", "Chain"])}`;
		})
		.join("\n");
}

function renderSimpleChainTable(chain, icons, config) {
	if (!Array.isArray(chain) || chain.length === 0) return "";
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) return "";

	const seen = new Set();
	return (
		chain
			.filter((step) => {
				if (seen.has(step.token)) return false;
				seen.add(step.token);
				return true;
			})
			.map((step) => {
				const icon = config.showIcons ? icons[step.type] || "" : "";
				const workspaceFolder = vscode.workspace.workspaceFolders[0];
				const absPath = path.join(workspaceFolder.uri.fsPath, "tokens", step.file);
				const args = encodeURIComponent(JSON.stringify({ file: absPath, token: step.token }));
				const tokenLink = `[${step.token}](command:jsonTokensHint.revealToken?${args})`;
				const relativeFile = step.file.split("/").slice(-2).join("/");
				return `${icon} ${tokenLink} — ${relativeFile}`;
			})
			.join("\n\n") + "\n"
	);
}

module.exports = {
	renderComplexTable,
	renderBoxShadowGroup,
	renderSimpleChainTable,
};