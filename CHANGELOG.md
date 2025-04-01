# Change Log

## [0.7.0] - 2025-04-01

### Added
- Added a VS Code status bar indicator that displays the extension’s status and token count.

### Fixed
- Fixed token link navigation: clicking a token now correctly opens the corresponding file and highlights the token.

## [0.5.6-pre] - 2025-03-31

### 🟣 Added
- Fully asynchronous token loading (no longer blocks VS Code)
- Caching for configuration and tokens
- Support for all Tokens Studio token types (color, typography, boxShadow, sizing, etc.)
- Display of color preview in hover and autocomplete
- New handling of inheritance chains
- Support for complex types in hover (composition, typography, boxShadow)
- Automatic resolution of cyclic dependencies in chains
- Support for `$extensions` (experimental)

### 🟡 Improved
- Optimized for large projects (>5000 tokens)
- Improved autocomplete performance
- Faster and smoother hover display
- Enhanced tooltip readability (Result and Source are now neatly separated)
- Inheritance chains are smoothed and simplified

### 🔴 Fixed
- Fixed error in computing token resolution paths
- Hover for boxShadow in composition now displays correctly
- Fixed potential issues running in VS Code >= 1.98 (Electron 34+)
- Improved handling of vscode.workspaceFolders in edge cases

---

## [0.5.5] - 2025-03-25

### Initial release
- Basic version with hover and autocomplete for simple types
- Works with Tokens Studio JSON
- Supports color previews for `$type: color`

---

## [0.5.4] - 2025-03-31

### Added
- Tokens Studio style extension icon
- Complete `README.md` for publication
- Support for VS Code >= 1.98 and Electron 34
- Support for VS Code themes (light/dark)
- Support for new unit expressions (`px`, `em`, `rem`, `%`, `s`, `deg`, etc.)

### Fixed
- Critical bug: `mathjs` no longer crashes on expressions with `px` and similar units
- Stability improvements for nested tokens
- Hover no longer breaks on unresolved or incorrect chains
- Improved filtering of technical tokens from chains

### Improved
- Complete refactoring of TokenResolver (improved speed and readability)
- Simplified logic in `TokenHoverProvider`
- Faster hover tooltips thanks to caching and optimizations
- Optimized rendering for complex types (`composition`, `boxShadow`, `typography`)
