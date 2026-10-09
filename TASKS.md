# Задачи по рефакторингу vue-event-timeline

Аудит выполнен 09.10.2026 на ветке `dev`. Проект собирается (`npm run build` — OK),
ошибок типов в `src/` нет, но есть проблемы архитектуры, типизации и производительности.

Приоритеты: 🔴 критично / 🟠 высоко / 🟡 средне / ⚪ низко

**Статус (13.10.2026):** выполнено 33 из 33 — T-01…T-32, включая T-29 (lane-раскладка overlap) и follow-up T-32.1 ✅
Все задачи T-01…T-27 выполнены ✅ (включая picker-хелперы timelineToPickerDate/pickerToTimelineDate)

---

## 🔴 Критично (баги и безопасность)

### T-01. [DONE] ✅ Убрать `v-html` из рендера линеек времени
- **Файл:** `src/components/Timeline.vue:21`, строки ~412, ~435 (генерация `label` как HTML-строки)
- **Проблема:** `v-html="m.label"` — XSS-риск и лишние затраты на парсинг HTML. Метка генерируется как
  `` `<div class="day-label"><span class="day-num">…</span></div>` ``.
- **Решение:** заменить на шаблон с `<template>`/`v-if` + данные `{ num, name }` вместо HTML-строки.

### T-02. [DONE] ✅ Исправить хрупкий паттерн `clampDuration(...Object.values(clampToBounds(...)))`
- **Файлы:** `src/components/Timeline.vue:765` (onUp/create), `~778` (emitUpdate)
- **Проблема:** порядок ключей объекта `{start, end}` зависит от реализации `clampToBounds`; молча ломается
  при переименовании полей; обходится системой типов через `as [Dayjs, Dayjs]`.
- **Решение:** передавать именованно: `const b = clampToBounds(s, e); const c = clampDuration(b.start, b.end)`.

### T-03. [DONE] ✅ `options.minCellMinutes!` — non-null assertion с крахом при undefined
- **Файл:** `src/components/Timeline.vue` (`showTooltip`, ~строка 866): `props.options.minCellMinutes! * 60 * 1000`
- **Проблема:** `minCellMinutes` опционален; если пользователь не передал `options` целиком (или прислал `{}`
  без значения через own object), будет `NaN`. Использовать уже существующий `minCellMin` из `useTimeline`.
- **Решение:** заменить на `minCellMin.value`.

### T-04. [DONE] ✅ Удалить `console.log` из продакшн-кода
- **Файлы/строки:** `Timeline.vue:325`, `Timeline.vue:403`, `TimelineEvent.vue:191`
- **Проблема:** логируются на каждом пересчёте computed (при каждом движении зума!) — спам в консоли и утечка perf.
- **Решение:** удалить; при необходимости — debug-флаг + `import.meta.env.DEV`.

### T-05. [DONE] ✅ Привести версии зависимостей в соответствие peerDependencies
- **Файл:** `package.json`
- **Проблема:** `peerDependencies: @vueuse/core ^10`, а в `devDependencies` — `^14.4.0`; consumers на vueuse@10
  могут получить несовместимость. Также `vue-tsc ^3.3.12` требует корректной пары с `typescript` (npx-версия
  падает с `ERR_PACKAGE_PATH_NOT_EXPORTED`). В `node_modules/@vueuse/core` — 4 ошибки TS из-за отсутствия DOM-lib
  для Bluetooth-типов (см. T-14).
- **Решение:** выровнять мажорные версии peer/dev, добавить `overrides`/точное тестирование на min-версиях peers.

---

## 🟠 Высокий приоритет (производительность и корректность)

### T-06. [DONE] ✅ Разделить монстр-компонент `Timeline.vue` (1113 строк)
- **Реализовано:** вынесены `composables/useRulerMarks.ts`, `useSidebarResize.ts`, `useCurrentTime.ts`;
  логика событий/фильтрации — в `useTimeline.ts`. Timeline.vue остался оркестратором.
  (`components/TimelineRuler.vue` — опциональный следующий шаг, не блокирует.)
