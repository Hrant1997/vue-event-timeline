import { ref, computed, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { TimelineEvent, TimelineOptions, TimelineResource } from '../types'
import { toTimelineDate, setLibraryTimezone, normalizeEventChanges } from '../utils/date'
import { computeLaneLayout, type LaneInfo } from '../utils/laneLayout'

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
  const viewStart = ref(toTimelineDate().startOf('day'))
  const pxPerMin = ref(options.value.initialPxPerMin ?? 2)
  const containerWidth = ref(1000)

  // --- T-36: группировка событий и per-group allowOverlap -------------------
  // Группа события = event.group ?? event[options.eventGroups.field] ?? event.type.
  // effectiveAllowOverlapFor(ev):
  //  - глобальный allowOverlap === false имеет приоритет над ВСЕМ (см. ТЗ):
  //    группа не может разрешить наложения поверх глобального запрета;
  //  - иначе локальный override события (event.allowOverlap),
  //  - иначе настройки группы options.eventGroups.groups[name].allowOverlap,
  //  - иначе глобальный allowOverlap.
  const DEFAULT_GROUP_FIELDS = ['group', 'type'] as const

  /** Имя группы события; undefined — событие без группы */
  const getEventGroup = (e: TimelineEvent): string | undefined => {
    if (typeof e.group === 'string' && e.group) return e.group
    // Явно заданное поле конфига — единственный источник (ищет и в data)
    const cfgField = options.value.eventGroups?.field
    if (cfgField) {
      const v = findGroupValue(e, cfgField)
      return typeof v === 'string' && v ? v : undefined
    }
    // Fallback-поля ('group', 'type') ищем и на событии, и в event.data
    for (const f of DEFAULT_GROUP_FIELDS) {
      const v = findGroupValue(e, f)
      if (typeof v === 'string' && v) return v
    }
    return undefined
  }

  /** Значение поля группы: сначала на событии, затем в event.data (кастомные поля потребителя) */
  const findGroupValue = (e: TimelineEvent, field: string): unknown => {
    const direct = (e as unknown as Record<string, unknown>)[field]
    if (typeof direct === 'string' && direct) return direct
    const data = e.data as Record<string, unknown> | undefined
    if (data && typeof data[field] === 'string' && data[field]) return data[field]
    return undefined
  }

  /**
   * Эффективный allowOverlap для события. При отсутствии события (например,
   * проверка выделения «с нуля») — только глобальное значение.
   */
  const effectiveAllowOverlapFor = (e?: TimelineEvent): boolean => {
    // Тип options.allowOverlap сужается до `true | undefined` (prop default — false),
    // поэтому сравниваем через приведение к boolean: falsy (false/undefined) ⇒ запрет.
    const globalAllow = Boolean(options.value.allowOverlap as boolean | undefined)
    // Глобальный запрет перебивает любые групповые разрешения
    if (!globalAllow) return false
    if (!e) return true
    if (typeof e.allowOverlap === 'boolean') return e.allowOverlap
    const name = getEventGroup(e)
    const groupCfg = name ? options.value.eventGroups?.groups?.[name]?.allowOverlap : undefined
    if (typeof groupCfg === 'boolean') return groupCfg
    return globalAllow
  }

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
    return toTimelineDate(Math.round(d.valueOf() / stepMs) * stepMs)
  }

  const addMin = (d: dayjs.Dayjs, m: number): dayjs.Dayjs => d.add(m, 'minute')
  const diffMin = (a: dayjs.Dayjs, b: dayjs.Dayjs): number => (a.valueOf() - b.valueOf()) / 60000

  const hasOverlap = (
    resourceId: string | number,
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    excludeId?: string | number
  ): boolean => {
    // T-36: hasOverlap(resourceId, ...) вызывается БЕЗ конкретного кандидата
    // (например, при создании события выделением), поэтому группа неизвестна.
    // Логика:
    //  - глобальный allowOverlap === false или undefined → строгая проверка
    //    пересечений (группы НЕ могут ослабить глобальный запрет);
    //  - глобальный allowOverlap === true → ищем «строгих» соседей (группы с
    //    allowOverlap:false / event.allowOverlap:false). Пересечение с ними —
    //    конфликт; с остальными (разрешившими) — нет.
    const strictMode = options.value.allowOverlap !== true
    const gapMs = eventGapMin.value * 60 * 1000

    return events.value.some(e => {
      if (e.id === excludeId || e.resourceId !== resourceId) return false
      const overlaps =
        e.start.valueOf() < end.valueOf() + gapMs &&
        e.end.valueOf() > start.valueOf() - gapMs
      if (!overlaps) return false
      return strictMode || !effectiveAllowOverlapFor(e)
    })
  }

  /**
   * T-36: проверка наложения КОНКРЕТНОГО кандидата (с его группой/override)
   * относительно остальных событий ресурса. Пара считается допустимой только
   * если allowOverlap разрешён обоими участниками.
   * Возвращает true, если позиция ДОПУСТИМА (конфликтующих соседей нет).
   */
  const canOverlapWith = (
    candidate: TimelineEvent,
    resourceId: string | number,
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    excludeId?: string | number
  ): boolean => {
    // Глобальный запрет имеет приоритет над групповыми разрешениями (см. ТЗ):
    // при allowOverlap === false проверяем строго, игнорируя группы.
    if (options.value.allowOverlap === false) {
      return !hasRawOverlap(resourceId, start, end, excludeId)
    }
    const candEffective = effectiveAllowOverlapFor(candidate)

    const gapMs = eventGapMin.value * 60 * 1000

    for (const e of events.value) {
      if (e.id === excludeId || e.resourceId !== resourceId) continue
      const overlaps =
        e.start.valueOf() < end.valueOf() + gapMs &&
        e.end.valueOf() > start.valueOf() - gapMs
      if (!overlaps) continue
      // Пересечение запрещено, если хоть одна из сторон пары не допускает наложений
      if (!candEffective || !effectiveAllowOverlapFor(e)) return false
    }
    return true
  }

  /** Сырая детекция пересечений без учёта настроек (для строгого режима) */
  const hasRawOverlap = (
    resourceId: string | number,
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    excludeId?: string | number
  ): boolean => {
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
    
    viewStart.value = toTimelineDate(newViewStartInMin * 60000)
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

  // FIX: id события, которое сейчас перетаскивается/ресайзится.
  // Такое событие ВСЕГДА включается в visibleEventsByResource, даже если
  // его позиция вышла за пределы viewport ([viewStart, viewEnd]). Иначе при
  // drag с автоскроллом (или быстром перетаскивании за край окна) событие
  // исчезало из DOM — компонент размонтировался, жест обрывался и ивент
  // «пропадал». null / undefined — ничего не активно, фильтрация как раньше.
  const activeDragEventId = ref<string | number | null>(null)

  // T-08: группировка по ресурсу + окно видимости [viewStart, viewEnd] — O(events) на пересчёт,
  // а не O(resources × events) на каждый рендер строки шаблона.
  const visibleEventsByResource = computed(() => {
    const map = new Map<string | number, TimelineEvent[]>()
    const vs = viewStart.value.valueOf()
    const ve = viewEnd.value.valueOf()
    const activeId = activeDragEventId.value
    for (const e of events.value) {
      // событие пересекает видимый диапазон?
      // Активный (перетаскиваемый) ивент не фильтруем по viewport —
      // он должен оставаться в DOM до конца жеста.
      if (
        (activeId !== null && e.id === activeId) ||
        (e.end.valueOf() >= vs && e.start.valueOf() <= ve)
      ) {
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

  // T-29: lane-раскладка перекрывающихся событий (allowOverlap / per-group, T-36).
  // Считаем один computed-Map на все видимые события (windowed, O(n log n)),
  // а не на каждый рендер строки — события вне окна видимости не удорожают расчёт.
  // T-36: события одной группы раскладываются в СВОЕЙ сетке дорожек внутри строки:
  // rental — относительно rental, service — относительно service; безгрупповые
  // события образуют общий бакет. Строка растягивается под максимум из бакетов.
  // При глобальном allowOverlap=false и для групп с запретом пересечений быть
  // не может (запрещено canMoveEventTo) — такие события остаются в lane 0.
  const laneLayoutByResource = computed(() => {
    const map = new Map<string | number, Map<string | number, LaneInfo>>()
    for (const [resourceId, evs] of visibleEventsByResource.value) {
      if (evs.length < 2) continue
      // key бакета: '' — безгрупповые (наследуют глобальный режим), иначе имя группы
      const buckets = new Map<string, TimelineEvent[]>()
      for (const ev of evs) {
        const name = getEventGroup(ev) ?? ''
        const arr = buckets.get(name)
        if (arr) arr.push(ev)
        else buckets.set(name, [ev])
      }
      const res = new Map<string | number, LaneInfo>()
      for (const [, bucket] of buckets) {
        if (bucket.length < 2) continue
        for (const [id, info] of computeLaneLayout(bucket)) res.set(id, info)
      }
      if (res.size > 0) map.set(resourceId, res)
    }
    return map
  })

  /** Lane-геометрия события; undefined — раскладка по умолчанию (центр строки) */
  const getLaneFor = (resourceId: string | number, eventId: string | number): LaneInfo | undefined =>
    laneLayoutByResource.value.get(resourceId)?.get(eventId)

  // T-12: источник пояса — options.timezone; при СМЕНЕ пояса пересобираем привязанные даты.
  // Fix гонки (найдено тестом T-08): вариант immediate больше не перезаписывает viewStart —
  // сет уже выставлен при инициализации через toTimelineDate() после setLibraryTimezone в Timeline.vue,
  // а немедленный перезапуск сбрасывал явный viewStart в "сегодня".
  watch(
    () => options.value.timezone ?? null,
    (tz, prevTz) => {
      if (prevTz === null && tz === null) return // первый запуск без смены пояса — не трогаем viewStart
      setLibraryTimezone(tz)
      viewStart.value = toTimelineDate(viewStart.value.valueOf()).startOf('day')
    }
  )

  // Смещение активного пояса в минутах (для расчёта сетки); реагирует на options.timezone
  const timezoneOffsetMinutes = computed(() => {
    void options.value.timezone
    return toTimelineDate().utcOffset()
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
    canOverlapWith, // T-36: per-group проверка допустимости позиции кандидата
    effectiveAllowOverlapFor, // T-36: эффективный allowOverlap события/группы
    getEventGroup, // T-36: имя группы события
    clampToBounds,
    clampDuration,
    zoom,
    getX,
    getDateFromX,
    eventsByResource,
    eventsToShow,
    visibleEventsByResource,
    activeDragEventId, // FIX: id активного drag/resize-события — не фильтруется по viewport
    getLaneFor, // T-29: lane-раскладка перекрывающихся событий
    minCellMin,
    normalizeEventChanges // T-26: нормализация changes перед clamp/overlap
  }
}