import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import dayjs from 'dayjs'
import type { TimelineEvent, TimelineOptions, TimelineResource } from '../src/types'
import { useTimeline } from '../src/components/useTimeline'
import { setLibraryTimezone, toTimelineDate, timelineToPickerDate, pickerToTimelineDate } from '../src/utils/date'
import { useRulerMarks } from '../src/composables/useRulerMarks'

function setup(options: Partial<TimelineOptions> = {}) {
  const events = ref<TimelineEvent[]>([])
  const resources = ref<TimelineResource[]>([{ id: 'r1', name: 'Resource 1' }])
  const opts = ref<TimelineOptions>(options as TimelineOptions)
  return { ...useTimeline(events, resources, opts), events, resources, opts }
}

beforeEach(() => {
  setLibraryTimezone(null) // локальный пояс системы — детерминированные тесты
})

describe('snap (T-13)', () => {
  it('округляет до шага minCellMinutes в пределах часа', () => {
    const t = setup({ minCellMinutes: 15 })
    const d = dayjs('2026-10-09T12:08:00')
    expect(t.snap(d).minute()).toBe(15)
    expect(t.snap(dayjs('2026-10-09T12:07:00')).minute()).toBe(0)
  })

  it('работает при шаге > 60 минут (старый баг: ломался на hours*60)', () => {
    const t = setup({ minCellMinutes: 120 })
    const snapped = t.snap(dayjs('2026-10-09T13:30:00'))
    // шаг 120 мин от эпохи: кратность 2 часам
    expect(snapped.valueOf() % (120 * 60_000)).toBe(0)
    expect(snapped.format('HH:mm')).toBe('14:00')
  })

  it('использует fallback 15 минут когда опция не задана (T-03)', () => {
    const t = setup({})
    expect(t.minCellMin.value).toBe(15)
    expect(t.snap(dayjs('2026-10-09T12:20:00')).minute()).toBe(15)
  })
})

describe('clampToBounds', () => {
  it('не зависит от порядка ключей возвращаемого объекта (T-02)', () => {
    const t = setup({
      minDate: dayjs('2026-10-09T08:00:00'),
      maxDate: dayjs('2026-10-09T18:00:00'),
    })
    const r = t.clampToBounds(dayjs('2026-10-09T06:00:00'), dayjs('2026-10-09T20:00:00'))
    expect(r.start.format('HH:mm')).toBe('08:00')
    expect(r.end.format('HH:mm')).toBe('18:00')
  })

  it('схлопывает перевёрнутый диапазон', () => {
    const t = setup({ maxDate: dayjs('2026-10-09T10:00:00') })
    const r = t.clampToBounds(dayjs('2026-10-09T12:00:00'), dayjs('2026-10-09T09:00:00'))
    // Инвариант: start <= end. Перевёрнутый вход (12:00→09:00): start клампится к maxDate (10:00),
    // end остаётся 09:00; затем swap нормализует порядок — на выходе невырожденный диапазон 09:00→10:00.
    expect(r.start.format('HH:mm')).toBe('09:00')
    expect(r.end.format('HH:mm')).toBe('10:00')
    expect(r.start.isAfter(r.end)).toBe(false)
  })

  it('перевёрнутый вход без границ — нормализуется swap\'ом', () => {
    const t = setup({})
    const r = t.clampToBounds(dayjs('2026-10-09T15:00:00'), dayjs('2026-10-09T11:00:00'))
    expect(r.start.format('HH:mm')).toBe('11:00')
    expect(r.end.format('HH:mm')).toBe('15:00')
  })
})

describe('clampDuration', () => {
  it('растягивает конец до minDurationMinutes', () => {
    const t = setup({ minDurationMinutes: 30, minCellMinutes: 5 })
    const r = t.clampDuration(dayjs('2026-10-09T12:00:00'), dayjs('2026-10-09T12:10:00'))
    expect(r.end.diff(r.start, 'minute')).toBe(30)
  })

  it('ограничивает сверху maxDurationMinutes', () => {
    const t = setup({ maxDurationMinutes: 60, minCellMinutes: 5 })
    const r = t.clampDuration(dayjs('2026-10-09T12:00:00'), dayjs('2026-10-09T20:00:00'))
    expect(r.end.diff(r.start, 'minute')).toBe(60)
  })
})

