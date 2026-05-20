![Extension Icon](./icon.png)

# SXL Resolver

Design token IntelliSense for JSON/JSONC and CSS/SCSS `var(...)`.

## Features

- Hover preview for token references in JSON/JSONC: `{color.brand.primary}`
- Hover preview for CSS variables: `var(--color-brand-primary)` (with fallback syntax support)
- Raw and resolved values (`raw → resolved`) with alias chain
- Typography shorthand preview in CSS (`font` token variables)
- CSS-first resolution strategy: current file → nearby CSS files → workspace, then JSON mapping fallback
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
