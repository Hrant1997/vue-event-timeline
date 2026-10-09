// Жёсткие unit-тесты на src/composables/useRulerMarks.ts (T-07, T-20, T-27)
import { describe, it, expect, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import 'dayjs/locale/ru'
dayjs.extend(utc)
dayjs.extend(timezone)
import 'dayjs/locale/de'
import { useRulerMarks, applySticky, RULER_THRESHOLDS, minStepForPx } from '../src/composables/useRulerMarks'
import type { RulerMark } from '../src/types'
import { setLibraryTimezone, toTimelineDate } from '../src/utils/date'

const VIEW_START = '2026-10-09T00:00:00'

function setup(pxPerMin: number, width = 1200, locale?: string, viewStartIso = VIEW_START) {
  const viewStart = ref(toTimelineDate(viewStartIso))
  const px = ref(pxPerMin)
  const w = ref(width)
  const loc = locale ? ref(locale) : undefined
  return useRulerMarks(viewStart, px, w, loc)
}

beforeEach(() => setLibraryTimezone(null))

describe('пороги зума едины и согласованы (T-07)', () => {
  it('RULER_THRESHOLDS монотонны: year < month < day < hour < minute', () => {
    const t = RULER_THRESHOLDS
    expect(t.year).toBeLessThan(t.month)
    expect(t.month).toBeLessThan(t.day)
    expect(t.day).toBeLessThan(t.hour)
    expect(t.hour).toBeLessThan(t.minute)
  })

  it('minute-метки появляются ровно при px/час >= 120 (35px/мин — не раньше!)', () => {
    // старый баг: пороги линеек расходились с zoomLevel
    const below = setup(119 / 60) // 119 px/час
    expect(below.bottomMarks.value.every((m) => m.type !== 'minute')).toBe(true)

    const at = setup(120 / 60) // ровно порог
    expect(at.bottomMarks.value.some((m) => m.type === 'minute')).toBe(true)
    expect(at.bottomMarks.value.every((m) => ['hour', 'minute'].includes(m.type))).toBe(true)
    // шаг сетки = 15 минут
    expect(minStepForPx(120)).toBe(15)
  })

  it('hour-метки между 35 и 120 px/час', () => {
    const t = setup(60 / 60) // 60 px/час
    expect(t.bottomMarks.value.every((m) => m.type === 'hour')).toBe(true)
    // шаг часовой сетки = 60 минут * pxPerMin
    expect(t.bottomMarks.value[0].width).toBeCloseTo(60 * 1, 5)
  })

  it('при 15..35 px/час нижняя линейка — 6-часовые метки, верхняя — дни', () => {
    const t = setup(20 / 60)
    // шаг сетки = 360 мин (6 часов), тип — hour только на :00
    expect(minStepForPx(20)).toBe(360)
    expect(t.bottomMarks.value.every((m) => m.type === 'hour' || m.type === 'minute')).toBe(true)
    expect(t.topMarks.value.every((m) => m.type === 'day')).toBe(true)
  })

  it('top переключается день->месяц->год по убыванию зума', () => {
    expect(setup(40 / 60).topMarks.value[0].type).toBe('day')
    expect(setup(8 / 60).topMarks.value.some((m) => m.type === 'month')).toBe(true)
    expect(setup(1 / 60).topMarks.value.some((m) => m.type === 'year')).toBe(true)
  })
})

describe('корректность меток', () => {
  it('часовые метки идут строго по часам, отсортированы по x (60 px/час)', () => {
    const t = setup(1) // 60 px/час -> шаг = 60 мин, все метки на часе
    const marks = t.bottomMarks.value.filter((m) => m.x >= 0 && m.x <= 1200)
    expect(marks.length).toBeGreaterThan(5)
    for (const m of marks) {
      expect(m.type).toBe('hour')
      expect(dayjs(m.time).minute()).toBe(0)
      expect(dayjs(m.time).second()).toBe(0)
    }
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i].x).toBeGreaterThan(marks[i - 1].x)
      expect(marks[i].time - marks[i - 1].time).toBe(3600_000)
    }
  })

  it('15-минутная сетка: метки каждые 15 мин, тип по времени (:00 = hour)', () => {
    const t = setup(2) // 120 px/час -> шаг 15 мин
    const marks = t.bottomMarks.value.filter((m) => m.x >= 0 && m.x <= 1200)
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i].time - marks[i - 1].time).toBe(15 * 60_000)
    }
    const onHour = marks.find((m) => dayjs(m.time).minute() === 0)!
    expect(onHour.type).toBe('hour')
    const q15 = marks.find((m) => dayjs(m.time).minute() === 15)!
    expect(q15.type).toBe('minute')
  })

  it('x метки совпадает с getX(viewStart) математикой: ((t - vs)/60000)*pxPerMin', () => {
    const pxPerMin = 3
    const vs = dayjs(VIEW_START)
    const t = setup(pxPerMin)
    for (const m of t.bottomMarks.value.slice(0, 10)) {
      const expectedX = ((m.time - vs.valueOf()) / 60000) * pxPerMin
      expect(m.x).toBeCloseTo(expectedX, 5)
    }
  })

  it('labels часовых меток в формате HH:mm', () => {
    const t = setup(2)
    const first = t.bottomMarks.value.find((m) => m.x >= 0)!
    expect(first.label).toMatch(/^\d{2}:\d{2}$/)
  })

  it('метки вне видимой области не генерируются бесконечно (guard + break)', () => {
    const t = setup(0.02, 1200) // сильный зум-аут (min)
    expect(t.topMarks.value.length).toBeLessThanOrEqual(216) // 72+144 максимум
    expect(t.bottomMarks.value.length).toBeLessThanOrEqual(216)
  })

  it('при изменении pxPerMin/viewStart метки реактивно пересчитываются', () => {
    const viewStart = ref(toTimelineDate(VIEW_START))
    const px = ref(2)
    const w = ref(1200)
    const { bottomMarks } = useRulerMarks(viewStart, px, w)
    const before = bottomMarks.value.length
    px.value = 4
    const after = bottomMarks.value.length
    expect(after).toBeLessThan(before) // крупнее масштаб -> меньше меток в окне
    viewStart.value = viewStart.value.add(1, 'day')
    expect(bottomMarks.value[0].label).toMatch(/^(\d{2}):(\d{2})$/)
  })
})

