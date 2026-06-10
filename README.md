![Extension Icon](./icon.png)

# SXL Resolver

Design-token IntelliSense for VS Code and Cursor.

SXL Resolver reads JSON/JSONC token files and CSS custom properties, then shows resolved values, visual previews, alias chains, completion suggestions, and source navigation directly in the editor.

## What It Does

- Shows hover previews for JSON token references such as `{color.brand.primary}`.
- Shows hover previews for CSS variables such as `var(--color-brand-primary)`.
- Resolves `raw -> resolved` values and displays alias chains.
- Shows color, gradient, shadow, dimension, typography, and other token previews.
- Completes CSS custom property names inside `var(--...)`.
- Jumps to the source token or CSS variable definition.
- Supports multi-root workspaces.
- Keeps CSS resolution CSS-first: current file -> configured CSS sources -> nearby workspace CSS -> JSON fallback.
- Supports 35+ token types, including color, typography, spacing, sizing, border, shadow, effects, transition, grid, composition, and more.

## Supported Files

JSON tokens:

- `json`
- `jsonc`

CSS variables:

- `css`
- `scss`
- `less`
- `sass`
- `typescript`
- `typescriptreact`
- `javascript`
- `javascriptreact`
- `vue`
- `svelte`
- `html`

## Installation

### VS Code

Install **SXL Resolver** from the Visual Studio Marketplace.

### Cursor

Install **SXL Resolver** from Cursor Extensions. Cursor uses an Open VSX-compatible registry.

If Cursor does not show the latest version yet, check the extension page on Open VSX. Registry mirrors can lag behind Open VSX. As a temporary workaround, download the `.vsix` for the required version from Open VSX and install it with:

1. Command Palette
2. `Extensions: Install from VSIX...`
3. Select the downloaded `.vsix`

## Configure Token JSON

Set `sxlResolver.tokenPaths` to the folders that contain your token JSON/JSONC files.

```json
{
  "sxlResolver.tokenPaths": [
    "tokens",
    "packages/design-system/tokens"
  ]
}
```

Paths can be workspace-relative or absolute. Prefer workspace-relative paths for team settings.

## Configure CSS Variables

By default, SXL Resolver scans CSS/SCSS/Less/Sass files in the open workspace and skips heavy folders such as `node_modules`, `dist`, and `build`.

Use `sxlResolver.cssVariableSources` when CSS variables are generated in another folder or shipped from a design-system package. This avoids slow global `node_modules` scans and prevents variables from unrelated products or themes from being mixed.

Example for a published design-system package:

```json
{
  "sxlResolver.cssVariableSources": [
    {
      "name": "Commerce app styles",
      "package": "@org/design-system-styles",
      "entrypoints": ["commerce/index.css", "components/index.css"],
      "manifests": ["commerce/tokens-manifest.json"],
      "appliesTo": ["apps/storefront/**", "packages/storefront-ui/**"]
    },
    {
      "name": "Operations app styles",
      "package": "@org/design-system-styles",
      "entrypoints": ["operations/index.css", "components/index.css"],
      "manifests": ["operations/tokens-manifest.json"],
      "appliesTo": ["apps/operations/**", "packages/operations-ui/**"]
    }
  ]
}
```

Example for generated CSS files in the same workspace:

```json
{
  "sxlResolver.cssVariableSources": [
    {
      "name": "Local design-system styles",
      "paths": [
        "packages/design-system/styles/commerce/index.css",
        "packages/design-system/styles/components/index.css"
      ],
      "manifests": [
        "packages/design-system/styles/commerce/tokens-manifest.json"
      ],
      "appliesTo": ["apps/storefront/**", "packages/storefront-ui/**"]
    }
  ]
}
```

## Where Settings Live

Resolver settings are editor settings.

- For a team, commit `.vscode/settings.json` in the repository. Cursor reads VS Code-compatible workspace settings.
- For multi-root workspaces, put settings in a `.code-workspace` file under the top-level `"settings"` key.
- For personal absolute paths, use User Settings JSON.

In VS Code or Cursor, open Command Palette and run:

```text
Preferences: Open User Settings (JSON)
```

## Settings Reference

| Setting | Type | Default | Purpose |
|---|---|---|---|
| `sxlResolver.tokenPaths` | `string[]` | `["tokens"]` | Token folders, workspace-relative or absolute. |
| `sxlResolver.showIcons` | `boolean` | `true` | Show type icons in hover and completion. |
| `sxlResolver.maxChainLength` | `number` | `5` | Maximum alias chain depth shown in hover. |
| `sxlResolver.maxSuggestions` | `number` | `300` | Maximum completion suggestions. |
| `sxlResolver.allowNoDollar` | `boolean` | `true` | Support `type`, `value`, and `extensions` without `$`. |
| `sxlResolver.cssVariablePrefix` | `string` | `"--"` | Prefix used for JSON-to-CSS fallback mapping. |
| `sxlResolver.enableCssHover` | `boolean` | `true` | Enable hover for `var(...)`. |
| `sxlResolver.enableCssCompletion` | `boolean` | `true` | Enable CSS custom property completion inside `var(--...)`. |
| `sxlResolver.cssVariableSources` | `array` | `[]` | Additional allowlisted CSS variable sources from packages or workspace paths. |

## CSS Source Fields

| Field | Purpose |
|---|---|
| `name` | Human-readable source label shown in completion details. |
| `package` | Package name resolved from the nearest workspace package context. Works with pnpm, npm, and yarn layouts. |
| `entrypoints` | CSS files or folders inside the package to index. Relative CSS `@import` files are followed in order. |
| `paths` | Alias for `entrypoints`. Without `package`, paths are workspace-relative or absolute. |
| `manifests` | Optional SXL manifest files with `cssVar`, `type`, `value`, and `resolvedValue` metadata. Use this for exact CSS token types. |
| `appliesTo` | Workspace-relative glob patterns that decide which files use this source group. |

## Resolution Priority

When hovering or completing `var(--token-name)`, SXL Resolver uses:

1. CSS variables declared in the current file.
2. Matching configured `cssVariableSources`.
3. Other scanned workspace CSS variables by proximity.
4. JSON token mapping fallback from `figma.codeSyntax.Web` or token path kebab-case.

If two apps or themes define the same CSS variable name, split them into separate source groups and scope them with `appliesTo`.

## Manifest Metadata

Plain CSS custom properties do not contain token type metadata. Without a manifest, Resolver can infer only broad types from values.

Connect `tokens-manifest.json` when you need exact CSS token types such as:

- `spacing`
- `sizing`
- `borderRadius`
- `fontWeight`
- `lineHeight`
- `opacity`
- `shadow`

## Commands

- `SXL Resolver: Force Refresh Tokens`
- `SXL Resolver: Reveal Token in File`

## Troubleshooting

### Hover or completion looks stale

Run:

```text
SXL Resolver: Force Refresh Tokens
```

If the editor was already open when settings changed, also run:

```text
Developer: Reload Window
```

### Cursor does not show the latest version

First check the Open VSX extension page. If the latest version is present there but not in Cursor, the most likely causes are Cursor registry mirror/cache delay or extension filtering. The extension targets VS Code `^1.85.0`, so modern Cursor builds should be compatible.

As a temporary workaround, install the latest `.vsix` from Open VSX manually.

### Open VSX shows an unverified namespace warning

This is controlled by Open VSX namespace ownership. The warning does not mean the extension files are broken, but the namespace should be claimed and verified by the publisher to remove the warning.

## Privacy

SXL Resolver runs locally in the editor. It reads token and CSS files from the open workspace and configured sources. It does not send token files or CSS values to an external service.