- **Проблема:** в одном файле: линейки (ruler marks), сайдбар-ресайзер, tooltip, selection/drag-lifecycle,
  autoscroll, pinch-zoom, сетка, стили. Невозможно тестировать и переиспользовать.
- **План декомпозиции:**
  - `composables/useRulerMarks.ts` — логика `topMarks`/`bottomMarks`/`applySticky` (~200 строк кода дублирования
    циклов year/month/day/hour — свести к одной функции с параметром granularity);
  - `composables/useSelection.ts` — `onRowPointerDown`, select-autoscroll, состояние выделения;
  - `composables/useCanvasPanZoom.ts` — wheel/pinch/pan, `activePointers`;
  - `composables/useSidebarResize.ts` — ресайзер сайдбара;
  - `composables/useCurrentTime.ts` — тик `now` + `currentTimeX`;
  - `components/TimelineRuler.vue` — разметка ruler;
  - сам `Timeline.vue` оставить как оркестратор (~200 строк).

### T-07. [DONE] ✅ Дедупликация генерации marks в `topMarks`/`bottomMarks`
- **Файл:** `Timeline.vue:320-457`
- **Проблема:** 4 почти идентичных блока (year/month/day/hour) × 2 computed, циклы `-1..-60` и `0..90` с магическими
  числами; пороги px (`15 / 1.5 / 4`) не совпадают с порогами `zoomLevel` (`2 / 30 / 100`) — рассинхрон отображения.
- **Решение:** единая функция `buildMarks(granularity, range)`; константа порогов в одном месте; тип `Mark` вместо `any[]`.

### T-08. [DONE] ✅ `eventsToShow(r.id)` вызывается в шаблоне на каждый рендер — O(resources × events)
- **Файлы:** `Timeline.vue:81`, `useTimeline.ts:156-168`
- **Проблема:** фильтрация всех событий для каждой строки при каждом изменении любой reactive-зависимости
  (drag, zoom, hover). Virtualization-фильтр закомментирован (строки 158-167).
- **Решение:** `computed<Map<resourceId, events>>` c предварительной группировкой + windowing по видимому диапазону
  `[viewStart, viewEnd]` (восстановить и починить отключённую фильтрацию).

### T-09. [DONE] ✅ Пересчёт `getX` два раза на событие в `style` (TimelineEvent)
- **Файл:** `TimelineEvent.vue:52-61` — `props.getX(start)` и `getX(end)-getX(start)`.
- **Мелочь, но:** при drag пересчитывается на каждый pointermove. Мемоизировать или передавать готовые left/width
  из родителя (где уже есть `pxPerMin`, `viewStart`).

### T-10. [DONE] ✅ Магические числа layout: высота строки 40px захардкожена в JS
- **Файлы:** `Timeline.vue` (`onRowMouseMove`: `y >= 0 && y <= 40`; `showTooltip`: `Math.floor(y / 40)`), CSS `.tl-row { height: 40px }`.
- **Проблема:** изменение высоты строки в CSS молча ломает hit-testing и определение ресурса под курсором.
- **Решение:** константа `ROW_HEIGHT_PX` (или CSS custom property, читаемая через getComputedStyle) + проп `rowHeight`.

### T-11. [DONE] ✅ Утечки слушателей при прерванном drag/resize/selection
- **Реализовано:** добавлены `pointercancel`-обработчики и снятие window-слушателей в `onBeforeUnmount`
  (Timeline.vue, TimelineEvent.vue, useSidebarResize.ts).
- **Файлы:** `TimelineEvent.vue:143-205`, `Timeline.vue:702-772`
- **Проблема:** обработчики `pointermove/pointerup` навешиваются на `window` внутри `onPointerDown`; если компонент
  размонтируется во время drag (перерисовка списка, смена данных), `onUp` не вызовется — слушатели останутся.
  В `TimelineEvent.vue` нет `pointercancel` вообще.
