import { Ref } from 'vue';
import { default as dayjs } from 'dayjs';
import { RulerMark } from '../types';

/**
 * Единая логика генерации меток линеек (top/bottom).
 * Все пороги зума (px per hour) объявлены в одном месте — RULER_THRESHOLDS,
 * чтобы topMarks / bottomMarks / gridStyle не расходились по уровням.
 */
export declare const RULER_THRESHOLDS: {
    /** px/час ниже этого — показываем годы */
    readonly year: 1.5;
    /** px/час ниже этого — показываем месяцы */
    readonly month: 4;
    /** px/час ниже этого — показываем дни */
    readonly day: 15;
    /** px/час ниже этого — часовые метки, выше — минутные */
    readonly hour: 35;
    /** px/час для 15-минутных меток */
    readonly minute: 120;
};
/** Шаг сетки (в минутах) для нижних меток по текущему зуму. Единая точка истины. */
export declare const minStepForPx: (pxPerHour: number) => number;
/** Помечает единственную «залипающую» метку, пересекающую левый край. */
export declare function applySticky(marks: RulerMark[]): RulerMark[];
export interface RulerMarksApi {
    topMarks: Ref<RulerMark[]>;
    bottomMarks: Ref<RulerMark[]>;
}
export declare function useRulerMarks(viewStart: Ref<dayjs.Dayjs>, pxPerMin: Ref<number>, containerWidth: Ref<number>, 
/** T-20: локаль dayjs для названий дней/месяцев (default 'en') */
locale?: Ref<string>): RulerMarksApi;