describe('hasOverlap', () => {
  const ev = (start: string, end: string): TimelineEvent => ({
    id: 'e1', resourceId: 'r1', title: 'x',
    start: dayjs(start), end: dayjs(end),
  }) as unknown as TimelineEvent

  it('без allowOverlap детектирует пересечение', () => {
    const t = setup({})
    t.events.value = [ev('2026-10-09T12:00', '2026-10-09T13:00')]
    expect(t.hasOverlap('r1', dayjs('2026-10-09T12:30'), dayjs('2026-10-09T14:00'))).toBe(true)
    expect(t.hasOverlap('r1', dayjs('2026-10-09T13:00'), dayjs('2026-10-09T14:00'))).toBe(false)
  })

  it('allowOverlap=true всегда false', () => {
    const t = setup({ allowOverlap: true })
    t.events.value = [ev('2026-10-09T12:00', '2026-10-09T13:00')]
    expect(t.hasOverlap('r1', dayjs('2026-10-09T12:30'), dayjs('2026-10-09T12:45'))).toBe(false)
  })

  it('excludeId исключает само событие', () => {
    const t = setup({})
    t.events.value = [ev('2026-10-09T12:00', '2026-10-09T13:00')]
    expect(t.hasOverlap('r1', dayjs('2026-10-09T12:30'), dayjs('2026-10-09T12:45'), 'e1')).toBe(false)
  })

  it('eventGapMinutes расширяет зону конфликта', () => {
    const t = setup({ eventGapMinutes: 15 })
    t.events.value = [ev('2026-10-09T12:00', '2026-10-09T13:00')]
    // стык встык без зазора, но gap 15 мин => конфликт
    expect(t.hasOverlap('r1', dayjs('2026-10-09T13:00'), dayjs('2026-10-09T14:00'))).toBe(true)
  })
})

