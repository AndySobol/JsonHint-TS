import * as fsPromises from "fs/promises";
import * as fs from "fs";
import * as path from "path";
import { flattenTokens } from "./TokenParser";

type Dirent = fs.Dirent;

export class TokenLoader {
	tokensDir: string;
	config: any;
	mapping: Record<string, any>;
	ready: boolean;

	constructor(tokensDir: string, config: any = {}) {
		this.tokensDir = tokensDir;
		this.config = config;
		this.mapping = {};
		this.ready = false;
	}

	async load(): Promise<void> {
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

	private async _walk(dir: string): Promise<void> {
		let entries: Dirent[];
		try {
			console.log(`[JsonHint-TS] Reading directory: ${dir}`);
			entries = await fsPromises.readdir(dir, { withFileTypes: true });
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

	private async _parseFile(filePath: string): Promise<void> {
		try {
			console.log(`[JsonHint-TS] Processing file: ${filePath}`);
			const contentStr = await fsPromises.readFile(filePath, "utf-8");
			const json = JSON.parse(contentStr);
			const relPath = path.relative(this.tokensDir, filePath);
			flattenTokens(json, "", relPath, this.mapping, null, this.config.allowNoDollar !== false);
		} catch (e) {
			console.error(`[JsonHint-TS] Error parsing file ${filePath}`, e);
		}
	}
}