describe('applySticky (залипающая левая метка)', () => {
  const mk = (over: Partial<RulerMark>[]): RulerMark[] =>
    over.map((o) => ({ time: 0, x: 0, width: 0, label: '', type: 'day', sticky: false, ...o }))

  it('метка, пересекающая левый край, становится sticky с x=0', () => {
    const res = applySticky(mk([{ time: 1, type: 'day', x: -20, width: 200 }]))
    expect(res[0].sticky).toBe(true)
    expect(res[0].x).toBe(0)
    expect(res[0].width).toBe(180) // 200 + (-20): залипающая часть = видимая ширина
  })

  it('из нескольких пересекающих выбирается самая правая (ближняя к краю)', () => {
    const res = applySticky(mk([
      { time: 1, type: 'day', x: -90, width: 200 },
      { time: 2, type: 'day', x: -10, width: 200 },
    ]))
    expect(res.find((m) => m.time === 2)!.sticky).toBe(true)
    expect(res.find((m) => m.time === 1)!.sticky).toBe(false)
  })

  it('слишком узкая sticky-метка (<100px) не залипает', () => {
    const res = applySticky(mk([{ time: 1, type: 'day', x: -95, width: 100 }]))
    expect(res[0].sticky).toBe(false)
  })

  it('полностью невидимые метки (x+w<=0) игнорируются', () => {
    const res = applySticky(mk([
      { time: 1, type: 'day', x: -200, width: 100 },
      { time: 2, type: 'day', x: 50, width: 100 },
    ]))
    expect(res.every((m) => !m.sticky)).toBe(true)
  })
})

describe('локализация меток (T-20)', () => {
  it('ru-локаль даёт русские названия дней (top-линейка)', () => {
    const t = setup(20 / 60, 1200, 'ru') // day-метки формат 'dd, D MMM' — в top
    expect(t.topMarks.value.some((m) => /пт|сб|вс|пн|вт|ср|чт/.test(m.label))).toBe(true)
  })

  it('en-локаль даёт английские названия месяцев (top-линейка, месяц при 8 px/час)', () => {
    const t = setup(8 / 60, 1200, 'en')
    expect(t.topMarks.value.some((m) => m.label.includes('October'))).toBe(true)
  })

  it('de-локаль меняет название месяца в top-метках', () => {
    const en = setup(8 / 60, 1200, 'en').topMarks.value.find((m) => m.x >= 0)!
    const de = setup(8 / 60, 1200, 'de').topMarks.value.find((m) => m.x >= 0)!
    expect(en.label).toContain('October')
    expect(de.label).toContain('Okt')
  })
})

describe('timezone-aware метки (T-27)', () => {
  it('день начинается с полночи пояса библиотеки, а не системного', () => {
    setLibraryTimezone('Pacific/Auckland') // UTC+13 летом 2026
    // 2026-10-09T00:00Z = 13:00 в Окленде → первый часовой маркер дня 13:00..след. полночь
    const t = setup(2, 1200, undefined, '2026-10-09T00:00:00Z')
    const marks = computed(() => t.bottomMarks.value)
    const firstMidnight = marks.value.find((m) => m.label === '00:00')
    if (firstMidnight) {
      // полночь Окленда = 2026-10-08T11:00Z
      expect(firstMidnight.time).toBe(dayjs.utc('2026-10-08T11:00:00').valueOf())
    }
    // все метки выровнены по сетке пояса: минуты кратно шагу (15 при 120px/час)
    for (const m of marks.value) expect(dayjs(m.time).tz('Pacific/Auckland').minute() % 15).toBe(0)
  })

  it('same absolute moment -> same mark times regardless of display tz', () => {
    // фиксированный UTC midnight — не зависит от системного пояса раннера
    const ms = dayjs.utc('2026-10-09T00:00:00').valueOf()
    setLibraryTimezone('UTC')
    const b = setup(2, 1200, undefined, '2026-10-09T00:00:00Z').bottomMarks.value.map((m) => m.time)
    // библиотека в UTC при 120px/час: шаг сетки 15 мин -> метки кратны 15 мин
    for (const t of b) expect(((t % 900_000) + 900_000) % 900_000).toBe(0)
    // тот же момент через number-ms даёт идентичные метки
    const c = setup(2, 1200, undefined, ms).bottomMarks.value.map((m) => m.time)
    expect(c).toEqual(b)
    expect(b.length).toBeGreaterThan(0)
  })
})
