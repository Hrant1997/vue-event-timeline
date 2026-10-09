import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import dayjs from 'dayjs'
import type { TimelineEvent, TimelineOptions, TimelineResource } from '../src/types'
import { useTimeline } from '../src/components/useTimeline'
import { setLibraryTimezone } from '../src/utils/date'

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
})
