# vue-event-timeline

Легковесный и кастомизируемый компонент таймлайна (Gantt/scheduler) для Vue 3 + TypeScript.

## Установка

```bash
npm install vue-event-timeline dayjs @vueuse/core
```

Peer-зависимости: `vue ^3.3`, `dayjs ^1.11`, `@vueuse/core >=10`.

Подключите стили один раз (в main.ts или через CSS-импорт):

```ts
import 'vue-event-timeline/dist/style.css'
```

## Использование

```vue
<script setup lang="ts">
import { ref } from 'vue'
import dayjs from 'dayjs'
import { EventTimeline, type TimelineEvent, type TimelineResource } from 'vue-event-timeline'

const resources = ref<TimelineResource[]>([
  { id: 1, title: 'Автобус №12' },
  { id: 2, title: 'Автобус №7' },
])

const events = ref<TimelineEvent[]>([
  {
    id: 'e1',
    resourceId: 1,
    start: dayjs().startOf('hour'),
    end: dayjs().add(90, 'minute'),
    title: 'Рейс А',
    color: '#3b82f6',
  },
])

function handleCreate(payload: { event: Omit<TimelineEvent, 'id'> }) {
  // создать событие на бэке, затем добавить в events с id
}
</script>

<template>
  <EventTimeline
    :events="events"
    :resources="resources"
    :options="{ minCellMinutes: 15, canCreate: true, showCurrentTime: true }"
    @create="handleCreate"
  />
</template>
```

## Props

| Prop | Тип | По умолчанию | Описание |
|---|---|---|---|
| `events` | `TimelineEvent[]` | — | Список событий (обязательно) |
| `resources` | `TimelineResource[]` | — | Ряды/ресурсы (обязательно) |
| `options` | `TimelineOptions` | `{ allowOverlap: false, minCellMinutes: 15, canCreate: true, showCurrentTime: true }` | Настройки (см. ниже) |
| `loading` | `boolean` | `false` | Показать оверлей загрузки (slot `loading`) |
| `rowHeight` | `number` | `40` | Высота строки ресурса в px (используется и в hit-testing) |
| `locale` | `string` | язык браузера / `'en'` | Локаль dayjs для названий дней/месяцев (`'ru'` подгружается лениво) |
| `deleteTitle` | `string` | `'Delete'` | Подсказка кнопки удаления на событии |

### `options: TimelineOptions`

| Ключ | Тип | Описание |
|---|---|---|
| `allowOverlap` | `boolean` | Разрешить пересечение событий в одном ряду |
| `minCellMinutes` / `maxCellMinutes` | `number` | Шаг сетки при зуме (мин/макс) |
| `minDurationMinutes` / `maxDurationMinutes` | `number` | Ограничения длительности события |
| `minDate` / `maxDate` | `Dayjs` | Границы рабочего диапазона |
| `canCreate` / `canEdit` / `canDelete` | `boolean` | Global-флаги (у события можно переопределить точечно) |
| `initialPxPerMin` | `number` | Стартовый масштаб |
| `zoomRange` | `{ min, max }` | Пределы зума |
| `eventGapMinutes` | `number` | Минимальный зазор между событиями |
| `timezone` | `string` | IANA-пояс, напр. `'Asia/Yerevan'` (см. Часовой пояс) |
| `locale` | `string` | То же, что prop `locale` (prop имеет приоритет) |
| `showCurrentTime` | `boolean` | Линия текущего времени |
| `showGrid` | `boolean` | Вертикальная сетка |

## События (emits)

| Событие | Payload | Когда |
|---|---|---|
| `create` | `{ event: Omit<TimelineEvent, 'id'> }` | Пользователь выделил диапазон и подтвердил создание |
| `update` | `{ event, changes }` | Во время drag/resize (промежуточные значения) |
| `save` | `{ event, changes }` | По завершении drag/resize — финальные **валидные** даты (после clamp границ/длительности) |
| `delete` | `{ event }` | Нажата кнопка удаления |
| `select` | `{ event \| null }` | Клик по событию / вне его |
| `hover` | `{ time, resourceId }` | Наведение на ячейку |
| `changeViewport` | `{ start, end }` | Изменилось видимое окно (скролл/зум) |

## Слоты

| Слот | Scoped-данные | Назначение |
|---|---|---|
| `header` | `viewStart`, `zoomLevel` | Кастомная шапка над линейками |
| `sidebar-item` | `resource` | Содержимое строки ресурса (по умолчанию `resource.title`) |
| `event` | `event`, `duration` | Контент карточки события |
| `loading` | — | Замена текста «Loading…» |

## Часовой пояс

