import { default as dayjs } from 'dayjs';
import { TimelineEvent as TEvent, TimelineResource, TimelineOptions, TimelineEmits } from '../types';

declare const _default: <T = any>(__VLS_props: Awaited<typeof __VLS_setup>["props"], __VLS_ctx?: __VLS_Prettify<Pick<Awaited<typeof __VLS_setup>, "attrs" | "emit" | "slots">>, __VLS_expose?: NonNullable<Awaited<typeof __VLS_setup>>["expose"], __VLS_setup?: Promise<{
    props: __VLS_Prettify<__VLS_OmitKeepDiscriminatedUnion<(Partial<{}> & Omit<{
        readonly onCreate?: ((payload: import('..').TimelineCreatePayload<any>) => any) | undefined;
        readonly onUpdate?: ((payload: import('..').TimelineUpdatePayload<any>) => any) | undefined;
        readonly onSave?: ((payload: import('..').TimelineUpdatePayload<any>) => any) | undefined;
        readonly onDelete?: ((payload: import('..').TimelineDeletePayload<any>) => any) | undefined;
        readonly onSelect?: ((payload: import('..').TimelineSelectPayload<any>) => any) | undefined;
        readonly onHover?: ((payload: import('..').TimelineHoverPayload) => any) | undefined;
        readonly onChangeViewport?: ((payload: import('..').TimelineViewportPayload) => any) | undefined;
        readonly onChange?: ((payload: import('../types').TimelineChangePayload<any>) => any) | undefined;
        readonly "onUpdate:modelValue"?: ((payload: TEvent<any>[]) => any) | undefined;
    } & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps, never>) & {
        events: TEvent<T>[];
        resources: TimelineResource[];
        options?: TimelineOptions;
        /** T-19: опциональный prop с дефолтом false (README-пример его не передаёт) */
        loading?: boolean;
        /** Высота строки ресурса в px (T-10): используется и в CSS, и в hit-testing */
        rowHeight?: number;
        /** T-20: локаль dayjs для названий дней/месяцев; default — язык браузера или 'en' */
        locale?: string;
        /** T-20: title кнопки удаления на событиях (default 'Delete') */
        deleteTitle?: string;
    }, keyof import('vue').VNodeProps | keyof import('vue').AllowedComponentProps>> & {} & (import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps);
    expose(exposed: import('vue').ShallowUnwrapRef<{
        __setView: (vs: dayjs.Dayjs, ppm?: number) => void;
        __setContainerWidth: (w: number) => void;
        __activeDragEventId: () => string | number | null;
        __clearActiveDragEventId: () => void;
        __emitDragState: (payload: {
            active: boolean;
            eventId: string | number;
        }) => void;
    }>): void;
    attrs: any;
    slots: ReturnType<() => {
        header?(_: {
            viewStart: {
                clone: () => dayjs.Dayjs;
                isValid: () => boolean;
                year: {
                    (): number;
                    (value: number): dayjs.Dayjs;
                };
                month: {
                    (): number;
                    (value: number): dayjs.Dayjs;
                };
                date: {
                    (): number;
                    (value: number): dayjs.Dayjs;
                };
                day: {
                    (): 0 | 1 | 2 | 3 | 4 | 5 | 6;
                    (value: number): dayjs.Dayjs;
                };
                hour: {
                    (): number;
                    (value: number): dayjs.Dayjs;
                };
                minute: {
                    (): number;
                    (value: number): dayjs.Dayjs;
                };
                second: {
                    (): number;
                    (value: number): dayjs.Dayjs;
                };
                millisecond: {
                    (): number;
                    (value: number): dayjs.Dayjs;
                };
                set: (unit: dayjs.UnitType, value: number) => dayjs.Dayjs;
                get: (unit: dayjs.UnitType) => number;
                add: (value: number, unit?: dayjs.ManipulateType) => dayjs.Dayjs;
                subtract: (value: number, unit?: dayjs.ManipulateType) => dayjs.Dayjs;
                startOf: (unit: dayjs.OpUnitType) => dayjs.Dayjs;
                endOf: (unit: dayjs.OpUnitType) => dayjs.Dayjs;
                format: (template?: string) => string;
                diff: (date?: dayjs.ConfigType, unit?: dayjs.QUnitType | dayjs.OpUnitType, float?: boolean) => number;
                valueOf: () => number;
                unix: () => number;
                daysInMonth: () => number;
                toDate: () => Date;
                toJSON: () => string;
                toISOString: () => string;
                toString: () => string;
                utcOffset: {
                    (): number;
                    (offset: number | string, keepLocalTime?: boolean): dayjs.Dayjs;
                };
                isBefore: (date?: dayjs.ConfigType, unit?: dayjs.OpUnitType) => boolean;
                isSame: (date?: dayjs.ConfigType, unit?: dayjs.OpUnitType) => boolean;
                isAfter: (date?: dayjs.ConfigType, unit?: dayjs.OpUnitType) => boolean;
                locale: {
                    (): string;
                    (preset: string | ILocale, object?: Partial<ILocale>): dayjs.Dayjs;
                };
                utc: (keepLocalTime?: boolean) => dayjs.Dayjs;
                local: () => dayjs.Dayjs;
                isUTC: () => boolean;
                tz: (timezone?: string, keepLocalTime?: boolean) => dayjs.Dayjs;
                offsetName: (type?: "short" | "long") => string | undefined;
            };
            zoomLevel: string;
        }): any;
        "sidebar-item"?(_: {
            resource: TimelineResource;
        }): any;
        loading?(_: {}): any;
        event?(_: {
            event: TEvent<any>;
            duration: string;
        }): any;
    }>;
    emit: TimelineEmits<any>;
}>) => import('vue').VNode & {
    __ctx?: Awaited<typeof __VLS_setup>;
};
export default _default;
type __VLS_Prettify<T> = {
    [K in keyof T]: T[K];
} & {};
