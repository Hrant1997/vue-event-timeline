<template>
  <div class="tl-tooltip" :style="{ left: tooltip.x + 12 + 'px', top: tooltip.y + 12 + 'px' }">
    <div class="tl-tooltip-date" v-format-date.short.time.hideYear.noTzChange="tooltip.time" />
    <!-- <div class="tl-tooltip-time">
      {{ formatTime(cellStart) }}
    </div> -->
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'

// Props описаны типом; шаблон использует `tooltip` напрямую (макрос defineProps не требует присваивания) — T-15
withDefaults(defineProps<{
  tooltip: { x: number; y: number; time: dayjs.Dayjs; resourceId: string | number | null }
  minCellMinutes?: number
}>(), {
  minCellMinutes: 15 // Дефолтное значение, если не передано
})
</script>

<style scoped>
.tl-tooltip { 
  position: absolute; 
  background: #1f2937; 
  color: #fff; 
  padding: 6px 10px; 
  border-radius: 6px; 
  font-size: 12px; 
  pointer-events: none; 
  z-index: 100; 
  box-shadow: 0 4px 12px rgba(0,0,0,0.2); 
  white-space: nowrap; 
}
.tl-tooltip-date { font-weight: 600; margin-bottom: 2px; }
.tl-tooltip-time { opacity: 0.9; font-size: 11px; }
</style>