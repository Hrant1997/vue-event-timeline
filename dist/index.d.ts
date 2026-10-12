export { default as EventTimeline } from './components/Timeline.vue';
export type { TimelineEvent, TimelineResource, TimelineOptions, TimelineSelection, TimelineEmits, TimelineCreatePayload, TimelineUpdatePayload, TimelineDeletePayload, TimelineSelectPayload, TimelineHoverPayload, TimelineViewportPayload, TimelineEventChanges, RulerMark, } from './types';
export { setLibraryTimezone, getLibraryTimezone } from './utils/date';
export { toTimelineDate, timelineToPickerDate, pickerToTimelineDate } from './utils/date';
/** Собственный формат даты тултипа («20 окт. 19:45») с локалями dayjs — без внешних директив */
export { TOOLTIP_DATE_FORMAT, normalizeDayjsLocale, useFormattedTooltipDate } from './utils/date';
/** T-29: lane-раскладка перекрывающихся событий (публично — для тестов и кастомных слоёв) */
export { computeLaneLayout, laneGeometry } from './utils/laneLayout';
export type { LaneInfo } from './utils/laneLayout';
