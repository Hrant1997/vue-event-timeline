import { Ref } from 'vue';
import { default as dayjs } from 'dayjs';
import { TimelineEvent, TimelineOptions, TimelineResource } from '../types';
import { normalizeEventChanges } from '../utils/date';
import { LaneInfo } from '../utils/laneLayout';

export declare function useTimeline(events: Ref<TimelineEvent[]>, resources: Ref<TimelineResource[]>, options: Ref<TimelineOptions>): {
    viewStart: Ref<{
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
    }, dayjs.Dayjs | {
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
    }>;
    viewEnd: import('vue').ComputedRef<dayjs.Dayjs>;
    pxPerMin: Ref<number, number>;
    containerWidth: Ref<number, number>;
    zoomLevel: import('vue').ComputedRef<"month" | "day" | "hour" | "minute">;
    timezoneOffsetMinutes: import('vue').ComputedRef<number>;
    snap: (d: dayjs.Dayjs) => dayjs.Dayjs;
    addMin: (d: dayjs.Dayjs, m: number) => dayjs.Dayjs;
    diffMin: (a: dayjs.Dayjs, b: dayjs.Dayjs) => number;
    hasOverlap: (resourceId: string | number, start: dayjs.Dayjs, end: dayjs.Dayjs, excludeId?: string | number) => boolean;
    clampToBounds: (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
        start: dayjs.Dayjs;
        end: dayjs.Dayjs;
    };
    clampDuration: (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
        start: dayjs.Dayjs;
        end: dayjs.Dayjs;
    };
    zoom: (delta: number, anchorX?: number) => void;
    getX: (d: dayjs.Dayjs) => number;
    getDateFromX: (x: number) => dayjs.Dayjs;
    eventsByResource: (resourceId: string | number) => TimelineEvent<any>[];
    eventsToShow: (resourceId: string | number) => TimelineEvent[];
    visibleEventsByResource: import('vue').ComputedRef<Map<string | number, TimelineEvent<any>[]>>;
    activeDragEventId: Ref<string | number | null, string | number | null>;
    getLaneFor: (resourceId: string | number, eventId: string | number) => LaneInfo | undefined;
    minCellMin: import('vue').ComputedRef<number>;
    normalizeEventChanges: typeof normalizeEventChanges;
};
