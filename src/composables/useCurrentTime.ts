import { ref, computed, onBeforeUnmount, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import { toTimelineDate } from '../utils/date'

export interface CurrentTimeApi {
  now: Ref<dayjs.Dayjs>
  currentTimeX: Ref<number | null>
}

/**
 * Тик «текущего времени» + позиция вертикальной линии (вынесено из Timeline.vue — T-06).
 * Интервал создаётся только при включённой опции; корректно снимается при unmount.
 */
export function useCurrentTime(
  viewStart: Ref<dayjs.Dayjs>,
  pxPerMin: Ref<number>,
  enabled: Ref<boolean>,
  tickMs = 60_000,
): CurrentTimeApi {
  const now = ref<dayjs.Dayjs>(toTimelineDate())
  let interval: number | null = null

  const stopTicker = () => {
    if (interval !== null) {
      clearInterval(interval)
      interval = null
    }
  }

  const startTicker = () => {
    stopTicker()
    if (enabled.value) {
      interval = window.setInterval(() => {
        now.value = toTimelineDate()
      }, tickMs)
    }
  }

  watch(enabled, startTicker, { immediate: true })

  const currentTimeX = computed<number | null>(() => {
    if (!enabled.value) return null
    return now.value.diff(viewStart.value, 'minute', true) * pxPerMin.value
  })

  onBeforeUnmount(stopTicker)

  return { now, currentTimeX }
}