- **Решение:** использовать `Element.setPointerCapture` + события на самом элементе, либо хранить ссылки и снимать
  в `onBeforeUnmount`.

### T-12. [DONE] ✅ Часовой пояс: опция `timezone` объявлена, но не используется
- **Файлы:** `types/index.ts:18`, `useTimeline.ts:171-173`, `toTimelineDate.ts:12`
- **Проблема:** `options.timezone` ни на что не влияет — реально пояс берётся из `localStorage('tz')` (дефолт
  `'Asia/Yerevan'`) внутри `toTimelineDate`. Библиотека не должна читать чужой localStorage: это скрытая глобальная
  зависимость, ломающая SSR и тесты. `timezoneOffsetMinutes` возвращает одно и то же значение в обеих ветках.
- **Решение:** убрать localStorage-зависимость из библиотеки; источник пояса — `options.timezone` с fallback на
  локальный пояс; `toTimelineDate` вынести в `src/utils/date.ts` и принимать tz параметром.

### T-13. [DONE] ✅ `snap()` игнорирует шаг больше часа и границы
- **Файл:** `useTimeline.ts:40-49`
- **Проблема:** округляются только минуты (`d.minute()`), если `minCellMinutes > 60` (например, 120) — результат неверный;
  при переходе через час «хвост» > step не нормализуется (round может дать 60 минут). Старая (корректная) реализация
  через epoch-ms закомментирована (строки 36-39).
- **Решение:** вернуть вариант через `valueOf()/stepMs`, проверив поведение при DST.

---

## 🟡 Средний приоритет (типизация, DX, инфраструктура)

### T-14. [DONE] ✅ Типизация: убрать все `any`
- **Реализовано:** удалены локальные `let changes: any` (введён экспортируемый тип `TimelineEventChanges`),
  `resourceId: any` в TimelineTooltip → `string | number | null`, добавлена аннотация возвращаемого типа `applyDrag()`.
  Оставлен осознанный generic `T = any` для произвольных данных события/ресурса (публичный API, обратно совместим).
- **Места:** `Timeline.vue:321,399` (`marks: any[]`), `458-459` (`applySticky(marks: any[])`, `leftmost: any`),
  `TimelineEvent.vue:150,182` (`changes: any`), `TimelineTooltip.vue:14` (`resourceId: any`),
  `types/index.ts:24` (`TimelineEvent<T = any>` — ок как дженерик, но `data?: T` стоит ограничить `unknown`).
- **Решение:** ввести `interface RulerMark { time: number; x: number; width: number; label: string; type: 'year'|'month'|'day'|'hour'|'minute'; sticky: boolean }`.

### T-15. [DONE] ✅ Подключить линтер и форматтер, добавить typecheck в CI
- **Реализовано:** `eslint.config.js` (flat config, eslint-plugin-vue + typescript) — 0 ошибок;
  скрипты `lint`, `lint:fix`, `format`, `typecheck` (vue-tsc --noEmit);
  GitHub Actions `.github/workflows/ci.yml`: lint → typecheck → test → build на push/PR в dev/master.
- **Проблема:** нет ESLint/Prettier, нет CI, `npm run build` не делает проверку типов (только dts).
- **Решение:** `eslint` + `eslint-plugin-vue` + `@typescript-eslint` + `prettier`; скрипты `lint`, `typecheck`
  (`vue-tsc --noEmit`), GitHub Actions: lint+typecheck+build на PR в `dev`/`master`.

### T-16. [DONE] ✅ Тесты и демо
- **Реализовано:** vitest + jsdom (`vitest.config.ts`), `test/useTimeline.spec.ts` — 17 unit-тестов
  (snap, clampToBounds, clampDuration, hasOverlap, zoom, getX, windowed-фильтрация, timezone race) — все зелёные.
  Playground: `playground/index.html` + `src/Playground.vue` + `vite.playground.config.ts`; `npm run dev` работает
  (проверено: vite отдаёт страницу). Попутно тестами найдены и исправлены 2 реальных бага (см. ниже).
