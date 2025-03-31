# JsonHint-TS

🎨 VSCode Extension for working with Tokens Studio JSON tokens

## ✨ Features
- Show resolved values and full resolution chain of tokens
- Supports **typography**, **composition**, **boxShadow**, **color** and other complex types
- Displays token inheritance in hover tooltips
- Auto-completion for `$value` fields
- Color preview right in autocomplete and hover
- Cycle detection with warning ⚠️
- Fully compatible with [Tokens Studio for Figma](https://tokens.studio)

---

## 📸 Screenshots

### Hover with inheritance chain

> Shows full resolution path and result

![Hover Screenshot](./screenshots/hover.png)

### Autocomplete

> Get instant suggestions with color previews

![Completion Screenshot](./screenshots/completion.png)

---

## ⚙️ Configuration

| Setting            | Description                        | Default                                    |
| ------------------ | ---------------------------------- | ------------------------------------------ |
| `inheritanceStyle` | Display style of inheritance chain | `compact`                                  |
| `showIcons`        | Show icons in hover                | `true`                                     |
| `showArrows`       | Show arrows in inheritance         | `true`                                     |
| `complexTypes`     | Types displayed as tables          | `["typography","boxShadow","composition"]` |
| `noisyTokens`      | Tokens to exclude from chains      | `["core.ly.tab.base", ...]`                |
| `maxChainLength`   | Max resolution depth               | `5`                                        |
| `maxSuggestions`   | Max autocomplete suggestions       | `300`                                      |

---

## 💾 Installation

### From Marketplace (Recommended)
(When published)

```bash
code --install-extension your-publisher.jsonhint-ts