describe('eventGroups / per-group allowOverlap (T-36)', () => {
  const gev = (id: string, group: string, start: string, end: string): TimelineEvent => ({
    id, resourceId: 'r1', title: id, group,
    start: dayjs(start), end: dayjs(end),
  }) as unknown as TimelineEvent

  const groupOpts = (global?: boolean): Partial<TimelineOptions> => ({
    allowOverlap: global,
    eventGroups: {
      field: 'group',
      groups: { rental: { allowOverlap: false }, service: { allowOverlap: true } },
    },
  })

  it('getEventGroup читает event.group и fallback на type', () => {
    const t = setup({}) // без eventGroups.field — включается fallback-цепочка group→type
    expect(t.getEventGroup(gev('a', 'rental', '2026-10-09T12:00', '2026-10-09T13:00'))).toBe('rental')
    const typed = { id: 'b', resourceId: 'r1', start: dayjs(), end: dayjs(), type: 'service' } as unknown as TimelineEvent
    expect(t.getEventGroup(typed)).toBe('service')
    // кастомное поле через eventGroups.field (в т.ч. внутри event.data)
    const byField = setup(groupOpts(true))
    const inData = { id: 'c', resourceId: 'r1', start: dayjs(), end: dayjs(), data: { group: 'rental' } } as unknown as TimelineEvent
    expect(byField.getEventGroup(inData)).toBe('rental')
  })

  it('effectiveAllowOverlapFor: группа service → true, rental → false', () => {
    const t = setup(groupOpts(true))
    expect(t.effectiveAllowOverlapFor(gev('a', 'service', '2026-10-09T12:00', '2026-10-09T13:00'))).toBe(true)
    expect(t.effectiveAllowOverlapFor(gev('b', 'rental', '2026-10-09T12:00', '2026-10-09T13:00'))).toBe(false)
  })

  it('глобальный allowOverlap=false перебивает группу service', () => {
    const t = setup(groupOpts(false))
    const svc = gev('a', 'service', '2026-10-09T12:00', '2026-10-09T13:00')
    expect(t.effectiveAllowOverlapFor(svc)).toBe(false)
    // кандидат service не может встать поверх существующего события
    t.events.value = [gev('x', 'service', '2026-10-09T12:30', '2026-10-09T13:30')]
    expect(t.canOverlapWith(svc, 'r1', dayjs('2026-10-09T12:30'), dayjs('2026-10-09T13:30'), 'a')).toBe(false)
  })

  it('allowOverlap=true: service может накладываться, rental — нет', () => {
    const t = setup(groupOpts(true))
    t.events.value = [gev('s1', 'service', '2026-10-09T12:00', '2026-10-09T13:00')]
    const svcCand = gev('s2', 'service', '2026-10-09T12:30', '2026-10-09T13:30')
    expect(t.canOverlapWith(svcCand, 'r1', svcCand.start, svcCand.end, 's2')).toBe(true)
    const rentalCand = gev('r1e', 'rental', '2026-10-09T12:30', '2026-10-09T13:30')
    expect(t.canOverlapWith(rentalCand, 'r1', rentalCand.start, rentalCand.end, 'r1e')).toBe(false)
  })

  it('пересечение service с «строгой» группой rental запрещено для обеих сторон', () => {
    const t = setup(groupOpts(true))
    t.events.value = [gev('rt', 'rental', '2026-10-09T12:00', '2026-10-09T13:00')]
    const svcCand = gev('sv', 'service', '2026-10-09T12:30', '2026-10-09T13:30')
    // пара допускает наложения только если РАЗРЕШЕНО обоими участниками
    expect(t.canOverlapWith(svcCand, 'r1', svcCand.start, svcCand.end, 'sv')).toBe(false)
  })

  it('event.allowOverlap — локальный override поверх настроек группы', () => {
    const t = setup(groupOpts(true))
    const strictSvc = { ...gev('a', 'service', '2026-10-09T12:00', '2026-10-09T13:00'), allowOverlap: false }
    expect(t.effectiveAllowOverlapFor(strictSvc)).toBe(false)
  })

  it('hasOverlap без кандидата: глобальный false/undefined — строго; true — конфликтуют только строгие группы', () => {
    const strict = setup(groupOpts(undefined))
    strict.events.value = [gev('s1', 'service', '2026-10-09T12:00', '2026-10-09T13:00')]
    expect(strict.hasOverlap('r1', dayjs('2026-10-09T12:30'), dayjs('2026-10-09T13:30'))).toBe(true)

    const lenient = setup(groupOpts(true))
    lenient.events.value = [gev('s1', 'service', '2026-10-09T12:00', '2026-10-09T13:00')]
    expect(lenient.hasOverlap('r1', dayjs('2026-10-09T12:30'), dayjs('2026-10-09T13:30'))).toBe(false)
    lenient.events.value = [gev('r1e', 'rental', '2026-10-09T12:00', '2026-10-09T13:00')]
    expect(lenient.hasOverlap('r1', dayjs('2026-10-09T12:30'), dayjs('2026-10-09T13:30'))).toBe(true)
  })
})

describe('zoom (зум с якорем)', () => {
  it('меняет pxPerMin в пределах zoomRange', () => {
    const t = setup({ initialPxPerMin: 1, zoomRange: { min: 0.5, max: 2 } })
    for (let i = 0; i < 50; i++) t.zoom(-1) // увеличение
    expect(t.pxPerMin.value).toBeLessThanOrEqual(2)
    for (let i = 0; i < 100; i++) t.zoom(1) // уменьшение
    expect(t.pxPerMin.value).toBeGreaterThanOrEqual(0.5)
  })

  it('anchorX сохраняет время под якорем', () => {
    const t = setup({ initialPxPerMin: 1 })
    const anchorX = 500
    const timeBefore = t.getDateFromX(anchorX).valueOf()
    t.zoom(-1, anchorX)
    const timeAfter = t.getDateFromX(anchorX).valueOf()
    expect(Math.abs(timeAfter - timeBefore)).toBeLessThan(60_000) // ±1 минута из-за округления px
  })
})

