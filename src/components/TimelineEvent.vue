<template>
  <div class="tl-event container" 
    :style="style" 
    :class="{ readonly: !canEditThis }" 
    @mouseenter="$emit('hover-event', true)" 
    @mouseleave="$emit('hover-event', false)"
    @pointerdown.stop="onPointerDown"
    @click.stop="$emit('click')">
    <div v-if="canResizeThis" class="tl-event-handle left" @pointerdown.stop="onResizeStart('start', $event)"></div>
    <div class="tl-event-body">
      <slot :event="event" :duration="duration">
        <div class="tl-event-title">{{ event.title || formatRange() }}</div>
        <div class="tl-event-dur">{{ duration }}</div>
      </slot>
    </div>
    <div v-if="canResizeThis" class="tl-event-handle right" @pointerdown.stop="onResizeStart('end', $event)"></div>
    <button v-if="canDeleteThis" class="tl-event-delete" @click.stop="$emit('delete')" title="Удалить">×</button>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onBeforeUnmount } from 'vue'
import dayjs from 'dayjs'
import type { TimelineEvent } from '../types'
import { fleetDate } from './fleetDate';

const props = defineProps<{
  event: TimelineEvent
  getX: (d: dayjs.Dayjs) => number
  viewStart: dayjs.Dayjs
  pxPerMin: number
  canEditGlobal: boolean
  canDeleteGlobal: boolean
  canvasWidth: number
  dragShiftPx: number // Компенсация сдвига при автоскролле
}>()

const emit = defineEmits<{
  (e: 'update', changes: Partial<Pick<TimelineEvent, 'start' | 'end'>>): void
  (e: 'save', changes: Partial<Pick<TimelineEvent, 'start' | 'end'>>): void
  (e: 'delete'): void
  (e: 'click'): void
  (e: 'request-autoscroll', payload: { mouseX: number; direction: number; speed: number; eventId: string | number, clear?: boolean }): void
  (e: 'hover-event', arg: boolean): void
}>()

const canEditThis = computed(() => props.canEditGlobal && props.event.canEdit !== false)
const canDeleteThis = computed(() => props.canDeleteGlobal && props.event.canDelete !== false)
const canDragThis = computed(() => canEditThis.value && props.event.canDrag !== false)
const canResizeThis = computed(() => canEditThis.value && props.event.canResize !== false)

const style = computed(() => {
  const left = props.getX(props.event.start)
  const width = Math.max(16, props.getX(props.event.end) - props.getX(props.event.start))
  return {
    left: `${left}px`,
    width: `${width}px`,
    background: props.event.color || 'linear-gradient(135deg, #3b82f6, #2563eb)',
    border: props.event.border || 'none'
  }
})

const duration = computed(() => {
  const m = Math.round((props.event.end.valueOf() - props.event.start.valueOf()) / 60000)
  const h = Math.floor(m / 60), mm = m % 60
  if (h >= 24) return `${Math.floor(h / 24)}д ${h % 24}ч`.trim()
  return h > 0 ? `${h}ч ${mm ? mm + 'м' : ''}`.trim() : `${mm}м`
})

const formatRange = () =>
  dayjs(props.event.start).format('HH:mm') + ' – ' + dayjs(props.event.end).format('HH:mm')

// --- Auto-scroll logic ---
const EDGE_THRESHOLD = 80
const MAX_SPEED = 15

const checkAutoScroll = (mouseX: number) => {
  const canvasEl = document.querySelector('.tl-canvas') as HTMLElement
  if (!canvasEl) return

  const rect = canvasEl.getBoundingClientRect()
  const relX = mouseX - rect.left

  if (relX < EDGE_THRESHOLD) {
    const distance = EDGE_THRESHOLD - relX
    const speed = (distance / EDGE_THRESHOLD) * MAX_SPEED
    emit('request-autoscroll', { mouseX, direction: -1, speed, eventId: props.event.id })
  } else if (relX > rect.width - EDGE_THRESHOLD) {
    const distance = relX - (rect.width - EDGE_THRESHOLD)
    const speed = (distance / EDGE_THRESHOLD) * MAX_SPEED
    emit('request-autoscroll', { mouseX, direction: 1, speed, eventId: props.event.id })
  } else {
    stopAutoScroll()
  }
}

