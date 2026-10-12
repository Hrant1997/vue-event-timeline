# План публикации: Playground-демо + релиз пакета

## Цель
1. Опубликовать `playground/` как демонстрационную версию (GitHub Pages).
2. Добавить ссылку на демо в README.
3. Обновить версию пакета и подготовить публикацию на npm.

## Шаги

### 1. Сборка Playground для статичного хостинга
- [x] Создать `vite.playground.build.config.ts` — сборка из корня `playground/`
      с `base: './'` (относительные пути — обязательно для GitHub Pages
      в подпапке `/<repo>/`).
- [x] Добавить npm-скрипты:
  - `build:playground` — сборка демо в `docs/`;
  - `deploy:demo` — `gh-pages`-деплой (опционально, если установлен gh-pages).

### 2. Публикация через GitHub Pages
- [ ] Настроить источник Pages: ветка `gh-pages` (или `docs/` в `main`) —
      в **Settings → Pages**.
- [ ] Запустить деплой (`npx gh-pages -d docs`) либо вручную закоммитить
      содержимое `docs/` в ветку `gh-pages`.
- [ ] Проверить живую ссылку: `https://<user>.github.io/vue-event-timeline/`.

### 3. README
- [x] Добавить секцию **«Демо (Playground)»** со ссылкой на GitHub Pages
      и инструкцией локального запуска (`npm install && npm run dev`).

### 4. Версия пакета
- [x] Поднять версию: `0.1.0 → 0.2.0` (minor — новая фича: собственный
      локализованный формат даты тултипа «20 окт. 19:45», публичные экспорты
      `TOOLTIP_DATE_FORMAT`, `normalizeDayjsLocale`, `useFormattedTooltipDate`).
- [ ] После мержа в основную ветку: `git tag v0.2.0 && git push --tags`.

### 5. Публикация на npm
- [ ] `npm login` (аккаунт с правом на пакет `vue-event-timeline`).
- [ ] Проверка чистоты артефакта: `npm run build && npm pack --dry-run`
      (в tarball должен попадать только `dist/`).
- [ ] `npm publish` (рекомендуется `--access public`, если пакет скоупный).
- [ ] Проверить установку: `npm i vue-event-timeline@0.2.0`.

## Чек-лист перед публикацией
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — зелёные.
- [x] `package.json`: `version = 0.2.0`, `files: ["dist"]`, peerDependencies ок.
- [ ] CHANGELOG / release notes тега v0.2.0 (что нового: tooltip date format).

## Примечания
- CI (`.github/workflows/ci.yml`) можно расширить job'ом деплоя Pages
  при пуше в `dev/master` — опционально, не блокирует публикацию.
- Если нет доступа к настройкам репозитория, альтернатива демо-хостингу:
  StackBlitz / CodeSandbox ссылка в README.
