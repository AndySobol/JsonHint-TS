# JsonHint-TS

Расширение для VSCode для отображения подсказок и автодополнений для JSON-токенов по логике Tokens Studio.

---

## 🟣 Возможности

- Hover-подсказки с вычисленным значением, цепочкой наследования и дополнительной информацией.
- Поддержка всех типов токенов: `color`, `typography`, `boxShadow`, `composition`, `dimension`, `number`, и другие.
- Поддержка вложенных и комплексных токенов.
- Автодополнение в поле `$value`.
- Фильтрация автодополнений по типу токена.
- Визуализация цветов прямо в hover.
- Полностью совместимо с Tokens Studio (Figma Tokens).

---

## 📦 Установка

- Установите как обычное расширение через `.vsix`:
    1. Откройте командную палитру `Ctrl + Shift + P`
    2. Выберите `Extensions: Install from VSIX`
    3. Выберите `jsonhint-ts-x.x.x.vsix`

---

## ⚙️ Настройки

| Настройка                         | Описание                                           | По умолчанию |
| --------------------------------- | -------------------------------------------------- | ------------ |
| `jsonTokensHint.inheritanceStyle` | Стиль отображения цепочки (`compact` или `table`)  | compact      |
| `jsonTokensHint.showIcons`        | Показывать ли иконки типов токенов в hover         | true         |
| `jsonTokensHint.showArrows`       | Показывать ли стрелки в цепочках                   | true         |
| `jsonTokensHint.noisyTokens`      | Список технических токенов, исключаемых из цепочек | [ ]          |

---

## ✅ Поддерживаемые типы токенов

- `color`
- `typography`
- `boxShadow`
- `composition`
- `borderRadius`
- `spacing`
- `sizing`
- `number`
- `dimension`
- и все поддерживаемые Tokens Studio

---

## ✨ Пример

![hover-preview](./screenshots/hover-example.png)

---

## 🟡 Лицензия

MIT