const stopAutoScroll = (clear = false) => {
  emit('request-autoscroll', { mouseX: 0, direction: 0, speed: 0, eventId: props.event.id, clear })
}

// --- Состояние перетаскивания ---
let isDragging = false
let isResizing = false
let resizeSide: 'start' | 'end' | null = null
let startX = 0
let origStart: dayjs.Dayjs | null = null
let origEnd: dayjs.Dayjs | null = null
let lastMouseX = 0

// Главная функция пересчета и отправки update
const applyDrag = () => {
  if ((!isDragging && !isResizing) || !origStart || !origEnd) return

  // dx включает в себя и движение мыши, и сдвиг от автоскролла
  const dx = lastMouseX - startX + props.dragShiftPx
  const dMin = dx / props.pxPerMin
  
  if (isDragging) {
    const changes = {
      // start: fleetDate(origStart.valueOf() + dMin * 60000),
      // end: fleetDate(origEnd.valueOf() + dMin * 60000)
      start: origStart.add(dMin, 'minute'),
      end: origEnd.add(dMin, 'minute')
    }
    emit('update', changes)
    return changes
  } else if (isResizing && resizeSide) {
    const orig = resizeSide === 'start' ? origStart : origEnd
    const newDate = fleetDate(orig.valueOf() + dMin * 60000)
    const changes = {[resizeSide]: newDate}
    emit('update', changes)
    return changes
  }
}

// 🚀 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Следим за изменением dragShiftPx
// Когда автоскролл меняет это значение, мы мгновенно пересчитываем позиции
watch(() => props.dragShiftPx, () => {
  applyDrag()
})

// --- Drag ---
const onPointerDown = (e: PointerEvent) => {
  if (!canDragThis.value) return
  isDragging = true
  startX = e.clientX
  lastMouseX = e.clientX
  origStart = props.event.start
  origEnd = props.event.end
  let changes: any = null;
  const onMove = (ev: PointerEvent) => {
    lastMouseX = ev.clientX
    changes = applyDrag() || null // Вызываем пересчет при движении мыши
    checkAutoScroll(ev.clientX)
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    isDragging = false
    stopAutoScroll(true)
    if (changes) {
      emit('save', changes)
    }
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

// --- Resize ---
const onResizeStart = (side: 'start' | 'end', e: PointerEvent) => {
  e.stopImmediatePropagation() // Предотвращаем срабатывание pointerdown на строке
  if (!canResizeThis.value) return
  
  isResizing = true
  resizeSide = side
  startX = e.clientX
  lastMouseX = e.clientX
  origStart = props.event.start
  origEnd = props.event.end
  let changes: any = null;

  const onMove = (ev: PointerEvent) => {
    lastMouseX = ev.clientX
    changes = applyDrag() // Вызываем пересчет при движении мыши
    checkAutoScroll(ev.clientX)
  }

  const onUp = () => {
    console.log(side, "onUp", changes);
    
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    isResizing = false
    resizeSide = null
    stopAutoScroll(true)
    if (changes) {
      emit('save', changes )
    }
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

onBeforeUnmount(() => {
  stopAutoScroll(true)
})
</script>

<style scoped lang="scss">
/* Стили остаются без изменений */

.container {
  container-type: inline-size;
}
@container (width < 120px) {
  .tl-event-body {
    display: none !important;
  }
}
.tl-event {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  position: absolute;
  top: 5px;
  height: 28px;
  border-radius: 6px;
  cursor: grab;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
  overflow: visible;
  color: #fff;
  user-select: none;
}

.tl-event:hover {
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}

.tl-event.readonly {
  cursor: default;
  opacity: 0.85;
}

.tl-event-body {
  flex: 1;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
}

.tl-event-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tl-event-dur {
  font-size: 11px;
  opacity: 0.85;
  margin-top: 2px;
}

.tl-event-handle {
  width: 8px;
  cursor: col-resize;
  background: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

.tl-event-handle:hover {
  background: rgba(255, 255, 255, 0.5);
}

.tl-event-handle.left {
  border-radius: 6px 0 0 6px;
}

.tl-event-handle.right {
  border-radius: 0 6px 6px 0;
}

.tl-event-delete {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: none;
  z-index: 1000;
}

.tl-event:hover .tl-event-delete {
  display: block;
}
</style>