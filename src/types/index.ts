import dayjs from 'dayjs'

/**
 * Настройки группировки событий (T-36).
 * Группа — это значение одного из строковых полей события (по умолчанию 'type'):
 * event.groupField ?? options.eventGroups.field ?? 'type'.
 * Пример: события с type: 'rental' / 'service' и настройки
 *   eventGroups: { field: 'type', groups: { rental: { allowOverlap: false }, service: { allowOverlap: true } } }
 */
export interface EventGroupOptions {
  /**
   * Разрешить наложения внутри группы. Если не задана — используется
   * глобальный TimelineOptions.allowOverlap.
   * ВАЖНО: если глобальный allowOverlap === false, он имеет приоритет —
   * группа НЕ может разрешить наложения поверх глобального запрета.
   */
  allowOverlap?: boolean
}

export interface TimelineEventGroupsConfig {
  /** Поле события, задающее группу; default 'type' */
  field?: string
  /** Настройки по имени группы; для групп без настроек действует глобальный allowOverlap */
  groups?: Record<string, EventGroupOptions>
}

/** Настройки компонента */
export interface TimelineOptions {
  allowOverlap?: boolean
  /** T-36: per-group настройки allowOverlap (см. EventGroupOptions) */
  eventGroups?: TimelineEventGroupsConfig
  minCellMinutes?: number
  maxCellMinutes?: number
  minDurationMinutes?: number
  maxDurationMinutes?: number
  minDate?: dayjs.Dayjs
  maxDate?: dayjs.Dayjs
  canCreate?: boolean
  canDelete?: boolean
  canEdit?: boolean
  initialPxPerMin?: number
  zoomRange?: { min: number; max: number }
  eventGapMinutes?: number 
  timezone?: string // 🚀 НОВОЕ: например, 'Asia/Yerevan'
  /** T-20: локаль dayjs для названий дней/месяцев; default — язык браузера или 'en' */
  locale?: string
  showCurrentTime?: boolean
  showGrid?: boolean
  /**
   * Шаг сетки (в минутах) для округления позиций при drag/resize.
   * По умолчанию используется minCellMinutes; явное значение переопределяет его.
   */
  snapMinutes?: number
  // ---------------------------------------------------------------------
  // Touch / mobile (обратно совместимы: все ключи опциональны, дефолты —
  // константы из src/utils/touch.ts; мышиное поведение не меняется)
  // ---------------------------------------------------------------------
  /**
   * Touch-создание событий на пустом месте таймлайна:
   *  - 'tap'          — короткий тап создаёт событие (minDuration), свайп скроллит;
   *  - 'long-press'   — долгое нажатие + драг = выделение диапазона (тап не создаёт);
   *  - 'both' (default) — тап создаёт сразу, long-press+драг выделяет диапазон;
   *  - false          — touch-создание отключено (скролл и жесты остаются нативными).
   */
  touchCreate?: 'tap' | 'long-press' | 'both' | false
  /** Задержка лонг-пресса в мс (default 400) */
  touchLongPressMs?: number
  /** Допуск смещения пальца в CSS-px, пока жест считается «на месте» (default 10) */
  touchMoveThresholdPx?: number
  /**
   * Порог «подтверждения» touch-drag/resize на ручках в CSS-px (default 8):
   * до него жест ещё может быть перехвачен браузером для нативного скролла.
   */
  touchDragCommitPx?: number
  /**
   * Показывать на мобильных крупные touch-ручки перемещения и ресайза у
   * ВЫБРАННОГО события (default true). Визуально ручки компактны, но зона
   * попадания ≥ 40px; скрытые элементы — pointer-events: none.
   */
  showTouchHandles?: boolean
}

/** Ивент с дженериком для кастомных данных */
export interface TimelineEvent<T = any> {
  id: string | number
  start: dayjs.Dayjs
  end: dayjs.Dayjs
  resourceId: string | number
  /** T-36: имя группы события (например 'rental' / 'service') */
  group?: string
  /** T-36: локальный override — разрешить наложения для группы этого события */
  allowOverlap?: boolean
  data?: T
  canEdit?: boolean
  canDelete?: boolean
  canDrag?: boolean
  canResize?: boolean
  color?: string
  title?: string
  border?: string
}

/** Метка линейки времени (ruler mark) */
export interface RulerMark {
  time: number
  x: number
  width: number
  label: string
  type: 'year' | 'month' | 'day' | 'hour' | 'minute'
  sticky: boolean
}

/** Ресурс */
export interface TimelineResource {
  id: string | number
  title: string
  [key: string]: any
}

/** Выделение */
export interface TimelineSelection {
  resourceId: string | number
  start: dayjs.Dayjs
  end: dayjs.Dayjs
}

/** Payload для событий */
export interface TimelineCreatePayload<T = any> {
  event: Omit<TimelineEvent<T>, 'id'>
}

/** Промежуточные изменения drag/resize (payload эмитов `update`/`save`) */
export type TimelineEventChanges = Partial<Pick<TimelineEvent, 'start' | 'end'>>

/**
 * v-model:events — полный массив с уже применёнными изменениями.
 * Эмится при create/save/delete/update из коробки, чтобы потребителю
 * не нужно было вручную мутировать свой массив в каждом обработчике.
 */
export interface TimelineChangePayload<T = any> {
  events: TimelineEvent<T>[]
}

export interface TimelineUpdatePayload<T = any> {
  event: TimelineEvent<T>
  changes: Partial<Pick<TimelineEvent<T>, 'start' | 'end' | 'resourceId'>>
}

export interface TimelineDeletePayload<T = any> {
  event: TimelineEvent<T>
}

export interface TimelineSelectPayload<T = any> {
  event: TimelineEvent<T> | null
}

export interface TimelineHoverPayload {
  time: dayjs.Dayjs
  resourceId: string | number | null
}

export interface TimelineViewportPayload {
  start: dayjs.Dayjs
  end: dayjs.Dayjs
}

/** Emits с дженериками */
export interface TimelineEmits<T = any> {
  (e: 'create', payload: TimelineCreatePayload<T>): void
  (e: 'update', payload: TimelineUpdatePayload<T>): void
  (e: 'save',   payload: TimelineUpdatePayload<T>): void
  (e: 'delete', payload: TimelineDeletePayload<T>): void
  (e: 'select', payload: TimelineSelectPayload<T>): void
  (e: 'hover',  payload: TimelineHoverPayload): void
  (e: 'changeViewport',  payload: TimelineViewportPayload): void
  /** v-model:events — новый массив событий после create/save/delete/update */
  (e: 'change', payload: TimelineChangePayload<T>): void
  /** update:modelValue — алиас для v-model="events" */
  (e: 'update:modelValue', payload: TimelineEvent<T>[]): void
  
}