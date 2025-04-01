![Extension Icon](./icon.png)

# JsonHint-TS

VSCode Extension for working with [Tokens Studio](https://tokens.studio) JSON tokens directly in VSCode.

---

## ✨ Features

- 🎨 Shows resolved values in hover tooltips
- 🟣 Displays full inheritance and resolution chain
- 🔤 Supports complex types: **typography**, **composition**, **boxShadow**, **color**, **sizing**, **spacing**, **dimension** and others
- 🪄 Auto-completion for `$value` fields
- 🟡 Color preview inside hover and autocomplete
- 🔄 Handles cycles and long chains safely
- 🐇 Optimized for large token collections (5000+ tokens)
- 💼 Full compatibility with Tokens Studio for Figma
- 🔗 Direct token navigation: Click token links in hover tooltips to open the corresponding file and highlight the token.

---

## 📸 Preview

### Token Navigation
When hovering over a token, clickable links are shown. Clicking on a token automatically opens the corresponding file and highlights the exact line where that token is defined. This feature is implemented with a concise function that leverages VS Code's API for opening documents, revealing ranges, and applying temporary highlights—streamlining your workflow and making token management more intuitive.
![show-typography](./screenshots/navigation.gif)

### 🟣 Typography Details
Shows fully resolved typography properties:
![show-typography](./screenshots/show-typography.png)

### 🎨 Color Tooltip
Instant color preview:
![hint-color](./screenshots/hint-color.png)

### 📏 Sizing Tooltip
Works with sizing tokens:
![hint-size](./screenshots/hint-size.png)

### ✨ Typography Autocomplete
Smart autocomplete with resolved tokens:
![hint-typography](./screenshots/hint-typography.png)

### ☁️ Box Shadow Source
See how complex boxShadow compositions resolve:
![show-box-shadow-source](./screenshots/show-box-shadow-source.png)

### ☁️ Box Shadow Result
Full visualization of box shadow chain:
![show-box-shadow](./screenshots/show-box-shadow.png)

### 🎨 Color Resolution
Resolve color composition with full trace:
![show-color](./screenshots/show-color.png)

### 🎨 Gradient Resolution
Resolve gradient composition with full trace:
![show-sizing](./screenshots/hint-gradient.png)

### 🎨 Color Modifiers Resolution
Resolve alpha, mix composition with full trace:
![show-sizing](./screenshots/hint-alpha-color.png)

### 📐 Dimension Tooltip
See all dimensions calculated:
![show-size](./screenshots/show-size.png)

### ➕ Sizing Chain
Full resolution chain for sizing:
![show-sizing](./screenshots/show-sizing.png)


---

## ⚙️ Extension Settings

| Setting            | Description                        | Default                                    |
| ------------------ | ---------------------------------- | ------------------------------------------ |
| `inheritanceStyle` | Style of inheritance chain display | `compact`                                  |
| `showIcons`        | Show icons in hover                | `true`                                     |
| `showArrows`       | Show arrows between tokens         | `true`                                     |
| `complexTypes`     | Types rendered as tables           | `["typography","boxShadow","composition"]` |
| `noisyTokens`      | Tokens to exclude from chain       | `["core.ly.tab.base",...]`                 |
| `maxChainLength`   | Maximum resolution depth           | `5`                                        |
| `maxSuggestions`   | Max autocomplete suggestions       | `300`                                      |
| `allowNoDollar`    | Enables W3C DTCG ($type) support   | `true`                                      |

---


❤️ Credits
Thanks to the Tokens Studio team and community.
And also huge thanks to Gleb Rotachev ❤️.