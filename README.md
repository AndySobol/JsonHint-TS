![Extension Icon](./icon.png)

# SXL Resolver

Design token IntelliSense for JSON/JSONC and CSS/SCSS `var(...)`.

## Features

- Hover preview for token references in JSON/JSONC: `{color.brand.primary}`
- Hover preview for CSS variables: `var(--color-brand-primary)` (with fallback syntax support)
- Raw and resolved values (`raw → resolved`) with alias chain
- Typography shorthand preview in CSS (`font` token variables)
- CSS-first resolution strategy: current file → configured CSS sources → nearby CSS files → workspace, then JSON mapping fallback
- Autocomplete for CSS custom properties inside `var(--...)`
- Configured package CSS sources for monorepos and published design-system packages
- Context-aware token scope for JSON and CSS: nearest token root relative to the active file is used first
- Completion for `$value` token references
- Go to definition for JSON references and CSS variables
- Color preview and resolved final value rendering
- Multi-root workspace support
- 35+ token types supported (color, typography, dimensions, shadows, effects, transitions, grid, composition, etc.)

## Supported languages

- JSON: `json`, `jsonc`
- CSS family: `css`, `scss`, `less`, `sass`
- UI/code files with `var(...)`: `typescript`, `typescriptreact`, `javascript`, `javascriptreact`, `vue`, `svelte`, `html`

## Installation

### VS Code

Install from Visual Studio Marketplace by searching for `SXL Resolver`.

### Cursor

Cursor uses an OpenVSX-compatible marketplace.  
To be discoverable in Cursor search, publish the same extension to Open VSX.

If search is delayed, install from VSIX:

1. Build/package `.vsix`
2. Cursor → Command Palette → `Extensions: Install from VSIX...`

## Extension settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `sxlResolver.tokenPaths` | `string[]` | `["tokens"]` | Token folders relative to workspace root (or absolute paths). |
| `sxlResolver.showIcons` | `boolean` | `true` | Show type icons in hover/completion. |
| `sxlResolver.maxChainLength` | `number` | `5` | Max chain depth in hover. |
| `sxlResolver.maxSuggestions` | `number` | `300` | Max completion suggestions. |
| `sxlResolver.allowNoDollar` | `boolean` | `true` | Support `type/value/extensions` without `$` prefix. |
| `sxlResolver.cssVariablePrefix` | `string` | `"--"` | Prefix for reverse CSS mapping fallback. |
| `sxlResolver.enableCssHover` | `boolean` | `true` | Enable hover for `var(...)` in CSS and related languages. |
| `sxlResolver.enableCssCompletion` | `boolean` | `true` | Enable autocomplete for CSS custom properties inside `var(--...)`. |
| `sxlResolver.cssVariableSources` | `array` | `[]` | Additional allowlisted CSS sources. Supports workspace paths and package entrypoints. |

## CSS variable sources

By default SXL Resolver scans CSS/SCSS/Less/Sass files in the open workspace and skips heavy folders such as `node_modules`, `dist`, and `build`. This keeps existing projects fast and preserves the original behavior.

Use `sxlResolver.cssVariableSources` when CSS variables live in a published package or in a folder outside the default workspace scan. The extension resolves package sources from the nearest workspace `package.json`, so pnpm, npm, and yarn symlinks work without hardcoding `.pnpm` paths.

For exact CSS token types, include the matching `tokens-manifest.json`. Plain CSS values do not carry token type metadata, so Resolver can only infer broad types from values. Manifest metadata keeps CSS hovers aligned with JSON token types such as `spacing`, `sizing`, `borderRadius`, `fontWeight`, `lineHeight`, `opacity`, and `shadow`.

Example for a project that consumes `@ds/project-styles`:

```json
{
  "sxlResolver.cssVariableSources": [
    {
      "name": "bk-ui",
      "package": "@ds/project-styles",
      "entrypoints": ["bk-ui/index.css", "components/index.css"],
      "manifests": ["bk-ui/tokens-manifest.json"],
      "appliesTo": ["packages/bk-client/**", "packages/ds/bk-components/**", "entities/**"]
    },
    {
      "name": "admin-ui",
      "package": "@ds/project-styles",
      "entrypoints": ["admin-ui/index.css", "components/index.css"],
      "manifests": ["admin-ui/tokens-manifest.json"],
      "appliesTo": ["packages/bk-admin/**"]
    }
  ]
}
```

Source fields:

| Field | Description |
|---|---|
| `name` | Label shown in completion details. |
| `package` | Package name resolved from the nearest package context. |
| `entrypoints` | CSS files or folders to index. CSS `@import` files are followed in order. |
| `paths` | Alias for `entrypoints`; for non-package sources, paths are workspace-relative or absolute. |
| `manifests` | Optional SXL token manifests with `cssVar`, `type`, `value`, and `resolvedValue` metadata. Use this for exact CSS token types. |
| `appliesTo` | Workspace-relative glob patterns that decide which files use this source. |

Resolution priority:

1. Local CSS variables in the current file.
2. Matching configured sources from `cssVariableSources`.
3. Other scanned workspace CSS variables by proximity.
4. JSON token mapping fallback from `figma.codeSyntax.Web` or token path kebab-case.

## Commands

- `SXL Resolver: Force Refresh Tokens`
- `SXL Resolver: Reveal Token in File`

## Development

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

## Release scripts

- `npm run package:vsix` – validate + build + package
- `npm run publish:vscode` – publish to VS Code Marketplace
- `npm run publish:openvsx` – publish to Open VSX (for Cursor discoverability)
- `npm run release:all` – publish to both registries