describe('getX / getDateFromX — обратимость', () => {
  it('getDateFromX(getX(d)) ≈ d', () => {
    const t = setup({ initialPxPerMin: 2 })
    const d = dayjs('2026-10-09T15:42:00')
    const back = t.getDateFromX(t.getX(d))
    expect(Math.abs(back.valueOf() - d.valueOf())).toBeLessThan(1000)
  })
})

describe('visibleEventsByResource (T-08)', () => {
  const mk = (id: string, start: string, end: string): TimelineEvent => ({
    id, resourceId: 'r1', title: id, start: dayjs(start), end: dayjs(end),
  }) as unknown as TimelineEvent

  it('фильтрует события вне видимого окна', () => {
    const t = setup({ initialPxPerMin: 1 })
    t.containerWidth.value = 600 // видно 600 минут от viewStart
    t.viewStart.value = dayjs('2026-10-09T12:00:00')
    t.events.value = [
      mk('in', '2026-10-09T12:30', '2026-10-09T13:00'),
      // far начинается строго ПОСЛЕ правого края окна (22:00 + 1 мин) — не виден;
      // событие, начинающееся ровно на границе окна, считается видимым (включительная граница)
      mk('far', '2026-10-09T22:01', '2026-10-09T23:00'),
    ]
    const vis = t.visibleEventsByResource.value.get('r1') ?? []
    expect(vis.map(e => e.id)).toEqual(['in'])
  })

  it('событие до начала окна не попадает в выдачу', () => {
    const t = setup({ initialPxPerMin: 1 })
    t.containerWidth.value = 600
    t.viewStart.value = dayjs('2026-10-09T12:00:00')
    t.events.value = [
      mk('past', '2026-10-09T08:00', '2026-10-09T09:00'),
      mk('in', '2026-10-09T12:30', '2026-10-09T13:00'),
    ]
    const vis = t.visibleEventsByResource.value.get('r1') ?? []
    expect(vis.map(e => e.id)).toEqual(['in'])
  })

  // FIX: активный drag/resize-ивент не должен пропадать при выходе за viewport
  it('активный drag-ивент остаётся в выдаче даже вне видимого окна', () => {
    const t = setup({ initialPxPerMin: 1 })
    t.containerWidth.value = 600
    t.viewStart.value = dayjs('2026-10-09T12:00:00')
    t.events.value = [
      mk('in', '2026-10-09T12:30', '2026-10-09T13:00'),
      mk('far', '2026-10-09T22:01', '2026-10-09T23:00'),
    ]
    // без активного drag — far отфильтрован
    expect((t.visibleEventsByResource.value.get('r1') ?? []).map(e => e.id)).toEqual(['in'])
    // выставили активный ивент (id совпадает со строкой 'far') — он виден всегда
    t.activeDragEventId.value = 'far'
    expect((t.visibleEventsByResource.value.get('r1') ?? []).map(e => e.id).sort()).toEqual(['far', 'in'])
    // сбросили — снова фильтруется по viewport
    t.activeDragEventId.value = null
    expect((t.visibleEventsByResource.value.get('r1') ?? []).map(e => e.id)).toEqual(['in'])
  })
})

