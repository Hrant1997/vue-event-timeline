import { computed, type Ref } from 'vue'
import dayjs from 'dayjs'
import type { RulerMark } from '../types'

/**
 * Единая логика генерации меток линеек (top/bottom).
 * Все пороги зума (px per hour) объявлены в одном месте — RULER_THRESHOLDS,
 * чтобы topMarks / bottomMarks / gridStyle не расходились по уровням.
 */

export const RULER_THRESHOLDS = {
  /** px/час ниже этого — показываем годы */
  year: 1.5,
  /** px/час ниже этого — показываем месяцы */
  month: 4,
  /** px/час ниже этого — показываем дни */
  day: 15,
  /** px/час ниже этого — часовые метки, выше — минутные */
  hour: 35,
  /** px/час для 15-минутных меток */
  minute: 120,
} as const

interface MarkContext {
  viewStartMs: number
  pxPerMin: number
  width: number
}

const toX = (ms: number, ctx: MarkContext) => ((ms - ctx.viewStartMs) / 60000) * ctx.pxPerMin

/**
 * Универсальный построитель меток заданной гранулярности.
 * Заменяет ~200 строк дублирующихся циклов `-1..-60` / `0..90`.
 */
function buildUnitMarks(
  ctx: MarkContext,
  unit: 'year' | 'month' | 'day',
  startFrom: dayjs.Dayjs,
  format: (d: dayjs.Dayjs) => string,
  widthOf: (d: dayjs.Dayjs) => number,
): RulerMark[] {
  const marks: RulerMark[] = []
  const backIter = startFrom.subtract(1, unit)
  for (let i = 0; i < 72; i++) {
    const cur = backIter.subtract(i, unit)
    const x = toX(cur.valueOf(), ctx)
    const w = widthOf(cur)
    if (x + w < 0) break
    marks.push({ time: cur.valueOf(), x, width: w, label: format(cur), type: unit, sticky: false })
  }
  for (let i = 0; i < 144; i++) {
    const cur = startFrom.add(i, unit)
    const x = toX(cur.valueOf(), ctx)
    if (x > ctx.width + 100) break
    marks.push({ time: cur.valueOf(), x, width: widthOf(cur), label: format(cur), type: unit, sticky: false })
  }
  return marks
}

const minStepForPx = (pxPerHour: number): number => {
  if (pxPerHour >= RULER_THRESHOLDS.minute) return 15
  if (pxPerHour >= RULER_THRESHOLDS.hour) return 60
  return 360
}

function buildHourMinuteMarks(ctx: MarkContext, pxPerHour: number): RulerMark[] {
  const marks: RulerMark[] = []
  const step = minStepForPx(pxPerHour)
  let current = dayjs(ctx.viewStartMs).startOf('day').subtract(step, 'minute')
  // защита от бесконечного цикла при аномальных параметрах
  for (let guard = 0; guard < 5000; guard++) {
    const ms = current.valueOf()
    const x = toX(ms, ctx)
    if (x > ctx.width + 50) break
    if (x >= -50) {
      marks.push({
        time: ms,
        x,
        width: step * ctx.pxPerMin,
        label: current.format('HH:mm'),
        type: step === 15 ? 'minute' : 'hour',
        sticky: false,
      })
    }
    current = current.add(step, 'minute')
  }
  return marks
}

/** Помечает единственную «залипающую» метку, пересекающую левый край. */
export function applySticky(marks: RulerMark[]): RulerMark[] {
  let leftmost: RulerMark | null = null
  for (const m of marks) {
    if (m.x < 0 && m.x + (m.width || 0) > 0) {
      if (!leftmost || m.x > leftmost.x) leftmost = m
    }
  }
  return marks.map((m) => {
    if (leftmost && m.time === leftmost.time && m.type === leftmost.type) {
      const stickyWidth = leftmost.width + leftmost.x
      if (stickyWidth < 100) return { ...m, sticky: false }
      return { ...m, sticky: true, x: 0, width: stickyWidth }
    }
    return { ...m, sticky: false }
  })
}

export interface RulerMarksApi {
  topMarks: Ref<RulerMark[]>
  bottomMarks: Ref<RulerMark[]>
}

export function useRulerMarks(
  viewStart: Ref<dayjs.Dayjs>,
  pxPerMin: Ref<number>,
  containerWidth: Ref<number>,
  /** T-20: локаль dayjs для названий дней/месяцев (default 'en') */
  locale?: Ref<string>,
): RulerMarksApi {
  const context = computed<MarkContext>(() => ({
    viewStartMs: viewStart.value.valueOf(),
    pxPerMin: pxPerMin.value,
    width: containerWidth.value,
  }))

  // dayjs-объект в нужной локали; формат 'dd/MMM' и т.п. зависят от неё
  const loc = () => locale?.value ?? 'en'
  const fmt = (msOrDate: dayjs.ConfigType) => dayjs(msOrDate).locale(loc())

  const topMarks = computed<RulerMark[]>(() => {
    const ctx = context.value
    const pxPerHour = ctx.pxPerMin * 60
    const vs = fmt(ctx.viewStartMs)
    const minToPx = (mins: number) => mins * ctx.pxPerMin

    let marks: RulerMark[]
    if (pxPerHour >= RULER_THRESHOLDS.day) {
      marks = buildUnitMarks(ctx, 'day', vs.startOf('day'), (d) => fmt(d).format('dd, D MMM'), () => minToPx(1440))
    } else if (pxPerHour >= RULER_THRESHOLDS.month) {
      marks = buildUnitMarks(ctx, 'month', vs.startOf('month'), (d) => fmt(d).format('MMMM YYYY'), (d) =>
        minToPx(d.daysInMonth() * 1440),
      )
    } else if (pxPerHour >= RULER_THRESHOLDS.year) {
      marks = buildUnitMarks(ctx, 'month', vs.startOf('month'), (d) => fmt(d).format('MMM YYYY'), (d) =>
        minToPx(d.daysInMonth() * 1440),
      )
    } else {
      marks = buildUnitMarks(ctx, 'year', vs.startOf('year'), (d) => d.format('YYYY'), (d) =>
        minToPx(d.endOf('year').diff(d.startOf('year'), 'minute', true)),
      )
    }
    return applySticky(marks)
  })

  const bottomMarks = computed<RulerMark[]>(() => {
    const ctx = context.value
    const pxPerHour = ctx.pxPerMin * 60
    const vs = fmt(ctx.viewStartMs)
    const minToPx = (mins: number) => mins * ctx.pxPerMin

    if (pxPerHour < RULER_THRESHOLDS.year) {
      return buildUnitMarks(ctx, 'month', vs.startOf('month'), (d) => fmt(d).format('MMM'), (d) =>
        minToPx(d.daysInMonth() * 1440),
      )
    }
    if (pxPerHour < RULER_THRESHOLDS.day) {
      return buildUnitMarks(ctx, 'day', vs.startOf('day'), (d) => `${d.format('D')} ${fmt(d).format('dd')}`, () =>
        minToPx(1440),
      )
    }
    return buildHourMinuteMarks(ctx, pxPerHour)
  })

  return { topMarks, bottomMarks }
}
