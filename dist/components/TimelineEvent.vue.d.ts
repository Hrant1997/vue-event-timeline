import { default as dayjs } from 'dayjs';
import { TimelineEvent } from '../types';

declare function __VLS_template(): {
    default?(_: {
        event: TimelineEvent<any>;
        duration: string;
    }): any;
};
declare const __VLS_component: import('vue').DefineComponent<import('vue').ExtractPropTypes<__VLS_WithDefaults<__VLS_TypePropsToRuntimeProps<{
    event: TimelineEvent;
    viewStart: dayjs.Dayjs;
    pxPerMin: number;
    canEditGlobal: boolean;
    canDeleteGlobal: boolean;
    canvasWidth: number;
    dragShiftPx: number;
    /** T-20: title кнопки удаления (интернационализация) */
    deleteTitle?: string;
    /** Высота строки — ивент масштабируется вместе с ней (top/height из неё) */
    rowHeight?: number;
    /**
     * T-29: геометрия lane-слоя при allowOverlap: true (top/height в px).
     * Если задана — событие занимает свой вертикальный слой внутри строки
     * вместо центрированной раскладки на всю высоту.
     */
    laneStyle?: {
        top: string;
        height: string;
    };
    /**
     * T-32: проверка допустимости позиции (hasOverlap + clampToBounds).
     * Вызывается на каждый кадр drag/resize при allowOverlap=false —
     * событие не заходит на другое, а упирается в его границу.
     */
    canMoveTo?: (start: dayjs.Dayjs, end: dayjs.Dayjs) => boolean;
    /**
     * T-32.1: нормализация позиции — те же snap + clampDuration + clampToBounds,
     * что внутри canMoveTo. Возвращает ФИНАЛЬНУЮ позицию для пары start/end.
     * Нужна, чтобы «упираться» ровно в границу соседа без зазора после snap
     * (иначе findNearestValid сходится к lo, который при нормализации отъезжает
     * назад на шаг сетки). Если не задана — используется только canMoveTo.
     */
    normalizePosition?: (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
        start: dayjs.Dayjs;
        end: dayjs.Dayjs;
    };
    /** Шаг сетки в минутах — с ним live-позиция совпадает с финальной (snap внутри canMoveTo) */
    snapMinutes?: number;
}>, {
    deleteTitle: string;
    rowHeight: number;
    snapMinutes: number;
}>>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
    update: (changes: Partial<Pick<TimelineEvent<any>, "start" | "end">>) => void;
    save: (changes: Partial<Pick<TimelineEvent<any>, "start" | "end">>) => void;
    delete: () => void;
    click: () => void;
    "request-autoscroll": (payload: {
        mouseX: number;
        direction: number;
        speed: number;
        eventId: string | number;
        clear?: boolean;
    }) => void;
    "hover-event": (arg: boolean) => void;
    "drag-state": (payload: {
        active: boolean;
        eventId: string | number;
    }) => void;
}, string, import('vue').PublicProps, Readonly<import('vue').ExtractPropTypes<__VLS_WithDefaults<__VLS_TypePropsToRuntimeProps<{
    event: TimelineEvent;
    viewStart: dayjs.Dayjs;
    pxPerMin: number;
    canEditGlobal: boolean;
    canDeleteGlobal: boolean;
    canvasWidth: number;
    dragShiftPx: number;
    /** T-20: title кнопки удаления (интернационализация) */
    deleteTitle?: string;
    /** Высота строки — ивент масштабируется вместе с ней (top/height из неё) */
    rowHeight?: number;
    /**
     * T-29: геометрия lane-слоя при allowOverlap: true (top/height в px).
     * Если задана — событие занимает свой вертикальный слой внутри строки
     * вместо центрированной раскладки на всю высоту.
     */
    laneStyle?: {
        top: string;
        height: string;
    };
    /**
     * T-32: проверка допустимости позиции (hasOverlap + clampToBounds).
     * Вызывается на каждый кадр drag/resize при allowOverlap=false —
     * событие не заходит на другое, а упирается в его границу.
     */
    canMoveTo?: (start: dayjs.Dayjs, end: dayjs.Dayjs) => boolean;
    /**
     * T-32.1: нормализация позиции — те же snap + clampDuration + clampToBounds,
     * что внутри canMoveTo. Возвращает ФИНАЛЬНУЮ позицию для пары start/end.
     * Нужна, чтобы «упираться» ровно в границу соседа без зазора после snap
     * (иначе findNearestValid сходится к lo, который при нормализации отъезжает
     * назад на шаг сетки). Если не задана — используется только canMoveTo.
     */
    normalizePosition?: (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
        start: dayjs.Dayjs;
        end: dayjs.Dayjs;
    };
    /** Шаг сетки в минутах — с ним live-позиция совпадает с финальной (snap внутри canMoveTo) */
    snapMinutes?: number;
}>, {
    deleteTitle: string;
    rowHeight: number;
    snapMinutes: number;
}>>> & Readonly<{
    onUpdate?: ((changes: Partial<Pick<TimelineEvent<any>, "start" | "end">>) => any) | undefined;
    onSave?: ((changes: Partial<Pick<TimelineEvent<any>, "start" | "end">>) => any) | undefined;
    onDelete?: (() => any) | undefined;
    onClick?: (() => any) | undefined;
    "onRequest-autoscroll"?: ((payload: {
        mouseX: number;
        direction: number;
        speed: number;
        eventId: string | number;
        clear?: boolean;
    }) => any) | undefined;
    "onHover-event"?: ((arg: boolean) => any) | undefined;
    "onDrag-state"?: ((payload: {
        active: boolean;
        eventId: string | number;
    }) => any) | undefined;
}>, {
    deleteTitle: string;
    rowHeight: number;
    snapMinutes: number;
}, {}, {}, {}, string, import('vue').ComponentProvideOptions, true, {}, any>;
declare const _default: __VLS_WithTemplateSlots<typeof __VLS_component, ReturnType<typeof __VLS_template>>;
export default _default;
type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;
type __VLS_TypePropsToRuntimeProps<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? {
        type: import('vue').PropType<__VLS_NonUndefinedable<T[K]>>;
    } : {
        type: import('vue').PropType<T[K]>;
        required: true;
    };
};
type __VLS_WithDefaults<P, D> = {
    [K in keyof Pick<P, keyof P>]: K extends keyof D ? __VLS_Prettify<P[K] & {
        default: D[K];
    }> : P[K];
};
type __VLS_Prettify<T> = {
    [K in keyof T]: T[K];
} & {};
type __VLS_WithTemplateSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
