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

## Лицензия

MIT
