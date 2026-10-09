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