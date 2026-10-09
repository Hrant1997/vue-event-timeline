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

/**
 * Единая точка входа для дат в библиотеке (T-27).
 * Всегда возвращает dayjs-объект в активном часовом поясе:
 * - без options.timezone — локальный пояс системы;
 * - с options.timezone — указанный IANA-пояс (день/час линейки и событий совпадают).
 */
export function fleetDate(
  value?: string | number | Date | dayjs.Dayjs | null
): dayjs.Dayjs {
  const d = value == null ? dayjs() : dayjs(value)
  return activeTimezone ? d.tz(activeTimezone) : d
}

/**
 * fleetDate (dayjs в поясе библиотеки) → Date для нативных UI-виджетов
 * (input[type=datetime-local], Vuetify/Element pickers и т.п.).
 * Wall-clock поля Date соответствуют времени отображения timeline,
 * поэтому picker покажет ровно те же дату/время, что и линейка.
 */
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

/**
 * Date из picker'а → fleetDate (dayjs в поясе библиотеки).
 * Обратная операция к fleetToPickerDate: wall-clock поля входящего Date
 * трактуются как время в активном поясе таймлайна.
 * Принимает также dayjs-значение (защита от случайной передачи не Date).
 */
export const pickerToFleetDate = (value: Date | dayjs.Dayjs | null | undefined): dayjs.Dayjs | null => {
  if (!value) {
    return null
  }

  if (dayjs.isDayjs(value)) {
    // уже dayjs: нормализуем в активный пояс библиотеки
    return activeTimezone ? value.tz(activeTimezone) : value
  }

  const y = value.getFullYear()
  const mo = value.getMonth()
  const da = value.getDate()
  const h = value.getHours()
  const mi = value.getMinutes()
  const s = value.getSeconds()
  const ms = value.getMilliseconds()

  if (!activeTimezone) {
    return dayjs(new Date(y, mo, da, h, mi, s, ms))
  }

  // интерпретируем wall-clock picker'а в активном поясе библиотеки:
  // парсим строку как UTC, затем tz(..., true) сохраняет wall-clock поля
  const iso =
    `${y}-${String(mo + 1).padStart(2, '0')}-` +
    `${String(da).padStart(2, '0')}T` +
    `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}Z`

  return dayjs.utc(iso).tz(activeTimezone, true)
}
