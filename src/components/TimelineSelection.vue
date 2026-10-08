<template>
  <div class="tl-selection" :style="style"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TimelineSelection } from '../types'
import dayjs from 'dayjs';

const props = defineProps<{
  selection: TimelineSelection
  getX: (d: dayjs.Dayjs) => number
  viewStart: dayjs.Dayjs
}>()

const style = computed(() => ({
  left: `${props.getX(props.selection.start)}px`,
  width: `${Math.max(4, props.getX(props.selection.end) - props.getX(props.selection.start))}px`
}))
</script>

<style scoped>
.tl-selection { position: absolute; top: 5px; height: 28px; background: rgba(59,130,246,0.25); border: 2px dashed #3b82f6; border-radius: 6px; pointer-events: none; z-index: 5; }
</style>