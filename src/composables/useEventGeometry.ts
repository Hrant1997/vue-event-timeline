import { computed, type Ref } from 'vue'
import type { TimelineEvent as TEvent, TimelineResource } from '../types'

/** Вертикальная геометрия одного lane-слоя внутри строки (px от ВЕРХА строки). */
export interface LaneLayerGeometry {
  top: number
  height: number
  /** Низ последнего слоя — используется для растяжки строки под все дорожки */
  blockBottom: number
}

/** Вертикальный слой события: top/height в px внутри своей строки. */
export interface EventLaneStyle {
  top: string
  height: string
}

export interface EventGeometryApi {
  /** Геометрия lane-слоя № `lane` из `lanes` при текущей высоте строки */
  laneLayer: (lane: number, lanes: number) => LaneLayerGeometry
  /** Требуемая высота строки i: rowHeight либо больше — если дорожки переполняют её */
  rowNeedHeight: (i: number) => number
  /** Стиль строки canvas (высота всегда из одного источника — реактивна на props) */
  rowStyle: (i: number) => { height: string }
  /** Стиль элемента сайдбара — обязан совпадать со стилем строки по индексам */
  sidebarItemStyle: (i: number) => { height: string }
  /** Top/height каждого видимого события по его lane-слою (id → стиль) */
  eventStyle: Ref<Record<string | number, EventLaneStyle>>
}

/** Верхний/нижний паддинг строки (по 2px) — суммарно ≈ исторические 12px запаса. */
const ROW_PAD = 4

/** Минимальная высота lane-слоя; ниже — не читаемо и неудобен для drag. */
const MIN_LANE_HEIGHT = 16

/** Нижний паддинг переполненной строки под последним слоем. */
const ROW_BOTTOM_PAD = 4

/**
 * Вертикальная раскладка строк и lane-слоёв событий (T-29, вынесено из Timeline.vue).
 *
 * При allowOverlap строка может содержать несколько дорожек: если они не влезают
 * в rowHeight, блок слоёв уходит НИЖЕ строки и rowNeedHeight растягивает .tl-row
 * под него — так события и их строки используют один источник геометрии.
 */
export function useEventGeometry(
  resources: Ref<TimelineResource[]>,
  rowHeight: Ref<number>,
  eventsFor: (resourceId: string | number) => TEvent[],
  getLaneInfo: (resourceId: string | number, eventId: string | number) => { lane: number; lanes: number } | null,
): EventGeometryApi {
  const laneLayer = (lane: number, lanes: number): LaneLayerGeometry => {
    const rh = rowHeight.value
    const laneH = Math.max(MIN_LANE_HEIGHT, Math.floor((rh - ROW_PAD) / lanes))
    const blockH = lanes * laneH
    const offset = Math.max(2, Math.floor((rh - blockH) / 2))
    return { top: offset + lane * laneH, height: laneH, blockBottom: offset + blockH }
  }

  /** Максимальное число дорожек в строке ресурса */
  const maxLanesFor = (resourceId: string | number): number => {
    let m = 1
    for (const ev of eventsFor(resourceId)) {
      const info = getLaneInfo(resourceId, ev.id)
      if (info && info.lanes > m) m = info.lanes
    }
    return m
  }

  const rowNeedHeight = (i: number): number => {
    const r = resources.value[i]
    if (!r) return rowHeight.value
    const lanes = maxLanesFor(r.id)
    if (lanes <= 1) return rowHeight.value
    return Math.max(rowHeight.value, laneLayer(0, lanes).blockBottom + ROW_BOTTOM_PAD)
  }

  // РЕГРЕССИЯ (rowHeight): раньше при lanes<=1 возвращался undefined и строка
  // жила только на CSS var(--tl-row-height). Vue патчит style-атрибут по ключам,
  // и для строк без inline-высоты атрибут мог остаться stale при изменении
  // rowHeight. Теперь высота строки ВСЕГДА идёт из одного источника —
  // computed rowNeedHeight — и гарантированно реактивна на props.
  const rowStyle = (i: number) => ({ height: `${rowNeedHeight(i)}px` })
  const sidebarItemStyle = (i: number) => ({ height: `${rowNeedHeight(i)}px` })

  const eventStyle = computed(() => {
    const m: Record<string | number, EventLaneStyle> = {}
    for (const r of resources.value) {
      for (const ev of eventsFor(r.id)) {
        const info = getLaneInfo(r.id, ev.id)
        if (info) {
          const g = laneLayer(info.lane, info.lanes)
          m[ev.id] = { top: `${g.top}px`, height: `${g.height}px` }
        }
      }
    }
    return m
  })

  return { laneLayer, rowNeedHeight, rowStyle, sidebarItemStyle, eventStyle }
}
