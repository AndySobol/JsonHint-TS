"use strict";

const path = require("path");
const fs = require("fs").promises;
const { create, all } = require("mathjs");
const { validTypes } = require("./constants");

const math = create(all);
math.import({ px: 1, em: 1, rem: 1, "%": 1, deg: 1, s: 1 }, { override: true });

function flattenTokens(obj, prefix, file, mapping, inheritedType = null, allowNoDollar = true) {
	for (const key in obj) {
		if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
		if (key === "$type" || (allowNoDollar && key === "type")) continue;
		const value = obj[key];
		const newKey = prefix ? `${prefix}.${key}` : key;

		if (typeof value === "object" && value !== null && !("$value" in value || (allowNoDollar && "value" in value))) {
			const currentInherited = value.$type || (allowNoDollar && value.type) || inheritedType;
			flattenTokens(value, newKey, file, mapping, currentInherited, allowNoDollar);
		} else if (typeof value === "object" && value !== null && ("$value" in value || (allowNoDollar && "value" in value))) {
			mapping[newKey] = {
				value: value.$value || (allowNoDollar ? value.value : undefined),
				type: value.$type || (allowNoDollar ? value.type : undefined) || inheritedType || "text",
				file,
			};
		}
	}
}

// --- Token Resolver
class TokenResolver {
	constructor(tokensDir, config) {
		this.tokensDir = tokensDir;
		this.config = config;
		this.mapping = {};
		this.chainCache = new Map();
		this.resolveCache = new Map();
	}

	async loadTokens() {
		this.mapping = {};
		this.chainCache.clear();
		this.resolveCache.clear();
		await this._walk(this.tokensDir);
		console.log(`[JsonHint-TS] Loaded ${Object.keys(this.mapping).length} tokens`);
	}

