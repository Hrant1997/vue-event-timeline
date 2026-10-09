import { ref, computed, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { TimelineEvent, TimelineOptions, TimelineResource } from '../types'
import { fleetDate, setLibraryTimezone } from '../utils/date'

// 🚀 Обязательно расширяем dayjs плагинами
dayjs.extend(utc)
dayjs.extend(timezone)


export function useTimeline(
  events: Ref<TimelineEvent[]>,
  resources: Ref<TimelineResource[]>,
  options: Ref<TimelineOptions>
) {

  // 🚀 Инициализация с учетом часового пояса
  const viewStart = ref(fleetDate().startOf('day'))
  const pxPerMin = ref(options.value.initialPxPerMin ?? 2)
  const containerWidth = ref(1000)

  const minPx = options.value.zoomRange?.min ?? 0.02
  const maxPx = options.value.zoomRange?.max ?? 10

  const minCellMin = computed(() => options.value.minCellMinutes ?? 15)
  const eventGapMin = computed(() => options.value.eventGapMinutes ?? 0)
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

    if (s.isAfter(e)) {
      s = e
    }

    return { start: s, end: e }
  }

  const clampDuration = (start: dayjs.Dayjs, end: dayjs.Dayjs): { start: dayjs.Dayjs; end: dayjs.Dayjs } => {
    let s = snap(start)
    let e = snap(end)

    const minDur = options.value.minDurationMinutes ?? minCellMin.value
    const maxDur = options.value.maxDurationMinutes ?? Infinity
    
    let dur = diffMin(e, s)

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

  const eventsToShow = (resourceId: string | number) => {
    return eventsByResource(resourceId)
    // .filter((event) => {
    //   console.log(event);
      
    //   const left = getX(event.start)
    //   const width = Math.max(30, getX(event.end) - getX(event.start))
    //   if ((left + width) * 2 < 0 || left > window.innerWidth * 2) {
    //     return false
    //   }
    //   return true
    // })
  }

  // T-12: источник пояса — options.timezone; при смене пересобираем привязанные даты
  watch(
    () => options.value.timezone ?? null,
    (tz) => {
      setLibraryTimezone(tz)
      viewStart.value = fleetDate(viewStart.value.valueOf()).startOf('day')
    },
    { immediate: true }
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
    minCellMin
  }
}