import { type Ref } from 'vue'
import dayjs from 'dayjs'

/** Состояние выделения диапазона, раскрываемое родителю для hit-testing/эмитов. */
export interface RangeSelectionState {
  resourceId: string | number
  start: dayjs.Dayjs
  end: dayjs.Dayjs
}

export interface DragAutoScrollApi {
  /** Запрос автоскролла от активного drag/resize-жеста (payload из TimelineEvent) */
  handleAutoScroll: (payload: { direction: number; speed: number; eventId: string | number; clear?: boolean }) => void
  /** Остановить петлю и снять защиту viewport-фильтра (вызывается на unmount) */
  stopAutoScroll: (clear?: boolean) => void
}

export interface SelectAutoScrollApi {
  /** Продолжить выделение за краем canvas: dir=-1 влево, dir=1 вправо */
  startSelectAutoScroll: (dir: number, speed: number) => void
  /** Остановить петлю автоскролла выделения */
  stopSelectAutoScroll: () => void
}

export interface AutoScrollDeps {
  viewStart: Ref<dayjs.Dayjs>
  pxPerMin: Ref<number>
  addMin: (d: dayjs.Dayjs, m: number) => dayjs.Dayjs
  /** Смещение кадра автоскролла — компенсируется в координатах активного drag */
  currentDragShift: Ref<number>
  activeDragId: Ref<string | number | null>
  /** id события с активным drag/resize-жестом (сообщает TimelineEvent) */
  activeGestureId: Ref<string | number | null>
  /** Protected-id viewport-фильтра: activeGestureId ?? autoscrollActiveId */
  activeDragEventId: Ref<string | number | null>
}

/**
 * Синхронизировать protected-id viewport-фильтра с активным жестом/автоскроллом.
 * Общий для Timeline.vue и useDragAutoScroll: защита живёт, пока активен ХОТЬ
 * один источник (жест drag/resize или петля автоскролла).
 */
export function syncProtectedDragEventId(
  activeGestureId: Ref<string | number | null>,
  autoscrollActiveId: string | number | null,
  activeDragEventId: Ref<string | number | null>,
): void {
  const id = activeGestureId.value ?? autoscrollActiveId
  if (id !== null || activeDragEventId.value !== null) activeDragEventId.value = id
}

export interface SelectAutoScrollDeps extends AutoScrollDeps {
  snap: (d: dayjs.Dayjs) => dayjs.Dayjs
  getDateFromX: (x: number) => dayjs.Dayjs
  getX: (d: dayjs.Dayjs) => number
  diffMin: (a: dayjs.Dayjs, b: dayjs.Dayjs) => number
  minCellMin: Ref<number>
  selection: Ref<RangeSelectionState | null>
  isSelecting: () => boolean
  getSelStartTime: () => dayjs.Dayjs | null
  getSelResourceId: () => string | number | null
  /** Позиционирование превью у края при автоскролле выделения */
  canvasWidthProvider: () => number
}

/**
 * Edge auto-scroll во время drag/resize события (вынесено из Timeline.vue).
 *
 * Защита активного ивента от viewport-фильтра живёт до КОНЦА ЖЕСТА, а не только
 * пока крутится RAF-петля: RAF может остановиться раньше конца жеста (или
 * наоборот), событие выпадет из visibleEventsByResource → компонент
 * размонтируется посреди перетаскивания и ивент «пропадает». Поэтому id
 * под автоскроллом (autoscrollActiveId) учитывается вместе с id активного
 * жеста (activeGestureId) — снимается защита только когда завершены оба.
 */
export function useDragAutoScroll(deps: AutoScrollDeps): DragAutoScrollApi {
  let rafId: number | null = null
  let direction = 0
  let speed = 0
  let autoscrollActiveId: string | number | null = null

  /** Обновить protected-id viewport-фильтра (жест и/или автоскролл активны). */
  const syncProtectedId = () =>
    syncProtectedDragEventId(deps.activeGestureId, autoscrollActiveId, deps.activeDragEventId)

  const stopAutoScroll = (clear = false) => {
    direction = 0
    speed = 0
    if (clear) {
      autoscrollActiveId = null
      // FIX: жест завершён — снимаем защиту только если drag/resize-жест тоже
      // закончен (activeGestureId null). Иначе при остановке RAF извне живой
      // жест терял защиту и ивент пропадал при следующем выходе за viewport.
      if (deps.activeGestureId.value === null) {
        deps.activeDragId.value = null
        deps.currentDragShift.value = 0
      }
      syncProtectedId()
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  const startAutoScroll = (dir: number, spd: number, eventId: string | number) => {
    // Уже крутится петля другого направления — не переключаем на ходу
    if (direction !== 0 && direction !== dir) return
    direction = dir
    speed = spd
    deps.activeDragId.value = eventId
    // FIX: на время автоскролла держим событие в visibleEventsByResource,
    // даже если его позиция вышла за viewport — иначе оно исчезнет в момент
    // жеста и drag оборвётся.
    autoscrollActiveId = eventId
    syncProtectedId()

    if (rafId === null) {
      const tick = () => {
        if (direction === 0) {
          rafId = null
          return
        }
        const pxShift = speed * direction
        deps.currentDragShift.value += pxShift
        deps.viewStart.value = deps.addMin(deps.viewStart.value, pxShift / deps.pxPerMin.value)
        rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
    }
  }

  const handleAutoScroll: DragAutoScrollApi['handleAutoScroll'] = (payload) => {
    if (payload.direction === 0) stopAutoScroll(payload.clear)
    else startAutoScroll(payload.direction, payload.speed, payload.eventId)
  }

  return { handleAutoScroll, stopAutoScroll }
}

/**
 * Edge auto-scroll во время создания события протягиванием (range selection).
 * Петля сдвигает окно просмотра и обновляет превью выделения, «прижимая» его
 * вторую границу к последнему известному положению курсора у края canvas.
 */
export function useSelectAutoScroll(deps: SelectAutoScrollDeps): SelectAutoScrollApi {
  let rafId: number | null = null
  let direction = 0
  let speed = 0

  const stopSelectAutoScroll = () => {
    direction = 0
    speed = 0
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  const startSelectAutoScroll = (dir: number, spd: number) => {
    // Смена направления посреди петли — сначала корректно её остановить
    if (direction !== 0 && direction !== dir) stopSelectAutoScroll()

    direction = dir
    speed = spd

    if (rafId !== null) return

    const tick = () => {
      const selStart = deps.getSelStartTime()
      if (direction === 0 || !deps.isSelecting() || !selStart) {
        rafId = null
        return
      }

      const pxShift = speed * direction
      deps.viewStart.value = deps.addMin(deps.viewStart.value, pxShift / deps.pxPerMin.value)

      // Обновляем превью выделения при скролле: используем последнюю известную
      // позицию курсора (примерно — у края, откуда пришёл запрос).
      if (deps.selection.value) {
        const currentStartX = deps.getX(selStart)
        const width = deps.canvasWidthProvider()
        const lastCursorX = direction > 0 ? width - 20 : 20
        const s = deps.snap(deps.getDateFromX(Math.min(currentStartX, lastCursorX)))
        const en = deps.snap(deps.getDateFromX(Math.max(currentStartX, lastCursorX)))
        const finalEnd = deps.diffMin(en, s) < deps.minCellMin.value
          ? deps.addMin(s, deps.minCellMin.value)
          : en
        deps.selection.value = { resourceId: deps.getSelResourceId()!, start: s, end: finalEnd }
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  return { startSelectAutoScroll, stopSelectAutoScroll }
}