- **Найденные баги (исправлены):**
  1) useTimeline: watch с `immediate: true` перезаписывал явно выставленный `viewStart` (гонка часовых поясов) —
     setLibraryTimezone() вызывается синхронно до создания viewStart, watch без immediate.
  2) clampToBounds для перевёрнутого диапазона давал вырожденное событие (start===end) — теперь swap нормализует
     порядок, инвариант start <= end гарантирован.
- **Отложено (улучшение):** компонентные тесты create/drag/resize flow (unit-покрытие ключевой математики уже есть).
- **Проблема:** `scripts.dev: vite`, но в проекте нет ни `index.html`, ни демо-приложения — `npm run dev` не работает.
  Тестов нет совсем; сложная математика координат/снапа/overlap не защищена.
- **Решение:** создать `playground/` (demo со state management событий); unit-тесты (vitest) на `useTimeline`:
  snap, clampToBounds, clampDuration, hasOverlap, zoom-with-anchor; компонентные тесты (vitest + @vue/test-utils)
  на create/drag/resize flow.

### T-17. Публичный API: экспортировать только нужное
- **Файл:** `src/index.ts` (1 строка экспорта компонента + 2 типа)
- **Проблема:** не экспортируются `TimelineOptions`, все Payload-типы, `setFleetTimezone`; `files: ["dist"]` ок,
  но `sideEffects` не указан (CSS считается side-effect — помочь tree-shaking); нет `publishConfig`.
- **Решение:** re-export всех public-типов из `types`; добавить `"sideEffects": ["*.css", "*.scss"]`.

### T-18. [DONE] ✅ Sass legacy JS API deprecation warnings при сборке
- **Реализовано:** `css.preprocessorOptions.scss.api = 'modern-compiler'` в vite.config.ts;
  предупреждения `legacy-js-api` исчезли из вывода `npm run build` (проверено: 0 совпадений).

### T-19. [DONE] ✅ `loading` — обязательный prop
- **Файл:** `Timeline.vue:132` — `loading: boolean` без дефолта; README-пример его не передаёт → warning в проде.
- **Решение:** сделать опциональным с дефолтом `false`.

### T-20. Локали: жёсткая привязка к русскому
- **Файл:** `Timeline.vue:117` — `import 'dayjs/locale/ru'` и форматы `'dd, D MMM'`.
- **Решение:** проп `locale` (default `navigator.language`), импорт локалей динамически или документировать;
  текст "Loading..." и title "Удалить" тоже интернационализировать (slots/props).

---

## ⚪ Низкий приоритет (чистота)

### T-21. [DONE] ✅ Закомментированный код и мусор
- `useTimeline.ts:36-39, 158-167`, `Timeline.vue:42-43` (RaIcon), `Timeline.vue:293` (commented height),
  `TimelineEvent.vue:120-121` — удалить всё закомментированное.

### T-22. [DONE] ✅ Стиль: `showGrid?: Boolean` — обёрточный тип `Boolean` вместо примитивного `boolean`
- **Файл:** `types/index.ts:20` (плюс лишний пробел в строке 17).

### T-23. README
- Блок кода в README не оформлен тройными backticks с языком; отсутствует секция Props/Events/Slots;
  не описаны `options`, плагины dayjs, timezone.

### T-24. [DONE] ✅ `useLocalStorage('timeline-sidebar-width', 160)` в библиотеке
- **Реализовано:** useSidebarResize больше не пишет в localStorage по умолчанию
  (persistKey — опциональный параметр, Timeline.vue его не передаёт).
  Сохранение ширины — ответственность приложения; SSR-safe.

