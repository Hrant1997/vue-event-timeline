// utils/date.ts — часовой пояс библиотеки (T-12)
// Библиотека НЕ читает localStorage: единственный источник пояса —
// options.timezone, переданный потребителем. Fallback — локальный пояс системы.

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(advancedFormat) // нужен для токена 'Qo' и т.п. в кастомных форматах

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
export function toTimelineDate(
  value?: string | number | Date | dayjs.Dayjs | null
): dayjs.Dayjs {
  if (value == null) {
    // «сейчас»: абсолютный момент, отображаемый в поясе библиотеки
    return activeTimezone ? dayjs().tz(activeTimezone) : dayjs()
  }
  if (typeof value === 'string' && activeTimezone) {
    // Строка без явного смещения («wall-clock») парсится В поясе библиотеки —
    // иначе метки/события разъезжаются на разницу поясов (баг, найдён тестом).
    // ISO со смещением/Z парсятся как абсолютный момент (стандартное поведение tz()).
    return dayjs.tz(value, activeTimezone)
  }
  if (dayjs.isDayjs(value)) {
    // Уже dayjs: НЕ трогаем абсолютный момент (valueOf), только меняем представление.
    // Важно: для dayjs.utc(...) объект уже в UTC-поясе, и .tz(name) сохраняет
    // wall-clock UTC-поля вместо нормализации момента в целевой пояс (ловушка
    // utc-плагина). Поэтому пересобираем от epoch-ms через обычный dayjs.
    const d = dayjs(value.valueOf())
    return activeTimezone ? d.tz(activeTimezone) : d
  }
  const d = dayjs(value)
  return activeTimezone ? d.tz(activeTimezone) : d
}

/**
 * Независимый формат даты для тултипа: «20 окт. 19:45» / «20 Oct 19:45».
 * Не зависит от внешних директив (v-format-date) — вся логика внутри библиотеки.
 * Локализация — через dayjs-локали: нужная локаль подгружается лениво,
 * строка реактивно перерендеривается после её загрузки. Fallback — 'en'.
 */
export const TOOLTIP_DATE_FORMAT = 'D MMM HH:mm'

const loadedLocales = new Set<string>(['en'])
// Счётчик обновлений: растёт, когда асинхронно подгрузилась новая локаль,
// чтобы computed-строка тултипа перерендерилась с переводом.
const localesVersion = ref(0)

async function ensureDayjsLocale(locale: string): Promise<void> {
  const base = normalizeDayjsLocale(locale) // 'ru-RU' → 'ru', 'pt-BR' → 'pt'
  if (loadedLocales.has(base)) return
  try {
    await import(/* @vite-ignore */ `dayjs/locale/${base}`)
    loadedLocales.add(base)
    localesVersion.value++ // реактивный re-render с новой локалью
  } catch {
    if (base !== 'en') {
      console.warn(`[vue-event-timeline] dayjs locale "${base}" not found, fallback to "en"`)
    }
  }
}

/** 'ru'/'ru-RU' → 'ru'; неизвестные/пустые → 'en'. */
export function normalizeDayjsLocale(locale?: string | null): string {
  const base = (locale ?? '').split('-')[0].toLowerCase()
  return base || 'en'
}

/**
 * Composable-хелпер: реактивная отформатированная строка для tooltip.
 * value — dayjs.Date (или любой ConfigType), locale — строка локали ('ru', 'en', ...).
 */
export function useFormattedTooltipDate(
  value: Ref<dayjs.ConfigType>,
  locale: Ref<string | undefined>
): ComputedRef<string> {
  const resolvedLocale = computed(() => normalizeDayjsLocale(locale.value))

  watch(
    resolvedLocale,
    async (l) => {
      await ensureDayjsLocale(l)
    },
    { immediate: true }
  )

  return computed(() => {
    const v = value.value
    if (!v) return ''
    // .locale(name) безопасен: если локаль ещё не подгружена, dayjs использует 'en'
    const d = toTimelineDate(v as dayjs.ConfigType).locale(resolvedLocale.value)
    return d.format(TOOLTIP_DATE_FORMAT)
  })
}

/**
 * toTimelineDate (dayjs в поясе библиотеки) → Date для нативных UI-виджетов
 * (input[type=datetime-local], Vuetify/Element pickers и т.п.).
 * Wall-clock поля Date соответствуют времени отображения timeline,
 * поэтому picker покажет ровно те же дату/время, что и линейка.
 *
 * Трюк: dayjs.format() возвращает wall-clock строку ПОЯСА БИБЛИОТЕКИ,
 * а new Date(y, m, ...) трактует числа как wall-clock системного пояса.
 * В результате getHours()/getMinutes() и т.д. дают именно то время,
 * которое видно на таймлайне — независимо от пояса системы и браузера.
 */
export const timelineToPickerDate = (value: dayjs.Dayjs | null | undefined): Date | null => {
  if (!value) {
    return null
  }

  // Wall-clock поля возвращаемого Date = ровно то время, что видно на линейке.
  // Парсим wall-clock строку пояса библиотеки как ЛОКАЛЬНОЕ время — тогда
  // getFullYear()/getHours() и т.д. вернут отображаемое время в любом поясе системы.
  const wall = value.format('YYYY-MM-DDTHH:mm:ss.SSS')

  if (!activeTimezone) {
    // библиотека = системный пояс: парсим как локальное время напрямую
    return new Date(
      value.year(),
      value.month(),
      value.date(),
      value.hour(),
      value.minute(),
      value.second(),
      value.millisecond(),
    )
  }

  // dayjs(wall) без смещения трактует строку как локальное время системного
  // пояса раннера/браузера — именно этого мы и добиваемся (wall-clock 1-в-1).
  return dayjs(wall).toDate()
}

/**
 * Date из picker'а → toTimelineDate (dayjs в поясе библиотеки).
 * Обратная операция к timelineToPickerDate: wall-clock поля входящего Date
 * трактуются как время в активном поясе таймлайна.
 * Принимает также dayjs-значение (защита от случайной передачи не Date).
 */
export const pickerToTimelineDate = (value: Date | dayjs.Dayjs | null | undefined): dayjs.Dayjs | null => {
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
