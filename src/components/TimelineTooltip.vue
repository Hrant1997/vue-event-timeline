<template>
  <div class="tl-tooltip" :style="{ left: tooltip.x + 12 + 'px', top: tooltip.y + 12 + 'px' }">
    <!-- Собственный формат даты («20 окт. 19:45») вместо внешней директивы v-format-date -->
    <div class="tl-tooltip-date">{{ displayDate }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { TOOLTIP_DATE_FORMAT } from '../utils/date'

// Props описаны типом; шаблон использует `tooltip` напрямую (макрос defineProps не требует присваивания) — T-15
const props = withDefaults(defineProps<{
  tooltip: { x: number; y: number; time: dayjs.Dayjs; resourceId: string | number | null }
  minCellMinutes?: number
  /** Готовая отформатированная строка из родителя (Timeline). */
  formattedDate?: string
  /** Локаль для самостоятельного форматирования (если formattedDate не передан). */
  locale?: string
}>(), {
  minCellMinutes: 15, // Дефолтное значение, если не передано
  formattedDate: undefined,
  locale: undefined
})

/**
 * Fallback-форматирование: если родитель не передал готовую строку,
 * форматируем сами через день локалей dayjs ('D MMM HH:mm' → «20 окт. 19:45»).
 * Для ru-локали нужен импорт 'dayjs/locale/ru' (его выполняет Timeline / потребитель).
 */
const displayDate = computed(() => {
  if (props.formattedDate) return props.formattedDate
  const loc = props.locale ?? 'en'
  return props.tooltip.time.locale(loc).format(TOOLTIP_DATE_FORMAT)
})
</script>

<style scoped>
.tl-tooltip {
  position: absolute;
  background: var(--tl-tooltip-bg, #1f2937);
  color: var(--tl-tooltip-text, #fff);
  padding: 6px 10px;
  border-radius: var(--tl-tooltip-radius, 8px);
  font-size: 12px;
  pointer-events: none;
  z-index: 100;
  box-shadow: var(--tl-tooltip-shadow, 0 4px 14px rgba(0, 0, 0, 0.25));
  white-space: nowrap;
  animation: tl-tooltip-in 0.12s ease-out;
}
@keyframes tl-tooltip-in {
  from { opacity: 0; transform: translateY(2px); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .tl-tooltip { animation: none; }
}
.tl-tooltip-date { font-weight: 600; margin-bottom: 2px; }
.tl-tooltip-time { opacity: 0.9; font-size: 11px; }
</style>
