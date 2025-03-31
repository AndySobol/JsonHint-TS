# Change Log

## [0.5.6-pre] - 2025-03-31

### 🟣 Added
- Полностью асинхронная загрузка токенов (больше не блокирует VSCode)
- Кэширование конфигурации и токенов
- Поддержка всех типов токенов Tokens Studio (color, typography, boxShadow, sizing и др.)
- Отображение color preview в hover и autocomplete
- Новая обработка inheritance chain
- Поддержка complex types в hover (composition, typography, boxShadow)
- Автоматическое устранение циклических зависимостей в цепочках
- Поддержка `$extensions` (experimental)

### 🟡 Improved
- Оптимизация для больших проектов (>5000 токенов)
- Улучшена производительность autocomplete
- Hover теперь отображается быстрее и плавнее
- Улучшена читаемость tooltip (Result и Source теперь аккуратно разделены)
- Сглаживание и упрощение inheritance chains

### 🔴 Fixed
- Исправлена ошибка при вычислении token resolution path
- Hover для boxShadow в composition теперь корректно отображается
- Устранены возможные ошибки при запуске в VSCode >=1.98 (Electron 34+)
- Улучшена поддержка vscode.workspaceFolders в edge-cases

---



## [0.5.5] - 2025-03-25

### Initial release
- Базовая версия с hover и autocomplete для простых типов
- Работа с Tokens Studio JSON
- Поддержка цветовых превью для `$type: color`

---

## [0.5.4] - 2025-03-31

### Added
- Иконка расширения в стиле Tokens Studio
- Полноценный `README.md` для публикации
- Поддержка VSCode >= 1.98 и Electron 34
- Поддержка тем VSCode (light / dark)
- Поддержка новых unit-выражений (`px`, `em`, `rem`, `%`, `s`, `deg`, и др.)

### Fixed
- Критический баг: `mathjs` больше не падает при выражениях с `px` и подобными
- Стабильность работы с вложенными токенами
- Hover больше не ломается на неразрешённых или некорректных цепочках
- Фильтрация цепочек от технических токенов улучшена

### Improved
- Полный рефакторинг TokenResolver (повышена скорость и читаемость)
- Упрощена логика `TokenHoverProvider`
- Hover-подсказки стали быстрее за счёт кэширования и оптимизаций
- Оптимизированы рендеры для complex types (`composition`, `boxShadow`, `typography`)

---