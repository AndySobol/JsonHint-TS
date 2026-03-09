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
}

export function getConfig(raw: Record<string, unknown>): ExtensionConfig {
  return {
    tokenPaths: (raw["tokenPaths"] as string[] | undefined) ?? ["tokens"],
    showIcons: (raw["showIcons"] as boolean | undefined) ?? true,
    maxChainLength: (raw["maxChainLength"] as number | undefined) ?? 5,
    maxSuggestions: (raw["maxSuggestions"] as number | undefined) ?? 300,
    allowNoDollar: (raw["allowNoDollar"] as boolean | undefined) ?? true,
    cssVariablePrefix: (raw["cssVariablePrefix"] as string | undefined) ?? "--",
    enableCssHover: (raw["enableCssHover"] as boolean | undefined) ?? true,
  };
}
