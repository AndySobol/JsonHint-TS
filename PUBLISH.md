# SXL Resolver — Publishing

This extension should be published to **both** registries:

1. VS Code Marketplace (for VS Code users)
2. Open VSX (for Cursor/OpenVSX users)

Without Open VSX publish, Cursor search usually will not find the extension.

## 1) Prerequisites

### VS Code Marketplace

- Publisher exists: `andySobolev`
- PAT with Marketplace publish permissions
- Login:

```bash
npx @vscode/vsce login andySobolev
```

### Open VSX

- Open VSX account created
- Publisher Agreement accepted
- Access token created on open-vsx.org
- Namespace created once:

```bash
npx ovsx create-namespace andySobolev -p <OPENVSX_TOKEN>
```

Then export token:

```bash
export OVSX_PAT=<OPENVSX_TOKEN>
```

## 2) Validate + package

```bash
npm run package:vsix
```

This runs: typecheck + lint + tests + production build + `.vsix` package.

## 3) Publish

### VS Code Marketplace

```bash
npm run publish:vscode
```

### Open VSX

```bash
npm run publish:openvsx
```

### Publish both

```bash
npm run release:all
```

## 4) If not visible in Cursor search

1. Confirm extension exists on open-vsx.org with correct version.
2. Wait for Cursor marketplace sync/cache.
3. Install via VSIX in Cursor as fallback:
   - `Extensions: Install from VSIX...`
