/**
 * Core type definitions for the SXL Resolver extension.
 * Strict types — no `any` in public APIs.
 */

// ─── Token Types ───

export type TokenType =
  | "color"
  | "gradient"
  | "fill"
  | "typography"
  | "fontFamily"
  | "fontWeight"
  | "fontSize"
  | "lineHeight"
  | "letterSpacing"
  | "paragraphSpacing"
  | "paragraphIndent"
  | "textCase"
  | "textDecoration"
  | "shadow"
  | "boxShadow"
  | "blur"
  | "backdrop-blur"
  | "glass"
  | "effects"
  | "dimension"
  | "sizing"
  | "spacing"
  | "borderRadius"
  | "borderWidth"
  | "border"
  | "strokeStyle"
  | "opacity"
  | "number"
  | "boolean"
  | "string"
  | "text"
  | "grid"
  | "transition"
  | "duration"
  | "cubicBezier"
  | "template"
  | "composition"
  | "fontFamilies"
  | "fontWeights"
  | "fontSizes"
  | "lineHeights"
  | "unknown";

// ─── Token Entry (flat mapping) ───

export interface TokenEntry {
  value: unknown;
  type: TokenType;
  file: string;
  extensions?: TokenExtensions;
}

export interface TokenExtensions {
  figma?: {
    codeSyntax?: {
      Web?: string;
      Android?: string;
      iOS?: string;
    };
    scopes?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ─── Resolved Token (discriminated union) ───

export interface ChainStep {
  token: string;
  file: string;
  type: TokenType;
}

export interface ResolvedSimple {
  kind: "simple";
  type: TokenType;
  tokenKey: string;
  rawValue: string;
  finalValue: string;
  chain: ChainStep[];
  file: string;
  extensions?: TokenExtensions;
}

export interface ResolvedComposite {
  kind: "composite";
  type: TokenType;
  tokenKey: string;
  props: Record<string, ResolvedProperty>;
  file: string;
  extensions?: TokenExtensions;
}

export interface ResolvedProperty {
  rawValue: string;
  resolvedValue: string;
  chain: ChainStep[];
  type?: TokenType;
}

export type ResolvedToken = ResolvedSimple | ResolvedComposite;

// ─── Extension Config ───

export interface ExtensionConfig {
  tokenPaths: string[];
  showIcons: boolean;
  maxChainLength: number;
  maxSuggestions: number;
  allowNoDollar: boolean;
  cssVariablePrefix: string;
  enableCssHover: boolean;
  enableCssCompletion: boolean;
  cssVariableSources: CssVariableSourceConfig[];
}

export interface CssVariableSourceConfig {
  name: string;
  packageName?: string;
  cssPaths: string[];
  manifests: string[];
  appliesTo: string[];
}

export function getConfig(raw: Record<string, unknown>): ExtensionConfig {
  const tokenPathsRaw = raw["tokenPaths"];
  const tokenPaths = Array.isArray(tokenPathsRaw)
    ? tokenPathsRaw.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : ["tokens"];
  const maxChainLengthRaw = raw["maxChainLength"];
  const maxSuggestionsRaw = raw["maxSuggestions"];
  const cssVariablePrefixRaw = raw["cssVariablePrefix"];

  return {
    tokenPaths: tokenPaths.length > 0 ? tokenPaths : ["tokens"],
    showIcons: (raw["showIcons"] as boolean | undefined) ?? true,
    maxChainLength:
      typeof maxChainLengthRaw === "number" && Number.isFinite(maxChainLengthRaw)
        ? Math.max(1, Math.floor(maxChainLengthRaw))
        : 5,
    maxSuggestions:
      typeof maxSuggestionsRaw === "number" && Number.isFinite(maxSuggestionsRaw)
        ? Math.max(1, Math.floor(maxSuggestionsRaw))
        : 300,
    allowNoDollar: (raw["allowNoDollar"] as boolean | undefined) ?? true,
    cssVariablePrefix:
      typeof cssVariablePrefixRaw === "string" && cssVariablePrefixRaw.length > 0
        ? cssVariablePrefixRaw
        : "--",
    enableCssHover: (raw["enableCssHover"] as boolean | undefined) ?? true,
    enableCssCompletion: (raw["enableCssCompletion"] as boolean | undefined) ?? true,
    cssVariableSources: readCssVariableSources(raw["cssVariableSources"]),
  };
}

function readCssVariableSources(raw: unknown): CssVariableSourceConfig[] {
  if (!Array.isArray(raw)) return [];

  const sources: CssVariableSourceConfig[] = [];
  for (const [index, item] of raw.entries()) {
    const source = readCssVariableSource(item, index);
    if (source) sources.push(source);
  }
  return sources;
}

function readCssVariableSource(raw: unknown, index: number): CssVariableSourceConfig | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return {
      name: trimmed,
      cssPaths: [trimmed],
      manifests: [],
      appliesTo: [],
    };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const packageNameRaw = record["package"];
  const packageName = typeof packageNameRaw === "string" && packageNameRaw.trim()
    ? packageNameRaw.trim()
    : undefined;
  const paths = readStringArray(record["paths"]);
  const entrypoints = readStringArray(record["entrypoints"]);
  const cssPaths = [...paths, ...entrypoints];
  const manifests = readStringArray(record["manifests"]);

  if (!packageName && cssPaths.length === 0 && manifests.length === 0) return null;

  const nameRaw = record["name"];
  const name = typeof nameRaw === "string" && nameRaw.trim()
    ? nameRaw.trim()
    : packageName ?? `css-source-${index + 1}`;

  return {
    name,
    packageName,
    cssPaths,
    manifests,
    appliesTo: readStringArray(record["appliesTo"]),
  };
}

function readStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