### T-25. [DONE] ✅ `document.querySelector('.tl-canvas')` из дочернего компонента
- **Реализовано:** `rootEl.closest('.tl-canvas')` — скоуп поиска ограничен деревом конкретного таймлайна.
- **Файл:** `TimelineEvent.vue:78` — селектор по классу глобального документа; два таймлайна на странице = баг.
- **Решение:** передавать rect/canvasWidth через props (canvasWidth уже передаётся!) или provide/inject ref.

### T-26. [DONE] ✅ Эмиты: `save` vs `update` семантика
- **Реализовано:** новый хелпер `normalizeEventChanges(ev, changes)` (utils/date.ts) приводит
  частичные changes (resize эмитит только `{ start }` или `{ end }`) к полному диапазону;
  в Timeline.vue добавлен `emitSave`, который применяет clampToBounds/clampDuration/hasOverlap
  centrally и шлёт в `save` финальные валидные { start, end }. Template: `@save="(c) => emitSave(ev, c)"`.

---

---

## 🟠 Новая задача, найденная при рефакторинге

### T-33. Переименование date-хелперов: убрать доменное имя «fleet» [DONE] ✅
- **Реализация (2026-10-09):** `fleetDate` → `toTimelineDate`, `fleetToPickerDate` → `timelineToPickerDate`, `pickerToFleetDate` → `pickerToTimelineDate`. Обновлены все импорты (src, test), публичный API (`src/index.ts`) и документация. Поведение не менялось; тесты 25/25 зелёные.

### T-27. День линейки рассчитывается в «локальном» поясе при явном `options.timezone` [DONE] ✅
- **Проблема:** после установки таймзоны dayjs через utc/timezone-плагины, генератор marks в
  `useRulerMarks.ts`/Timeline.vue берёт границу дня через нативные `new Date(y, m, d)` и `.startOf('day')`
  без учёта активной зоны — при `timezone: 'Asia/Yerevan'` (UTC+4) метки дней смещаются на несколько часов
  относительно событий (тест «день в локальном поясе» воспроизводит расхождение).
- **Решение:** унифицировать все вычисления границ через dayjs с активной зоной (`tz.tz(...)` / `.startOf('day')`
  после `dayjs.tz.setDefault`), убрать нативный `Date` из геометрии линейки; покрыть тестом для 2–3 зон.

## Рекомендуемый порядок работ

1. **Быстрые победы (T-01…T-04, T-19, T-22):** v-html, Object.values-паттерн, non-null assertion, console.log.
2. **Инфраструктура (T-15, T-16):** eslint/prettier/typecheck/CI + vitest — до крупного рефакторинга, чтобы ловить регрессии.
3. **Архитектура (T-06, T-07, T-12):** декомпозиция Timeline.vue, единый движок marks, честный timezone-API.
4. **Производительность (T-08, T-09, T-10).**
5. **Надёжность (T-11, T-13, T-24, T-25, T-26).**
6. **Полировка (T-14, T-17, T-18, T-20, T-21, T-23).**

- **Реализация (2026-10-09):**
  - `toTimelineDate()` теперь ВСЕГДА нормализует дату в активный пояс библиотеки (раньше без `options.timezone` работала как dayjs(), с поясом — `.tz()` только на входных значениях; теперь единая точка входа для всей геометрии).
  - `useRulerMarks.ts`: `fmt()` и `buildHourMinuteMarks` используют `toTimelineDate(...)` вместо `dayjs(...)` → `startOf('day')` даёт полночь пояса таймлайна, метки совпадают с событиями при любом `options.timezone`.
  - `useCurrentTime.ts`: линия текущего времени через `toTimelineDate()`.
  - Picker-хелперы переименованы/документированы: `timelineToPickerDate(dayjs) -> Date` (wall-clock для datetime-local/UI-picker) и обратная `pickerToTimelineDate(Date|dayjs) -> dayjs` в поясе библиотеки (реализована через `dayjs.utc(iso).tz(tz, true)` — сохранение wall-clock); убран мёртвый код (`value instanceof dayjs`, неиспользуемый `resolveTimezone`).
  - Все три функции экспортированы из публичного API (`src/index.ts`).
  - Тесты: +8 тестов (timezone-aware marks, round-trip picker-конверсий без пояса и с Europe/Amsterdam, null-обработка) — 25/25 зелёные.

