import * as path from "path";
import * as fs from "fs/promises";
import { create, all } from "mathjs";
import { validTypes } from "./constants";

const math = create(all, {});
math.import({ px: 1, em: 1, rem: 1, "%": 1, deg: 1, s: 1 }, { override: true });

export function flattenTokens(obj: any, prefix: string, file: string, mapping: Record<string, any>, inheritedType: string | null = null, allowNoDollar: boolean = true): void {
	for (const key in obj) {
		if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
		// Skip service fields
		if (key === "$type" || (allowNoDollar && key === "type")) continue;

		const value = obj[key];
		const newKey = prefix ? `${prefix}.${key}` : key;

		if (typeof value === "object" && value !== null) {
			const nextInheritedType = value.$type || (allowNoDollar && value.type) || inheritedType;

			// Leaf token if $value exists
			if ("$value" in value || (allowNoDollar && "value" in value)) {
				mapping[newKey] = {
					value: value.$value || (allowNoDollar ? value.value : undefined),
					type: value.$type || (allowNoDollar ? value.type : undefined) || inheritedType || "text",
					file,
					extensions: value.$extensions || (allowNoDollar ? value.extensions : undefined),
				};
			}
			// Recursion
			flattenTokens(value, newKey, file, mapping, nextInheritedType, allowNoDollar);
		}
	}
}

export class TokenResolver {
	tokensDir: string;
	config: any;
	mapping: Record<string, any>;
	chainCache: Map<string, string>;
	resolveCache: Map<string, any>;

	constructor(tokensDir: string, config: any) {
		this.tokensDir = tokensDir;
		this.config = config;
		this.mapping = {};
		this.chainCache = new Map();
		this.resolveCache = new Map();
	}

	async loadTokens(): Promise<void> {
		this.mapping = {};
		this.chainCache.clear();
		this.resolveCache.clear();
		await this._walk(this.tokensDir);
		console.log(`[jsonhintTs] Loaded ${Object.keys(this.mapping).length} tokens`);
	}