Библиотека работает в поясе, который вы установите явно:

```ts
import { setLibraryTimezone } from 'vue-event-timeline'

setLibraryTimezone('Asia/Yerevan') // null — сброс на локальный пояс системы
```

`localStorage` библиотека не читает и не пишет — единственный источник пояса — ваш код.

## Публичный API

Экспортируются: компонент `EventTimeline`, типы `TimelineEvent`, `TimelineResource`, `TimelineOptions`, `TimelineSelection`, `TimelineEmits`, все payload-типы, `RulerMark`, а также `setLibraryTimezone` / `getLibraryTimezone`.

## Разработка

```bash
npm install
npm run build   # vite build + dts
```

## Темизация (CSS переменные)

Все цвета и размеры компонента вынесены в CSS custom properties, объявленные на корневом элементе `.tl-root` (цвета карточек событий — на `.tl-event`). Их можно переопределять извне без сборки библиотеки — достаточно задать переменные на любом родительском контейнере или на `:root`.

### Light / Dark

Тёмная тема включается автоматически атрибутом `data-theme="dark"` на `<html>` (перебивает light-значения):

```html
<html data-theme="dark">
```

### Полный список переменных

| Переменная | По умолчанию (light) | Тёмная тема | Что задаёт |
|---|---|---|---|
| `--border-color` | `#5656563a` | `#676767` | Границы сетки, разделители рядов/линеек |
| `--ra-text` | `#111827` | `#f9fafb` | Основной текст (названия ресурсов, месяцы/годы) |
| `--text-secondary` | `#6b7280` | `#9ca3af` | Вторичный текст (сутки, подписи делений) |
| `--ra-aside-bg` | `#ffffff` | `#1f2937` | Фон линейки времени и сайдбара |
| `--hover-sidebar-bg` | `#e5e7eb` | `#37415174` | Подсветка строки сайдбара при ховере |
| `--hover-row-bg` | `#a1aebb51` | `#3e526e91` | Подсветка ряда при ховере |
| `--hover-cell-bg` | `#b1c3e7ee` | `#4d6d9991` | Фон ячейки-плейсхолдера («+») |
| `--plus-icon-color` | `#3770cd` | `#60a5fa` | Цвет иконки «+» и ресайзера сайдбара |
| `--plus-border-color` | `#93c5fd` | `#3b82f6` | Пунктирная рамка ячейки-плейсхолдера |
| `--ruler-line-color` | `#9ca3af` | — | Линии делений нижней линейки |
| `--tl-row-height` | `40px` | — | Высота ряда. Управляется prop `rowHeight` (inline-стиль имеет приоритет над CSS) |
| `--tl-event-text-color` | `#fff` | — | Текст заголовка/длительности события |
| `--tl-event-shadow` | `0 2px 8px rgba(37,99,235,.3)` | — | Тень карточки события |
| `--tl-event-shadow-hover` | `0 4px 12px rgba(37,99,235,.4)` | — | Тень события при наведении |
| `--tl-event-blocked-shadow` | `0 2px 10px rgba(239,68,68,.55)` | — | Тень события в недопустимой позиции (`allowOverlap: false`) |
| `--tl-event-handle-bg` | `rgba(255,255,255,.2)` | — | Фон ручек resize по краям события |
| `--tl-event-handle-bg-hover` | `rgba(255,255,255,.5)` | — | То же при наведении |
| `--tl-event-delete-bg` | `#ef4444` | — | Фон кнопки удаления события |
| `--tl-event-delete-color` | `#fff` | — | Крестик кнопки удаления |

Пример переопределения извне:

```css
/* вся страница */
:root {
  --border-color: #e5e7eb;
  --ra-aside-bg: #fafafa;
}

/* только внутри конкретного контейнера */
.my-scope {
  --plus-icon-color: rebeccapurple;
  --tl-event-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}
```

### SCSS-переменные (при сборке из исходников)

В `<style lang="scss">` компонентов каждая CSS-переменная порождена из SCSS-переменной с `!default` (`$border-color`, `$row-height`, `$event-shadow` и т.д. — см. начало style-блоков `Timeline.vue` и `TimelineEvent.vue`). Если вы собираете библиотеку из исходников, значения по умолчанию можно переопределить до импорта стилей:

```scss
// ваш overrides.scss, импортируется ДО стилей компонента
$border-color: #e5e7eb;
$plus-icon-color: rebeccapurple;
@use 'vue-event-timeline/src/components/Timeline.vue'; // или ваши локальные правки
```

Для потребителя npm-пакета достаточно CSS custom properties из таблицы выше — они работают без пересборки.

## Лицензия

MIT
