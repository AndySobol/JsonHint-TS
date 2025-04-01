const fs = require("fs").promises;
const path = require("path");
const { flattenTokens } = require("./TokenParser");

class TokenLoader {
	constructor(tokensDir, config = {}) {
		this.tokensDir = tokensDir;
		this.config = config;
		this.mapping = {};
		this.ready = false;
	}

	async load() {
		this.mapping = {};
		this.ready = false;
		try {
			await this._walk(this.tokensDir);
			this.ready = true;
			console.log(`[JsonHint-TS] Loaded ${Object.keys(this.mapping).length} tokens.`);
		} catch (e) {
			console.error("[JsonHint-TS] Error loading tokens:", e);
		}
	}

	async _walk(dir) {
		let entries;
		try {
			console.log(`[JsonHint-TS] Reading directory: ${dir}`);
			entries = await fs.readdir(dir, { withFileTypes: true });
		} catch (e) {
			console.error(`[JsonHint-TS] Failed to read directory: ${dir}`, e);
			return;
		}
		for (const entry of entries) {
			const filePath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				await this._walk(filePath);
			} else if (entry.isFile() && filePath.endsWith(".json")) {
				await this._parseFile(filePath);
			}
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
			console.error(`[JsonHint-TS] Error parsing file ${filePath}`, e);
		}
	}
}

module.exports = TokenLoader;