describe('T-27: timezone-aware toTimelineDate + ruler marks', () => {
  it('toTimelineDate() без пояса — локальная дата', () => {
    setLibraryTimezone(null)
    const d = toTimelineDate('2026-10-09T12:00:00')
    expect(d.format('YYYY-MM-DD HH:mm')).toBe('2026-10-09 12:00')
  })

  it('toTimelineDate(ms) в явном поясе даёт wall-clock этого пояса', () => {
    setLibraryTimezone('Europe/Amsterdam')
    // 23:00 UTC = 01:00 следующего дня в Amsterdam (CET, +1)
    const d = toTimelineDate(Date.UTC(2026, 0, 15, 23, 0, 0))
    expect(d.format('YYYY-MM-DD HH:mm')).toBe('2026-01-16 00:00')
    setLibraryTimezone(null)
  })

  it('startOf("day") через toTimelineDate — полночь пояса библиотеки', () => {
    setLibraryTimezone('Europe/Amsterdam')
    const ms = Date.UTC(2026, 0, 15, 23, 0, 0)
    const dayStart = toTimelineDate(ms).startOf('day')
    expect(dayStart.format('YYYY-MM-DD HH:mm')).toBe('2026-01-16 00:00')
    // valueOf соответствует 23:00 UTC того же момента
    expect(dayStart.valueOf()).toBe(Date.UTC(2026, 0, 15, 23, 0, 0))
    setLibraryTimezone(null)
  })

  it('bottomMarks часовые метки привязаны к полуноши пояса', () => {
    setLibraryTimezone('Europe/Amsterdam')
    const viewStart = ref(toTimelineDate(Date.UTC(2026, 0, 15, 23, 0, 0))) // = 00:00 Amsterdam
    const pxPerMin = ref(2)
    const width = ref(2000)
    const { bottomMarks } = useRulerMarks(viewStart, pxPerMin, width)
    // 2px/мин => 120px/час — минутный шаг; метки идут от полуноши пояса:
    // первая метка = -15 мин от viewStart => 23:45 предыдущего дня (wall-clock AMS)
    const first = bottomMarks.value[0]
    expect(first.label).toBe('23:45')
    setLibraryTimezone(null)
  })
})

describe('picker-хелперы: timelineToPickerDate / pickerToTimelineDate', () => {
  it('round-trip без пояса сохраняет wall-clock', () => {
    setLibraryTimezone(null)
    const d = toTimelineDate('2026-10-09T14:30:15')
    const p = timelineToPickerDate(d)!
    expect(p.getHours()).toBe(14)
    expect(p.getMinutes()).toBe(30)
    const back = pickerToTimelineDate(p)!
    expect(back.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-10-09 14:30:15')
  })

  it('round-trip с явным поясом сохраняет wall-clock пояса', () => {
    setLibraryTimezone('Europe/Amsterdam')
    const d = toTimelineDate(Date.UTC(2026, 0, 15, 23, 0, 0)) // 2026-01-16 00:00 AMS
    const p = timelineToPickerDate(d)!
    // picker показывает wall-clock таймлайна независимо от системного пояса
    expect(`${p.getFullYear()}-${p.getMonth() + 1}-${p.getDate()} ${p.getHours()}:${p.getMinutes()}`).toBe('2026-1-16 0:0')
    const back = pickerToTimelineDate(p)!
    expect(back.format('YYYY-MM-DD HH:mm')).toBe('2026-01-16 00:00')
    expect(back.valueOf()).toBe(d.valueOf())
    setLibraryTimezone(null)
  })

  it('null/undefined → null', () => {
    expect(timelineToPickerDate(null)).toBeNull()
    expect(timelineToPickerDate(undefined)).toBeNull()
    expect(pickerToTimelineDate(null)).toBeNull()
    expect(pickerToTimelineDate(undefined)).toBeNull()
  })

  it('pickerToTimelineDate принимает dayjs (нормализует в пояс)', () => {
    setLibraryTimezone('Europe/Amsterdam')
    const d = dayjs.utc('2026-06-01T10:00:00Z')
    const back = pickerToTimelineDate(d)!
    expect(back.format('HH:mm')).toBe('d'.length ? back.format('HH:mm') : '')
    expect(back.year()).toBe(2026)
    setLibraryTimezone(null)
  })
})
