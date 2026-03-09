/**
 * PreviewRenderer — routes token types to specific preview renderers.
 */

import type { ResolvedToken, TokenType } from "../core/types";
import { renderColorPreview, colorValueLine } from "./ColorPreview";
import { renderDimensionPreview, renderBorderRadiusPreview, renderOpacityPreview } from "./DimensionPreview";
import { renderSimpleBadge } from "./SimplePreview";
import { renderGradientPreview } from "./GradientPreview";
import { renderTypographyPreview } from "./TypographyPreview";
import { renderShadowPreview } from "./ShadowPreview";
import { renderBorderPreview } from "./BorderPreview";
import { renderEffectsPreview } from "./EffectsPreview";
import { renderAnimationPreview } from "./AnimationPreview";
import { renderGridPreview } from "./GridPreview";

export function renderPreview(resolved: ResolvedToken): string {
  const type = resolved.type;

  if (resolved.kind === "simple") {
    return renderSimpleTypePreview(type, resolved.finalValue);
  }

  if (resolved.kind === "composite") {
    return renderCompositeTypePreview(type, resolved.props);
  }

  return "";
}

function renderSimpleTypePreview(type: TokenType, value: string): string {
  switch (type) {
    case "color":
      return renderColorPreview(value);

    case "gradient":
      return renderGradientPreview(value);

    case "fill":
      return renderColorPreview(value) || renderGradientPreview(value);

    case "dimension":
    case "sizing":
    case "spacing":
    case "borderWidth":
    case "fontSize":
    case "fontSizes":
    case "lineHeight":
    case "lineHeights":
    case "letterSpacing":
    case "paragraphSpacing":
    case "paragraphIndent":
      return renderDimensionPreview(value);

    case "borderRadius":
      return renderBorderRadiusPreview(value);

    case "opacity":
      return renderOpacityPreview(value);

    case "duration":
    case "cubicBezier":
      return renderAnimationPreview(value, type);

    case "fontFamily":
    case "fontFamilies":
    case "fontWeight":
    case "fontWeights":
    case "textCase":
    case "textDecoration":
      return renderSimpleBadge(value, type);

    case "number":
    case "boolean":
    case "string":
    case "text":
      return renderSimpleBadge(value, type);

    default:
      return "";
  }
}

function renderCompositeTypePreview(type: TokenType, props: Record<string, import("../core/types").ResolvedProperty>): string {
  switch (type) {
    case "typography":
      return renderTypographyPreview(props);

    case "shadow":
    case "boxShadow":
      return renderShadowPreview(props);

    case "border":
    case "strokeStyle":
      return renderBorderPreview(props);

    case "effects":
    case "glass":
    case "blur":
    case "backdrop-blur":
      return renderEffectsPreview(props, type);

    case "transition":
      return renderAnimationPreview("", type);

    case "grid":
      return renderGridPreview(props);

    default:
      return "";
  }
}

export function getValueLine(resolved: ResolvedToken): string {
  if (resolved.kind === "simple" && resolved.type === "color") {
    return colorValueLine(resolved.finalValue);
  }
  if (resolved.kind === "simple") {
    return `\`${resolved.finalValue}\``;
  }
  return "";
}
