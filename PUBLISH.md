# Публикация SXL Resolver

## 1. Опубликовать ветку (push в remote)

Сейчас есть незакоммиченные изменения. Чтобы отправить ветку:

```bash
# Закоммитить изменения (если ещё не сделано)
git add -A
git commit -m "Refactor: new structure (core, providers, preview, hover)"

# Отправить ветку rebase в origin
git push origin rebase
```

Если ветка уже запушена и нужно обновить после коммита:

```bash
git push origin rebase
```

---

## 2. Опубликовать расширение в VS Code Marketplace

### Подготовка

1. **Пublisher**  
   Зайти на [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) и создать publisher (если ещё нет). ID в `package.json` — `andySobolev`.

2. **Personal Access Token (PAT)**  
   - [Azure DevOps → Personal access tokens](https://dev.azure.com) → User settings → Personal access tokens  
   - New Token → Custom defined → **Marketplace** → **Manage**  
   - Сохранить токен (показывается один раз).

### Публикация

```bash
# Сборка и упаковка .vsix (уже есть скрипт)
npm run build-all

# Вход в Marketplace (подставит запрос PAT)
npx @vscode/vsce login andySobolev

# Публикация (minor/patch при необходимости править version в package.json)
npx @vscode/vsce publish
```

Или одной командой (сборка + публикация):

```bash
npm run release
```

При первом запуске `vsce publish` потребуется ввести PAT.