	async _walk(dir) {
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });
			for (const entry of entries) {
				const filePath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					await this._walk(filePath);
				} else if (entry.isFile() && filePath.endsWith(".json")) {
					await this._parseFile(filePath);
				}
			}
		} catch (e) {
			console.error(`[JsonHint-TS] Error reading directory ${dir}:`, e);
		}
	}

	async _parseFile(filePath) {
		try {
			console.log(`[JsonHint-TS] Processing file: ${filePath}`);
			const contentStr = await fs.readFile(filePath, "utf-8");
			const json = JSON.parse(contentStr);
			const relPath = path.relative(this.tokensDir, filePath);
			flattenTokens(json, "", relPath, this.mapping, null, this.config.allowNoDollar !== false);
		} catch (e) {
			console.error(`[JsonHint-TS] Error parsing file ${filePath}:`, e);
		}
	}

	calculate(tokenKey) {
		const def = this.mapping[tokenKey];
		if (!def) return `{${tokenKey}}`;

		const expr = this.resolveAll(def.value).trim();
		const numericTypes = ["sizing", "fontSizes", "spacing", "borderRadius", "borderWidth", "dimension", "number"];

		if (numericTypes.includes(def.type)) {
			if (/^-?\d+(\.\d+)?(px|em|rem|%)?$/.test(expr)) return expr;
			try {
				const result = math.evaluate(expr);
				return result + (def.unit || (def.type === "number" ? "" : "px"));
			} catch (e) {
				console.error(`[JsonHint-TS] Math error in token ${tokenKey}:`, e);
				return expr;
			}
		}

		return expr;
	}

	resolveAll(str) {
		let prev = "";
		let iterations = 0;
		while (str !== prev && iterations < 20) {
			prev = str;
			str = str.replace(/{([^}]+)}/g, (_, tokenKey) => {
				if (!this.mapping[tokenKey]) return `{${tokenKey}}`;
				return this.mapping[tokenKey].value || `{${tokenKey}}`;
			});
			iterations++;
		}
		if (iterations === 20) {
			str += " ⚠️ (Циклическая зависимость обнаружена)";
		}
		return str;
	}

	getResolutionChain(tokenKey, visited = new Set()) {
		if (this.chainCache.has(tokenKey)) return this.chainCache.get(tokenKey);
		if (visited.has(tokenKey)) return "⚠️ Cycle";

		visited.add(tokenKey);
		const def = this.mapping[tokenKey];
		if (!def) return null;

		const fileUri = `file://${path.join(this.tokensDir, def.file)}`;
		const tokenLink = `[${tokenKey}](${fileUri})`;

		if (!/{([^}]+)}/.test(def.value)) {
			this.chainCache.set(tokenKey, tokenLink);
			return tokenLink;
		}

		const innerChain = def.value.replace(/{([^}]+)}/g, (_, innerKey) => this.getResolutionChain(innerKey, visited) || `{${innerKey}}`);
		const result = `${tokenLink} → ${innerChain}`;
		this.chainCache.set(tokenKey, result);
		return result;
	}

	resolveToken(tokenRef) {
		if (this.resolveCache.has(tokenRef)) return this.resolveCache.get(tokenRef);

		let tokenKey = tokenRef.replace(/[{}]/g, "");
		const visited = new Set();

		while (true) {
			const def = this.mapping[tokenKey];
			if (!def || typeof def.value !== "string" || !def.value.startsWith("{")) break;
			if (visited.has(tokenKey)) break;
			visited.add(tokenKey);
			tokenKey = def.value.replace(/[{}]/g, "");
		}

		const def = this.mapping[tokenKey];
		if (!def) {
			const result = { finalValue: tokenRef, type: "unknown" };
			this.resolveCache.set(tokenRef, result);
			return result;
		}

		const { type, value } = def;
		let resolved;
		if (type === "composition" && typeof value === "object") {
			const props = {};
			for (const [prop, propVal] of Object.entries(value)) {
				if (typeof propVal !== "string" || !propVal.startsWith("{")) continue;
				const nestedTokenKey = propVal.replace(/[{}]/g, "");
				const nestedDef = this.mapping[nestedTokenKey];
				if (!nestedDef) continue;
				props[prop] = {
					value: propVal,
					result: this.calculate(nestedTokenKey),
					chain: this.getResolutionChain(nestedTokenKey),
					type: nestedDef.type,
				};
			}
			resolved = { type, props };
		} else if (type === "typography" && typeof value === "object") {
			const props = {};
			for (const [prop, propVal] of Object.entries(value)) {
				if (typeof propVal !== "string" || !propVal.startsWith("{")) continue;
				const propTokenKey = propVal.replace(/[{}]/g, "");
				props[prop] = {
					value: propVal,
					result: this.calculate(propTokenKey),
					chain: this.getResolutionChain(propTokenKey),
					type: this.mapping[propTokenKey]?.type || "text",
				};
			}
			resolved = { type, props };
		} else if (type === "boxShadow" && Array.isArray(value)) {
			const props = {};
			value.forEach((shadow, idx) => {
				for (const [prop, propVal] of Object.entries(shadow)) {
					if (typeof propVal !== "string" || !propVal.startsWith("{")) return;
					const propTokenKey = propVal.replace(/[{}]/g, "");
					props[`${idx + 1}.${prop}`] = {
						value: propVal,
						result: this.calculate(propTokenKey),
						chain: this.getResolutionChain(propTokenKey),
					};
				}
			});
			resolved = { type, props };
		} else {
			resolved = { finalValue: this.calculate(tokenKey), chain: this.getResolutionChain(tokenKey), type };
		}

		this.resolveCache.set(tokenRef, resolved);
		return resolved;
	}

	getResolutionPath(tokenKey, visited = new Set()) {
		if (visited.has(tokenKey)) return [];
		visited.add(tokenKey);
		const def = this.mapping[tokenKey];
		if (!def) return [];
		const step = { token: tokenKey, file: def.file, type: def.type || "unknown" };
		if (!/{([^}]+)}/.test(def.value)) return [step];
		return [step, ...Array.from(def.value.matchAll(/{([^}]+)}/g)).flatMap(([, innerKey]) => this.getResolutionPath(innerKey, visited))];
	}
}

module.exports = TokenResolver;
module.exports.flattenTokens = flattenTokens;