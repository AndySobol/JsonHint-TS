# Change Log

## [1.0.0] - 2025-04-08

### Rewrite in TypeScript:
- The extension has been completely rewritten in TypeScript, which improves code readability, enforces strong typing, and simplifies future maintenance.
- Added Font Preview in Hover: A new feature has been added to display a preview of font size and style directly within hover tooltips, helping users quickly understand token values.
- A dedicated WebView module has been implemented to show detailed token information, including resolution chain and properties, enhancing the overall analysis and debugging experience.
- Various bugs and errors have been addressed, resulting in a more stable and reliable extension.
- The codebase has been optimized for better performance, ensuring faster response times when working with large token sets.


## [0.8.1] - 2025-04-02

### Improved Color Modifiers Handling:
- Added support for alpha modifiers – now alpha values defined as decimal numbers (e.g., 0.04) are converted to percentages and correctly applied to the base color.
- Updated TokenParser to preserve the extensions field from the original JSON token definitions, ensuring that modifiers are properly passed during token resolution.

### Code Optimization and Improvements:
- Refactored and optimized functions for rendering previews (hover, chain, tables) to improve readability and maintainability.
- Enhanced the usage of template literals and added additional logging to facilitate debugging and trace the computation steps (e.g., base color, alpha value, and final modified color).
- Added inline comments and improved code structure for better debugging and future maintenance.


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
