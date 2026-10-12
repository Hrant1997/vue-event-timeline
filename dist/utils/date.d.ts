import { default as dayjs } from 'dayjs';
import { Ref, ComputedRef } from 'vue';

/** Устанавливает часовой пояс библиотеки. null — сброс на локальный пояс. */
export declare function setLibraryTimezone(tz: string | null): void;
export declare function getLibraryTimezone(): string | null;
/**
 * T-26: нормализация changes, пришедших из TimelineEvent (drag/resize),
 * к полному валидному диапазону { start, end } относительно события.
 * Child эмитит сырые изменения (например, только { end }); родитель применяет
 * clamp/overlap centrally и получает финальные даты.
 */
export declare function normalizeEventChanges(ev: {
    start: dayjs.Dayjs;
    end: dayjs.Dayjs;
}, changes: Partial<{
    start: dayjs.Dayjs;
    end: dayjs.Dayjs;
}>): {
    start: dayjs.Dayjs;
    end: dayjs.Dayjs;
};
/**
 * Единая точка входа для дат в библиотеке (T-27).
 * Всегда возвращает dayjs-объект в активном часовом поясе:
 * - без options.timezone — локальный пояс системы;
 * - с options.timezone — указанный IANA-пояс (день/час линейки и событий совпадают).
 */
export declare function toTimelineDate(value?: string | number | Date | dayjs.Dayjs | null): dayjs.Dayjs;
/**
 * Независимый формат даты для тултипа: «20 окт. 19:45» / «20 Oct 19:45».
 * Не зависит от внешних директив (v-format-date) — вся логика внутри библиотеки.
 * Локализация — через dayjs-локали: нужная локаль подгружается лениво,
 * строка реактивно перерендеривается после её загрузки. Fallback — 'en'.
 */
export declare const TOOLTIP_DATE_FORMAT = "D MMM HH:mm";
/** 'ru'/'ru-RU' → 'ru'; неизвестные/пустые → 'en'. */
export declare function normalizeDayjsLocale(locale?: string | null): string;
/**
 * Composable-хелпер: реактивная отформатированная строка для tooltip.
 * value — dayjs.Date (или любой ConfigType), locale — строка локали ('ru', 'en', ...).
 */
export declare function useFormattedTooltipDate(value: Ref<dayjs.ConfigType>, locale: Ref<string | undefined>): ComputedRef<string>;
/**
 * toTimelineDate (dayjs в поясе библиотеки) → Date для нативных UI-виджетов
 * (input[type=datetime-local], Vuetify/Element pickers и т.п.).
 * Wall-clock поля Date соответствуют времени отображения timeline,
 * поэтому picker покажет ровно те же дату/время, что и линейка.
 *
 * Трюк: dayjs.format() возвращает wall-clock строку ПОЯСА БИБЛИОТЕКИ,
 * а new Date(y, m, ...) трактует числа как wall-clock системного пояса.
 * В результате getHours()/getMinutes() и т.д. дают именно то время,
 * которое видно на таймлайне — независимо от пояса системы и браузера.
 */
export declare const timelineToPickerDate: (value: dayjs.Dayjs | null | undefined) => Date | null;
/**
 * Date из picker'а → toTimelineDate (dayjs в поясе библиотеки).
 * Обратная операция к timelineToPickerDate: wall-clock поля входящего Date
 * трактуются как время в активном поясе таймлайна.
 * Принимает также dayjs-значение (защита от случайной передачи не Date).
 */
export declare const pickerToTimelineDate: (value: Date | dayjs.Dayjs | null | undefined) => dayjs.Dayjs | null;
