// utils/date.ts — часовой пояс библиотеки (T-12)
// Библиотека НЕ читает localStorage: единственный источник пояса —
// options.timezone, переданный потребителем. Fallback — локальный пояс системы.

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

/** Активный часовой пояс (IANA name) или null = локальный пояс системы. */
let activeTimezone: string | null = null

/** Устанавливает часовой пояс библиотеки. null — сброс на локальный пояс. */
export function setLibraryTimezone(tz: string | null) {
  activeTimezone = tz && tz.trim() ? tz : null
}

export function getLibraryTimezone(): string | null {
  return activeTimezone
}

/**
 * T-26: нормализация changes, пришедших из TimelineEvent (drag/resize),
 * к полному валидному диапазону { start, end } относительно события.
 * Child эмитит сырые изменения (например, только { end }); родитель применяет
 * clamp/overlap centrally и получает финальные даты.
 */
export function normalizeEventChanges(
  ev: { start: dayjs.Dayjs; end: dayjs.Dayjs },
  changes: Partial<{ start: dayjs.Dayjs; end: dayjs.Dayjs }>
): { start: dayjs.Dayjs; end: dayjs.Dayjs } {
  const start = changes.start ?? ev.start
  const end = changes.end ?? ev.end
  return { start, end }
}

export function fleetDate(
  value?: string | number | Date | null
) {
  // Без явно заданного пояса — обычная локальная дата
  if (!activeTimezone) {
    return value == null ? dayjs() : dayjs(value)
  }
  return value == null ? dayjs().tz(activeTimezone) : dayjs(value).tz(activeTimezone)
}


/** Пояс для picker-хелперов: активный или локальный пояс системы. */
function resolveTimezone(): string {
  return activeTimezone ?? dayjs.tz.guess()
}

export const fleetToPickerDate = (value: dayjs.Dayjs | null | undefined): Date | null => {
  if (!value) {
    return null
  }

  return new Date(
    value.year(),
    value.month(),
    value.date(),
    value.hour(),
    value.minute(),
    value.second(),
    value.millisecond()
  )
}

export const pickerToFleetDate = (value: Date | null | undefined): dayjs.Dayjs | null => {
  if (!value) {
    return null
  }

  if (value instanceof dayjs) { 
    value = (value as unknown as dayjs.Dayjs).toDate()
  }
  

  const dateString =
    `${value.getFullYear()}-` +
    `${String(value.getMonth() + 1).padStart(2, '0')}-` +
    `${String(value.getDate()).padStart(2, '0')} ` +
    `${String(value.getHours()).padStart(2, '0')}:` +
    `${String(value.getMinutes()).padStart(2, '0')}:` +
    `${String(value.getSeconds()).padStart(2, '0')}`

  return dayjs.tz(
    dateString,
    'YYYY-MM-DD HH:mm:ss',
    resolveTimezone()
  )
}