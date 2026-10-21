import type { Ref } from 'vue'
import dayjs from 'dayjs'

/** Минимальная длительность создаваемого события, если не задана опция. */
const DEFAULT_MIN_DURATION_MIN = 15

export interface QuickCreateDeps {
  snap: (d: dayjs.Dayjs) => dayjs.Dayjs
  getDateFromX: (x: number) => dayjs.Dayjs
  addMin: (d: dayjs.Dayjs, m: number) => dayjs.Dayjs
  minCellMin: Ref<number>
  clampToBounds: (s: dayjs.Dayjs, e: dayjs.Dayjs) => { start: dayjs.Dayjs; end: dayjs.Dayjs }
  clampDuration: (s: dayjs.Dayjs, e: dayjs.Dayjs) => { start: dayjs.Dayjs; end: dayjs.Dayjs }
  hasOverlap: (resourceId: string | number, s: dayjs.Dayjs, e: dayjs.Dayjs) => boolean
}

/**
 * Мгновенное создание события коротким тапом по пустой ячейке (mobile).
 * Длительность — options.minDurationMinutes, иначе шаг сетки. Публичный
 * контракт ('create') идентичен десктопному range-selection.
 */
export function quickCreateAt(
  deps: QuickCreateDeps,
  resourceId: string | number,
  canvasX: number,
  minDurationMinutes: number | undefined,
): { start: dayjs.Dayjs; end: dayjs.Dayjs } | null {
  const snapped = deps.snap(deps.getDateFromX(canvasX))
  const minDur = minDurationMinutes ?? deps.minCellMin.value
  const bounds = deps.clampToBounds(snapped, deps.addMin(snapped, minDur))
  const { start, end } = deps.clampDuration(bounds.start, bounds.end)
  if (deps.hasOverlap(resourceId, start, end)) return null
  return { start, end }
}

/**
 * Итог выделения диапазона → событие для эмита 'create', либо null если
 * диапазон перекрывается с существующими событиями (allowOverlap=false).
 */
export function commitRangeSelection(
  deps: Pick<QuickCreateDeps, 'clampToBounds' | 'clampDuration' | 'hasOverlap'>,
  resourceId: string | number,
  start: dayjs.Dayjs,
  end: dayjs.Dayjs,
): { start: dayjs.Dayjs; end: dayjs.Dayjs } | null {
  const bounds = deps.clampToBounds(start, end)
  const clamped = deps.clampDuration(bounds.start, bounds.end)
  // T-36: hasOverlap учитывает группы «строгих» соседей
  if (deps.hasOverlap(resourceId, clamped.start, clamped.end)) return null
  return clamped
}

export { DEFAULT_MIN_DURATION_MIN }
