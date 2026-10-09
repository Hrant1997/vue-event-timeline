import dayjs from 'dayjs'

/** Настройки компонента */
export interface TimelineOptions {
  allowOverlap?: boolean
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
  showCurrentTime?: boolean
  showGrid?: boolean
}

/** Ивент с дженериком для кастомных данных */
export interface TimelineEvent<T = any> {
  id: string | number
  start: dayjs.Dayjs
  end: dayjs.Dayjs
  resourceId: string | number
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
  
}