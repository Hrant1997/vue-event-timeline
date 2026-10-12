import dayjs from 'dayjs'

/**
 * T-29: lane-раскладка перекрывающихся событий (allowOverlap: true).
 *
 * Алгоритм (как в Google Calendar):
 *  1. События сортируются по start (при равных — более длинное раньше,
 *     чтобы оно стало «базой» кластера).
 *  2. Жадный проход строит транзитивные кластеры пересечений: событие
 *     попадает в текущий кластер, пока его start < clusterEnd (пересечение
 *     хотя бы с одним событием кластера); иначе открывается новый кластер.
 *     Касание границами (end === start другого) пересечением НЕ считается.
 *  3. Внутри кластера каждому событию назначается lane — минимальный
 *     свободный индекс (жадный алгоритм по start; lanes занимаются до end).
 *  4. maxLanes = число lanes всего кластера — все события кластера делят
 *     высоту строки на одинаковое количество слоёв.
 *
 * Возвращается Map id → { lane, lanes }, где lanes >= 1.
 * Стоимость O(n log n) на пересчёт (сортировка), вызывается из computed.
 */
export interface LaneInfo {
  /** Индекс дорожки внутри кластера, 0-based */
  lane: number
  /** Общее число дорожек в кластере (>= 1) */
  lanes: number
}

interface LaneInput {
  id: string | number
  start: dayjs.Dayjs
  end: dayjs.Dayjs
}

export function computeLaneLayout(events: LaneInput[]): Map<string | number, LaneInfo> {
  const result = new Map<string | number, LaneInfo>()
  if (events.length === 0) return result

  // копия + сортировка по start, при равенстве — по убыванию длительности
  const sorted = [...events].sort((a, b) => {
    const d = a.start.valueOf() - b.start.valueOf()
    if (d !== 0) return d
    return (b.end.valueOf() - b.start.valueOf()) - (a.end.valueOf() - a.start.valueOf())
  })

  let cluster: LaneInput[] = []
  let clusterEnd = -Infinity

  const flush = () => {
    if (cluster.length === 0) return
    // lane[i] — время (ms), до которого дорожка i занята
    const laneEnds: number[] = []
    const assigned = new Map<string | number, number>()
    for (const ev of cluster) {
      const s = ev.start.valueOf()
      const e = Math.max(ev.end.valueOf(), s) // защита от end < start
      let placed = false
      for (let i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i] <= s) { laneEnds[i] = e; assigned.set(ev.id, i); placed = true; break }
      }
      if (!placed) { laneEnds.push(e); assigned.set(ev.id, laneEnds.length - 1) }
    }
    const lanes = laneEnds.length
    for (const ev of cluster) {
      result.set(ev.id, { lane: assigned.get(ev.id) ?? 0, lanes })
    }
    cluster = []
  }

  for (const ev of sorted) {
    const s = ev.start.valueOf()
    const e = Math.max(ev.end.valueOf(), s)
    if (cluster.length > 0 && s >= clusterEnd) {
      flush()
      clusterEnd = -Infinity
    }
    cluster.push(ev)
    clusterEnd = Math.max(clusterEnd, e)
  }
  flush()

  return result
}

/**
 * Геометрия слоя внутри строки высотой rowHeight.
 *  - laneHeight = floor(rowHeight / lanes) — целые px, без дробных щелей;
 *  - minLaneHeight — нижняя граница читаемости (UX-согласование из TASKS.md):
 *    если слои тоньше, высота не режется дальше — вместо этого включается
 *    прокрутка дорожек (consume может показать только часть lanes);
 *  - offset центрирует блок дорожек внутри строки (суммарные отступы сверху
 *    и снизу равны rowHeight - lanes*laneHeight, распределены поровну).
 */
export function laneGeometry(lane: number, lanes: number, rowHeight: number, minLaneHeight = 16) {
  const laneHeight = Math.max(minLaneHeight, Math.floor(rowHeight / lanes))
  const blockTop = Math.max(0, Math.floor((rowHeight - lanes * laneHeight) / 2))
  return {
    top: blockTop + lane * laneHeight,
    height: laneHeight
  }
}
