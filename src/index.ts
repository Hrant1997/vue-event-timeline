// Публичный API библиотеки (T-17)
export { default as EventTimeline } from './components/Timeline.vue'

// Типы: все public-типы из types/index.ts
export type {
  TimelineEvent,
  TimelineResource,
  TimelineOptions,
  TimelineSelection,
  TimelineEmits,
  TimelineCreatePayload,
  TimelineUpdatePayload,
  TimelineDeletePayload,
  TimelineSelectPayload,
  TimelineHoverPayload,
  TimelineViewportPayload,
  TimelineEventChanges,
  RulerMark,
} from './types'

// Управление часовым поясом библиотеки (T-12): setLibraryTimezone / getLibraryTimezone
export { setLibraryTimezone, getLibraryTimezone } from './utils/date'

// Работа с датами (T-27): единый пояс библиотеки + конвертация в picker-формат и обратно
// toTimelineDate: value? -> dayjs в поясе таймлайна
// timelineToPickerDate: dayjs -> Date (wall-clock для datetime-local / UI-picker)
// pickerToTimelineDate: Date -> dayjs в поясе таймлайна (обратная операция)
export { toTimelineDate, timelineToPickerDate, pickerToTimelineDate } from './utils/date'

/** T-29: lane-раскладка перекрывающихся событий (публично — для тестов и кастомных слоёв) */
export { computeLaneLayout, laneGeometry } from './utils/laneLayout'
export type { LaneInfo } from './utils/laneLayout'