const vscode = require("vscode");
const jsonc = require("jsonc-parser");
const { icons, validTypes } = require("./constants");

// --- Color utils ---

function isColor(value) {
	return /^#([0-9A-Fa-f]{3,8})$/.test(value);
}

function adjustColor(hex, action, percent) {
	if (!/^#([0-9A-Fa-f]{3,8})$/.test(hex)) return hex;
	const parse = (h) => parseInt(h.repeat(2 / h.length), 16);
	const [r, g, b] = [1, 3, 5].map((i) => parse(hex.slice(i, i + 2 / (hex.length > 5 ? 1 : 2))));
	const adjustment = Math.round(255 * (percent / 100));

	const apply = (c) => {
		if (action === "lighten") return Math.min(255, c + adjustment);
		if (action === "darken") return Math.max(0, c - adjustment);
		return c;
	};

	const toHex = (c) => ("0" + c.toString(16)).slice(-2);

	return `#${toHex(apply(r))}${toHex(apply(g))}${toHex(apply(b))}`;
}

function applyColorModifiers(color, modifiers) {
	let modifiedColor = color;
	if (!Array.isArray(modifiers)) return modifiedColor;
	modifiers.forEach((mod) => {
		const match = mod.match(/(lighten|darken)\((\d+)%\)/);
		if (match) {
			const action = match[1];
			const amount = parseInt(match[2], 10);
			modifiedColor = adjustColor(modifiedColor, action, amount);
		}
	});
	return modifiedColor;
}

// --- Token utils ---

function isComplexType(type, config) {
	return config.complexTypes.includes(type);
}

function findNearestType(node) {
	while (node) {
		const typeNode = jsonc.findNodeAtLocation(node, ["$type"]);
		if (typeNode && typeof typeNode.value === "string" && validTypes.has(typeNode.value)) {
			return typeNode.value;
		}
		node = node.parent;
	}
	return null;
}

function isRelevantToken(tokenString, config) {
	return !config.noisyTokens.some((noisy) => tokenString.includes(noisy));
}

// --- Chain Renderer ---

function renderChain(chain, mapping, config) {
	if (!chain) return "";
	const maxLength = config.maxChainLength || 5;

	let parts = chain.split("→").map((s) => s.trim());
	if (parts.length > maxLength) parts = parts.slice(-maxLength);

	const printed = new Set();
	let result = "";

	for (const part of parts) {
		if (!part || printed.has(part)) continue;
		printed.add(part);

		const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
		if (!match) continue;

		const [_, tokenName, fileLink] = match;
		const tokenDef = mapping[tokenName];
		const tokenIcon = config.showIcons ? icons[tokenDef?.type] || "" : "";
		const relativePath = vscode.workspace.asRelativePath(fileLink.replace("file://", ""));

		result += `${tokenIcon} [${tokenName}](${fileLink})   ${relativePath}\n`;
	}

	return result;
}

// --- Color Preview ---

function getColorPreview(colorValue) {
	if (!isColor(colorValue)) return "";
	const size = 14;
	const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="${colorValue}" stroke="#ccc"/></svg>`;
	return `![color](data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")})`;
}

module.exports = {
	isColor,
	adjustColor,
	applyColorModifiers,
	isComplexType,
	findNearestType,
	isRelevantToken,
	renderChain,
	getColorPreview,
	icons,
	validTypes,
};
