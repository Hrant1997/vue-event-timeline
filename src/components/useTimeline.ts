import { ref, computed, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { TimelineEvent, TimelineOptions, TimelineResource } from '../types'
import { fleetDate, setLibraryTimezone, normalizeEventChanges } from '../utils/date'

// 🚀 Обязательно расширяем dayjs плагинами
dayjs.extend(utc)
dayjs.extend(timezone)


export function useTimeline(
  events: Ref<TimelineEvent[]>,
  resources: Ref<TimelineResource[]>,
  options: Ref<TimelineOptions>
) {

  // 🚀 Инициализация с учетом часового пояса (T-12: options.timezone — единственный источник).
  // setLibraryTimezone ДО создания viewStart — иначе сет привязан к старому поясу (гонка, найдено тестом).
  setLibraryTimezone(options.value.timezone ?? null)
  const viewStart = ref(fleetDate().startOf('day'))
  const pxPerMin = ref(options.value.initialPxPerMin ?? 2)
  const containerWidth = ref(1000)

  const minPx = options.value.zoomRange?.min ?? 0.02
  const maxPx = options.value.zoomRange?.max ?? 10

  const minCellMin = computed(() => options.value.minCellMinutes ?? 15)
  const eventGapMin = computed(() => options.value.eventGapMinutes ?? 0)
  // ВАЖНО: computed объявлен ПОСЛЕ addMin — computed ленив, но при TDZ-ошибке
  // порядок важен; оставили на месте, addMin инициализируется до первого доступа.
  const viewEnd = computed(() => {
    const minutes = containerWidth.value / pxPerMin.value

    return addMin(viewStart.value, minutes)
  })

  // Утилиты (работают с абсолютным временем, что корректно для математики координат)
  // T-13: корректный snap для любого шага (в т.ч. > 60 минут) — округление от epoch-ms
  const snap = (d: dayjs.Dayjs): dayjs.Dayjs => {
    const stepMs = minCellMin.value * 60_000
    return fleetDate(Math.round(d.valueOf() / stepMs) * stepMs)
  }

  const addMin = (d: dayjs.Dayjs, m: number): dayjs.Dayjs => d.add(m, 'minute')
  const diffMin = (a: dayjs.Dayjs, b: dayjs.Dayjs): number => (a.valueOf() - b.valueOf()) / 60000

  const hasOverlap = (
    resourceId: string | number,
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    excludeId?: string | number
  ): boolean => {
    if (options.value.allowOverlap) return false
    
    const gapMs = eventGapMin.value * 60 * 1000

    return events.value.some(e => {
      if (e.id === excludeId || e.resourceId !== resourceId) return false
      return e.start.valueOf() < end.valueOf() + gapMs && 
             e.end.valueOf() > start.valueOf() - gapMs
    })
  }

  const clampToBounds = (start: dayjs.Dayjs, end: dayjs.Dayjs): { start: dayjs.Dayjs; end: dayjs.Dayjs } => {
    let s = start
    let e = end
    
    const min = options.value.minDate ? options.value.minDate : null
    const max = options.value.maxDate ? options.value.maxDate : null

    if (min) {
      if (s.isBefore(min)) s = min
      if (e.isBefore(min)) e = min
    }
    if (max) {
      if (e.isAfter(max)) e = max
      if (s.isAfter(max)) s = max
    }

    // Инвариант: на выходе ВСЕГДА start <= end (перевёрнутый вход схлопываем к более ранней границе).
    if (s.isAfter(e)) {
      const tmp = s
      s = e
      e = tmp
    }

    return { start: s, end: e }
  }

  const clampDuration = (start: dayjs.Dayjs, end: dayjs.Dayjs): { start: dayjs.Dayjs; end: dayjs.Dayjs } => {
    const s = snap(start)
    let e = snap(end)

    const minDur = options.value.minDurationMinutes ?? minCellMin.value
    const maxDur = options.value.maxDurationMinutes ?? Infinity
    
    const dur = diffMin(e, s)

    if (dur < minDur) {
      e = addMin(s, minDur)
    } else if (dur > maxDur) {
      e = addMin(s, maxDur)
    }

    return clampToBounds(s, e)
  }

const zoom = (delta: number, anchorX?: number) => {
  const factor = delta > 0 ? 0.9 : 1.1
  
  // 1. Сначала вычисляем и округляем значение (до 3 знаков)
  const rawPx = pxPerMin.value * factor
  const roundedPx = Math.round(rawPx * 1000) / 1000
  
  // 2. Применяем ограничения (clamp) к уже округленному значению
  const newPx = Math.max(minPx, Math.min(maxPx, roundedPx))
  
  // Оптимизация: если зум не изменился (уперся в лимит), выходим
  if (newPx === pxPerMin.value && anchorX === undefined) return

  if (anchorX !== undefined) {
    // Надежнее использовать нативный getTime(), чтобы избежать ошибок в логике diffMin
    // Абсолютное время точки якоря в минутах от эпохи Unix
    const anchorTimeInMin = (viewStart.value.valueOf() / 60000) + (anchorX / pxPerMin.value)
    
    // Новое время начала = время якоря - (смещение якоря в новых пикселях)
    const newViewStartInMin = anchorTimeInMin - (anchorX / newPx)
    
    pxPerMin.value = newPx
    
    viewStart.value = fleetDate(newViewStartInMin * 60000)
  } else {
    // Если якоря нет, просто обновляем зум (центр сместится, это стандартное поведение без anchorX)
    pxPerMin.value = newPx
  }
}

  const getX = (d: dayjs.Dayjs) => diffMin(d, viewStart.value) * pxPerMin.value
  const getDateFromX = (x: number) => addMin(viewStart.value, x / pxPerMin.value)

  const zoomLevel = computed(() => {
    const px = pxPerMin.value * 60
    if (px < 2) return 'month'
    if (px < 30) return 'day'
    if (px < 100) return 'hour'
    return 'minute'
  })

  const eventsByResource = (resourceId: string | number) =>
    events.value.filter(e => e.resourceId === resourceId)

  // T-08: группировка по ресурсу + окно видимости [viewStart, viewEnd] — O(events) на пересчёт,
  // а не O(resources × events) на каждый рендер строки шаблона.
  const visibleEventsByResource = computed(() => {
    const map = new Map<string | number, TimelineEvent[]>()
    const vs = viewStart.value.valueOf()
    const ve = viewEnd.value.valueOf()
    for (const e of events.value) {
      // событие пересекает видимый диапазон?
      if (e.end.valueOf() >= vs && e.start.valueOf() <= ve) {
        const arr = map.get(e.resourceId)
        if (arr) arr.push(e)
        else map.set(e.resourceId, [e])
      }
    }
    return map
  })

  const eventsToShow = (resourceId: string | number): TimelineEvent[] => {
    return visibleEventsByResource.value.get(resourceId) ?? []
  }

  // T-12: источник пояса — options.timezone; при СМЕНЕ пояса пересобираем привязанные даты.
  // Fix гонки (найдено тестом T-08): вариант immediate больше не перезаписывает viewStart —
  // сет уже выставлен при инициализации через fleetDate() после setLibraryTimezone в Timeline.vue,
  // а немедленный перезапуск сбрасывал явный viewStart в "сегодня".
  watch(
    () => options.value.timezone ?? null,
    (tz, prevTz) => {
      if (prevTz === null && tz === null) return // первый запуск без смены пояса — не трогаем viewStart
      setLibraryTimezone(tz)
      viewStart.value = fleetDate(viewStart.value.valueOf()).startOf('day')
    }
  )

  // Смещение активного пояса в минутах (для расчёта сетки); реагирует на options.timezone
  const timezoneOffsetMinutes = computed(() => {
    void options.value.timezone
    return fleetDate().utcOffset()
  })

  return {
    viewStart,
    viewEnd,
    pxPerMin,
    containerWidth,
    zoomLevel,
    timezoneOffsetMinutes, // <-- Используйте это в расчете gridStyle вместо хардкода
    snap,
    addMin,
    diffMin,
    hasOverlap,
    clampToBounds,
    clampDuration,
    zoom,
    getX,
    getDateFromX,
    eventsByResource,
    eventsToShow,
    visibleEventsByResource,
    minCellMin,
    normalizeEventChanges // T-26: нормализация changes перед clamp/overlap
  }
}