	private async _walk(dir: string): Promise<void> {
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
			console.error(`[jsonhintTs] Error reading directory ${dir}:`, e);
		}
	}

	private async _parseFile(filePath: string): Promise<void> {
		try {
			const contentStr = await fs.readFile(filePath, "utf-8");
			const json = JSON.parse(contentStr);
			const relPath = path.relative(this.tokensDir, filePath);
			flattenTokens(json, "", relPath, this.mapping, null, this.config.allowNoDollar !== false);
		} catch (e) {
			console.error(`[jsonhintTs] Error parsing file ${filePath}:`, e);
		}
	}

	calculate(tokenKey: string): string {
		const def = this.mapping[tokenKey];
		if (!def) return `{${tokenKey}}`;

		let expr = this.resolveAll(def.value).trim();
		const numericTypes = ["sizing", "fontSizes", "spacing", "borderRadius", "borderWidth", "dimension", "number"];
		if (numericTypes.includes(def.type)) {
			if (/^-?\d+(\.\d+)?(px|em|rem|%)?$/.test(expr)) {
				return expr;
			}
			try {
				const result = math.evaluate(expr);
				return result + (def.unit || (def.type === "number" ? "" : "px"));
			} catch (err) {
				console.error(`[jsonhintTs] Math error in token ${tokenKey}:`, err);
				return expr;
			}
		}
		return expr;
	}

	resolveAll(str: string): string {
		let prev = "";
		let iterations = 0;
		while (str !== prev && iterations < 20) {
			prev = str;
			str = str.replace(/{([^}]+)}/g, (_, tokenKey: string) => {
				if (!this.mapping[tokenKey]) return `{${tokenKey}}`;
				return this.mapping[tokenKey].value || `{${tokenKey}}`;
			});
			iterations++;
		}
		if (iterations === 20) {
			str += " ⚠️ (Cyclic dependency detected)";
		}
		return str;
	}

	getResolutionChain(tokenKey: string, visited: Set<string> = new Set()): string {
		if (this.chainCache.has(tokenKey)) {
			return this.chainCache.get(tokenKey)!;
		}
		if (visited.has(tokenKey)) {
			return "⚠️ Cycle";
		}
		visited.add(tokenKey);

		const def = this.mapping[tokenKey];
		if (!def) return "";
		const normalizedFile = def.file ? def.file.replace(/^[/\\]+/, "") : "";
		const fileUri = `file://${path.join(this.tokensDir, normalizedFile)}`;
		const tokenLink = `[${tokenKey}](${fileUri})`;

		// If there are no curly references in the token value, it is an endpoint
		if (!/{([^}]+)}/.test(def.value)) {
			this.chainCache.set(tokenKey, tokenLink);
			return tokenLink;
		}

		// <-- Changed: we lead to RegExpMatchArray[]:
		const matches = Array.from(def.value.matchAll(/{([^}]+)}/g)) as RegExpMatchArray[];

		// Collect chains for each occurrence
		const innerChains = matches.map((m) => {
			// now m is of type RegExpMatchArray
			const innerKey = m[1];
			// For each innerKey call getResolutionChain recursively
			const chainOrFallback = this.getResolutionChain(innerKey, visited) || `{${innerKey}}`;
			return chainOrFallback;
		});

		// Glue them together into one line
		const result = `${tokenLink} → ${innerChains.join(" → ")}`;

		this.chainCache.set(tokenKey, result);
		return result;
	}

	resolveToken(tokenRef: string): any {
		const originalTokenKey = tokenRef.replace(/[{}]/g, "");
		const originalDef = this.mapping[originalTokenKey];
		let tokenKey = originalTokenKey;

		// We go through the chain until the value is a curly link
		const visited = new Set<string>();
		while (true) {
			const def = this.mapping[tokenKey];
			if (!def) break;
			if (typeof def.value !== "string" || !def.value.startsWith("{")) break;
			if (visited.has(tokenKey)) break;
			visited.add(tokenKey);

			// Let's move on to the next key.
			tokenKey = def.value.replace(/[{}]/g, "");
		}

		const def = this.mapping[tokenKey];
		if (!def) {
			// If nothing is found, we return the "stub"
			const fallback = { finalValue: tokenRef, type: "unknown" };
			this.resolveCache.set(tokenRef, fallback);
			return fallback;
		}

		const { type, value } = def;
		const normalizedFile = def.file ? def.file.replace(/^[/\\]+/, "") : "";

		let resolved: any;

		// --- boxShadow ---
		if (type === "boxShadow" && Array.isArray(value)) {
			const props: Record<string, any> = {};
			value.forEach((shadow: any, idx: number) => {
				for (const [prop, propVal] of Object.entries(shadow)) {
					if (typeof propVal !== "string" || !propVal.startsWith("{")) {
						continue;
					}
					const propTokenKey = propVal.replace(/[{}]/g, "");
					props[`${idx + 1}.${prop}`] = {
						value: propVal,
						result: this.calculate(propTokenKey),
						chain: this.getResolutionChain(propTokenKey),
					};
				}
			});
			resolved = {
				type,
				props,
				// we take the file from the original definition so that Go Variable points there
				file: originalDef?.file ? originalDef.file.replace(/^[/\\]+/, "") : normalizedFile,
			};

			// --- composition, typography, border ---
		} else if ((type === "composition" || type === "typography" || type === "border") && typeof value === "object") {
			const props: Record<string, any> = {};
			for (const [prop, propVal] of Object.entries(value)) {
				if (typeof propVal !== "string" || !propVal.startsWith("{")) {
					continue;
				}
				const nestedTokenKey = propVal.replace(/[{}]/g, "");
				props[prop] = {
					value: propVal,
					result: this.calculate(nestedTokenKey),
					chain: this.getResolutionChain(nestedTokenKey),
					type: this.mapping[nestedTokenKey]?.type,
				};
			}
			resolved = {
				type,
				props,
				file: originalDef?.file ? originalDef.file.replace(/^[/\\]+/, "") : normalizedFile,
			};

			// --- simple (color, number, text, etc.) ---
		} else {
			resolved = {
				finalValue: this.calculate(tokenKey),
				chain: this.getResolutionChain(tokenKey),
				type,
				file: originalDef?.file ? originalDef.file.replace(/^[/\\]+/, "") : normalizedFile,
			};
		}

		// The original "key" (eg "w-button.size.sm.typography")
		resolved._originalTokenKey = originalTokenKey;

		// If there were extensions
		if (originalDef?.extensions) {
			resolved.extensions = originalDef.extensions;
		} else if (def.extensions) {
			resolved.extensions = def.extensions;
		}

		this.resolveCache.set(tokenRef, resolved);
		return resolved;
	}

	getResolutionPath(tokenKey: string, visited: Set<string> = new Set()): any[] {
		if (visited.has(tokenKey)) return [];
		visited.add(tokenKey);

		const def = this.mapping[tokenKey];
		if (!def) return [];
		const step = { token: tokenKey, file: def.file, type: def.type || "unknown" };

		// <-- Changed: we lead to RegExpMatchArray[]
		const matches = Array.from(def.value.matchAll(/{([^}]+)}/g)) as RegExpMatchArray[];
		if (matches.length === 0) {
			return [step];
		}

		// If there are curly links, we go recursively
		const nestedSteps = matches.flatMap((m) => {
			const innerKey = m[1];
			return this.getResolutionPath(innerKey, visited);
		});

		return [step, ...nestedSteps];
	}
}