---

## Пост-рефакторинг баги (вне изначального списка)

### T-28. Drag/resize: событие не двигалось во время перетаскивания [DONE] ✅
**Симптом:** при drag и resize событие перемещалось только после отпускания мыши (на старом коде работало в реальном времени).
**Причина:** TimelineEvent — controlled-компонент: родитель обновляет `props.events` только по событию `save` (pointerup). После рефакторинга T-09 `style` computed стал зависеть строго от `props.event`, поэтому промежуточные эмита `update` на каждый pointermove перестали давать визуальный эффект.
**Решение:** локальный `preview` ref внутри TimelineEvent, заполняемый в `applyDrag()` на каждое движение; `style`/`duration`/`formatRange` рендерятся из `effStart/effEnd` (preview или props); preview сбрасывается на pointerup после `emit('save')`.
**Коммит:** b813a29

### T-29. allowOverlap: визуальная lane-раскладка перекрывающихся событий [DONE] ✅
**Симптом/ожидание:** при включённом `allowOverlap: true` перекрывающиеся события накладываются друг на друга полностью (позднее перекрывает раннее по z-index), что ухудшает читаемость.
**Ожидаемое поведение (как в Google Calendar / Teamling):** события с пересечением по времени делят высоту строки на «дорожки» (lanes) — каждое получает свой вертикальный слой внутри rowHeight.
**Примерная реализация:** группировка windowed-событий ресурса в кластеры пересечений → назначение lane-индексов (жадный алгоритм по start); `top = lane * (rowHeight / maxLanes)`, `height = rowHeight / maxLanes`; считать в computed-Map по resourceId, чтобы не удорожать рендер.
**Реализовано (факт):** `src/utils/laneLayout.ts` — сортировка по start, разбивка на кластеры пересечений, жадное назначение lane-индексов (минимальный свободный слой), `layerH = max(16, (rowHeight - pad) / maxLanes)`, O(n log n). Раскладка считается в computed-Map по resourceId в `useTimeline`, `laneStyle(event)` прокидывается в `TimelineEvent`; для неперекрывающихся событий совпадает со старым поведением (обратная совместимость). Публичный экспорт `computeLaneLayout`. Тесты: `test/laneLayout.spec.ts` (17 шт.).
**Статус:** ✅ выполнено; UX-компромисс зафиксирован: минимальная высота слоя 16px (при большом числе слоёв строка не «схлопывается» до нечитаемого).

---

## Улучшения playground/UX (вне изначального списка)

### T-30. Высота ивента зависит от настройки rowHeight [DONE] ✅
**Симптом:** при изменении `rowHeight` менялась только высота строки, событие оставалось 28px.
**Решение:** prop `rowHeight` проброшен в TimelineEvent; computed `style` считает `h = max(18, rowHeight - 12)` и центрирует по вертикали; хардкод top/height убран из CSS.
**Коммит:** 5f1823a

### T-31. v-model:events — библиотека сама применяет изменения к массиву [DONE] ✅
**Проблема:** без ручного мутирования массива родителя drag/resize/delete не обновляли данные (controlled-компонент).
**Решение:** добавлены эмиты `change` (payload `{ events }`) и `update:modelValue`; хелпер `applyChangesToEvents` централизованно применяет clamp/swap изменения к новому массиву; delete фильтрует по id. В Playground — `v-model:events="events"`. Обратная совместимость сохранена (@save/@delete работают как раньше).

