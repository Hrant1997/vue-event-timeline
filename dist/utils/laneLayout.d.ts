import { default as dayjs } from 'dayjs';

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
    lane: number;
    /** Общее число дорожек в кластере (>= 1) */
    lanes: number;
}
interface LaneInput {
    id: string | number;
    start: dayjs.Dayjs;
    end: dayjs.Dayjs;
}
export declare function computeLaneLayout(events: LaneInput[]): Map<string | number, LaneInfo>;
/**
 * Геометрия слоя внутри строки высотой rowHeight.
 *  - laneHeight = floor(rowHeight / lanes) — целые px, без дробных щелей;
 *  - minLaneHeight — нижняя граница читаемости (UX-согласование из TASKS.md):
 *    если слои тоньше, высота не режется дальше — вместо этого включается
 *    прокрутка дорожек (consume может показать только часть lanes);
 *  - offset центрирует блок дорожек внутри строки (суммарные отступы сверху
 *    и снизу равны rowHeight - lanes*laneHeight, распределены поровну).
 */
export declare function laneGeometry(lane: number, lanes: number, rowHeight: number, minLaneHeight?: number): {
    top: number;
    height: number;
};
export {};
