<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/icon.png" alt="Extension Icon" />

# JsonHint-TS

A VSCode extension for working with [Tokens Studio](https://tokens.studio) JSON tokens directly in VSCode.

---

## ✨ Features

- **🎨 Resolved Value Previews:** Display the computed token values directly on hover.
- **🟣 Inheritance Chain:** Easily see the full inheritance and resolution chain for each token.
- **🔤 Complex Type Support:** Robust handling of **typography**, **composition**, **boxShadow**, **color**, **sizing**, **spacing**, **dimension**, and more.
- **🪄 Auto-Completion:** Smart auto-completion for `$value` fields that helps speed up your workflow.
- **🟡 Instant Color Preview:** Enjoy live color previews in both hover tooltips and auto-complete suggestions.
- **🔄 Cycle & Chain Safety:** Handles cyclic dependencies and long chains gracefully.
- **🐇 Optimized Performance:** Designed for large token collections (5000+ tokens) without UI lag.
- **💼 Tokens Studio Compatibility:** Fully compatible with Tokens Studio for Figma.
- **🔗 Direct Navigation:** Click token links in tooltips to open the corresponding file and highlight the token instantly.

---

## 📸 Preview

### Token Navigation
When hovering over a token, clickable links are shown. Clicking on a token automatically opens the corresponding file and highlights the exact line where that token is defined. This feature leverages VS Code's API to open documents, reveal ranges, and apply temporary highlights—streamlining your workflow and making token management more intuitive.  
<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/screenshots/navigation.gif" alt="Token Navigation" />

### 🔤 Typography Details
Shows fully resolved typography properties:  
<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/screenshots/show-typography2.png" alt="Typography Details" />

### 🎨 Color Tooltip
Instant color preview:  
<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/screenshots/hint-color.png" alt="Color Tooltip" />

### 🎨 Color Resolution
Resolve color composition with full trace:  
<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/screenshots/show-color.png" alt="Color Resolution" />

### 🎨 Gradient Resolution
Resolve gradient composition with full trace:  
<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/screenshots/hint-gradient.png" alt="Gradient Resolution" />

### 🎨 Color Modifiers Resolution
Resolve alpha, mix composition with full trace:  
<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/screenshots/hint-alpha-color.png" alt="Color Modifiers Resolution" />

### ☁️ Box Shadow Source
See how complex boxShadow compositions resolve:  
<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/screenshots/show-box-shadow-source.png" alt="Box Shadow Source" />

### ☁️ Box Shadow Result
Full visualization of the box shadow chain:  
<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/screenshots/show-box-shadow.png" alt="Box Shadow Result" />

### 📏 Sizing Tooltip
Works with sizing tokens:  
<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/screenshots/hint-size.png" alt="Sizing Tooltip" />

### ➕ Sizing Chain
Full resolution chain for sizing:  
<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/screenshots/show-sizing.png" alt="Sizing Chain" />

### 📐 Dimension Tooltip
See all dimensions calculated:  
<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/screenshots/show-size.png" alt="Dimension Tooltip" />

### ✨ Typography Autocomplete
Smart autocomplete with resolved tokens:  
<img src="https://github.com/AndySobol/JsonHint-TS/raw/HEAD/screenshots/hint-typography.png" alt="Typography Autocomplete" />

---

## ⚙️ Extension Settings

The extension supports the following settings, which you can configure in the VSCode settings:

| Setting                               | Description                                                                                                        | Default                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `jsonhintTs.tooltipBackgroundColor`   | Background color for the token tooltip view.                                                                       | `#1e1e1e`                                                          |
| `jsonhintTs.tooltipTextColor`         | Text color for the token tooltip view.                                                                             | `#d4d4d4`                                                          |
| `jsonhintTs.tooltipFontSize`          | Font size for the token tooltip text.                                                                              | `14px`                                                             |
| `jsonhintTs.tooltipAnimationDuration` | Animation duration (fade-in) for displaying token tooltips.                                                        | `0.3s`                                                             |
| `jsonhintTs.inheritanceStyle`         | Style for displaying the token inheritance chain:<br> • `compact` – concise,<br> • `table` – displayed as a table. | `compact`                                                          |
| `jsonhintTs.showIcons`                | Flag that determines whether to show icons for token types in tooltips.                                            | `true`                                                             |
| `jsonhintTs.showArrows`               | Flag to enable displaying arrows between tokens in the inheritance chain.                                          | `true`                                                             |
| `jsonhintTs.complexTypes`             | Array of token types that use an extended display format (e.g., table).                                            | `["typography", "boxShadow", "composition"]`                       |
| `jsonhintTs.noisyTokens`              | Array of tokens to exclude from the inheritance chain (noisy tokens).                                              | `["core.ly.tab.base", "cfg.scale.base.tab", "cfg.scale.mult.tab"]` |
| `jsonhintTs.maxChainLength`           | Maximum depth (number of steps) of the inheritance chain shown in the tooltip.                                     | `5`                                                                |
| `jsonhintTs.maxSuggestions`           | Maximum number of autocomplete suggestions to prevent UI lag.                                                      | `300`                                                              |
| `jsonhintTs.allowNoDollar`            | If set to `true`, the extension will recognize tokens defined without a leading `$` symbol.                         | `true`                                                             |

---

## ❤️ Credits
Thanks to the **Tokens Studio** team and community.
And also huge thanks to **Gleb Rotachev** ❤️.