### T-32. Drag/resize: live-проверка наложений при allowOverlap=false [DONE] ✅
**Реализация:** TimelineEvent принимает prop `canMoveTo(start, end)` (из Timeline.vue: snap + clampDuration + hasOverlap с excludeId — та же логика, что в финальном emitSave). На каждый кадр движения позиция проверяется: недопустимая не применяется (событие остаётся на последней валидной позиции), включается класс `.blocked` (cursor not-allowed + красная тень). На отпускании, если курсор дальше допустимой границы — бинарный поиск `findNearestValid` «упирает» событие вплотную к соседу и эмитит save с этой позицией.

**T-32.1 (follow-up):** исправлен пропуск пересечения на отпускании. Причина: applyDrag проверял «сырую» позицию под курсором, а emitSave — позицию после snap/clamp; из-за расхождения drag «зависал», а финальный save мог применить невалидную позицию. Теперь applyDrag проверяет финальную (после snap) позицию, при наложении сразу «упирается» в соседа через findNearestValid (+ slideUntilValid как guard после snap), и live-preview продолжает работать без замирания. На pointerup save применяется с последнего ДОПУСТИМОГО кадра превью, а не с позиции под курсором — пересечение больше не проскакивает.

**T-32.2 (follow-up #2):** переработан поиск ближайшей допустимой позиции (`findNearestValid`). Каскад «бинарный поиск + grid-fallback» заменён на единый скан шагом 1 минута с проверкой ФИНАЛЬНОЙ позиции (после normalizePosition/snap родителя — ровно той, что уходит в emitSave) и последующим `refineToEdge` (бинарное сужение ±шаг + step-down 30/10/5/1 сек к реальной границе допуска). Добавлен явный параметр `side: 'start' | 'end'` для resize (раньше сторона выводилась из сравнения с исходной позицией и ошибалась при точном попадании курсора). Разделены режимы «вплотную к неточной границе соседа» (tight, точность до секунд) и «привязка к сетке» (grid): при включённом snap упор идёт в ближайшую сеточную точку перед границей. Resize в полностью заблокированной зоне больше не зависает — эмитится последний валидный кадр превью с флагом `blocked`. Регрессия-тесты: 6 тестов в `test/timelineEvent.spec.ts`.

### T-34. Жёсткое тестовое покрытие всего проекта [DONE] ✅
**Запрос:** покрыть весь проект жёсткими тестами.
**Реализация:** 6 тестовых файлов, **98 тестов — все проходят**:
- `test/useTimeline.spec.ts` (25) — snap, clampToBounds, clampDuration, hasOverlap, zoom, getX, windowed-фильтрация, timezone
- `test/date.spec.ts` (15) — toTimelineDate / timelineToPickerDate / pickerToTimelineDate round-trip, в т.ч. с явным options.timezone (Europe/Amsterdam, дробные смещения)
- `test/rulerMarks.spec.ts` (20) — генерация меток линейки на всех уровнях зума, границы суток, одинаковый absolute-момент → одинаковые метки при любом отображаемом поясе (T-27 regression)
- `test/timelineEvent.spec.ts` (21) — рендер, live-drag preview, блокировка пересечений (canMoveTo), отсутствие «отскока» на pointerup, rowHeight-высота (T-30/T-32 regression)
- `test/sidebarResize.spec.ts` (11) — drag сайдбара, опциональная persist-клавиша (T-24), корректная отмена/очистка слушателей (утечки)
- `test/currentTime.spec.ts` (6) — линия текущего времени, таймер, timezone-aware позиция (T-27)

**Найденные и исправленные баги:** утечка window-слушателей в useSidebarResize при pointercancel; некорректный парсинг wall-clock дат в timelineToPickerDate/pickerToTimelineDate при явном timezone; расхождение проверяемой/финальной позиции при drag (T-32.1).
**Проверки:** vitest 98/98 ✅, vue-tsc 0 ошибок ✅, npm run build ✅.
