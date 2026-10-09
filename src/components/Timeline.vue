<template>
  <div class="tl-root">
    <!-- HEADER SLOT -->
    <div class="tl-header">
      <slot name="header" :view-start="viewStart" :zoom-level="zoomLevel" />
    </div>

    <!-- RULER -->
    <div class="tl-ruler-wrapper">
      <div class="tl-ruler-spacer" ref="rulerSpacerRef"></div>
      <div class="tl-ruler">
        <div class="tl-ruler-top">
          <div v-for="m in topMarks" :key="'t' + m.time" class="tl-mark" :class="[m.type, { sticky: m.sticky }]"
            :style="{ left: m.x + 'px', width: m.width + 'px' }">
            <div class="tl-mark-label">{{ m.label }}</div>
          </div>
        </div>
        <div class="tl-ruler-bottom">
          <div v-for="m in bottomMarks" :key="'b' + m.time" class="tl-mark tl-mark-bottom"
            :class="[m.type, { sticky: m.sticky }]" :style="{ left: m.x + 'px', width: m.width + 'px' }">
            <div class="tl-mark-label">{{ m.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="tl-body">
      <!-- SIDEBAR -->
      <div class="tl-sidebar" ref="sidebarRef">
        <div v-for="r in resources" :key="r.id" class="tl-sidebar-item"
          :class="{ 'is-hovered': hoveredResourceId === r.id }" @mouseenter="hoveredResourceId = r.id"
          @mouseleave="hoveredResourceId = null">
          <slot name="sidebar-item" :resource="r">{{ r.title }}</slot>
        </div>
        <!-- 🚀 RESIZER HANDLE -->
        <div 
          class="tl-sidebar-resizer" 
          :class="{ 'is-resizing': isResizing }"
          @pointerdown="onResizePointerDown"
        >
          <div class="content">
            <!-- <RaIcon icon="chevron-left" size="sm" />
            <RaIcon icon="chevron-right" size="sm" /> -->
          </div>
        </div>
      </div>

      <div class="loading-wrapper" v-if="loading">
        <slot name="loading">Loading...</slot>
      </div>


      <!-- CANVAS -->
      <div class="tl-canvas-wrapper" ref="canvasWrapperRef">
        <div class="tl-canvas" 
          ref="canvasRef" 
          :style="gridStyle" 
          @wheel="onWheel" 
          @pointerdown="onCanvasPointerDown"
          @pointermove="onCanvasPointerMove"
          @pointerup="onCanvasPointerUp"
          @pointercancel="onCanvasPointerUp"
          @mouseleave="tooltip.visible = false"
        >
          <!-- ЛИНИЯ ТЕКУЩЕГО ВРЕМЕНИ -->
          <div 
            v-if="options.showCurrentTime && currentTimeX !== null && currentTimeX >= -10 && currentTimeX <= containerWidth + 10" 
            class="tl-current-time-line" 
            :style="{ left: currentTimeX + 'px' }"
          >
            <div class="tl-current-time-label">{{ now.format('HH:mm') }}</div>
          </div>

          <!-- Ряды -->
          <div v-for="r in resources" :key="r.id" class="tl-row" :class="{ 'is-hovered': hoveredResourceId === r.id }"
            @pointerdown="onRowPointerDown(r, $event)" 
            @mousemove="onRowMouseMove(r, $event)"
            @mouseleave="onRowMouseLeave">

            <!-- Ивенты -->
            <TimelineEvent v-for="ev in eventsToShow(r.id)" :key="ev.id" :event="ev" :get-x="getX"
              :view-start="viewStart" :px-per-min="pxPerMin" :can-edit-global="options.canEdit !== false"
              :can-delete-global="options.canDelete !== false" :canvas-width="containerWidth"
              :drag-shift-px="activeDragId === ev.id ? currentDragShift : 0" 
              @update="(c) => emitUpdate(ev, c)"
              @save="emit('save', {event: ev, changes: $event })"
              @delete="emit('delete', { event: ev })" @click="emit('select', { event: ev })"
              @request-autoscroll="handleAutoScroll" @hover-event="(val) => isHoveringEvent = val">
              <template #default="slotProps">
                <slot name="event" v-bind="slotProps" />
              </template>
            </TimelineEvent>

            <!-- Выделение для создания -->
            <TimelineSelection v-if="selection?.resourceId === r.id" :selection="selection" :get-x="getX"
              :view-start="viewStart" />

            <!-- ПОДСВЕТКА ЯЧЕЙКИ С ПЛЮСОМ -->
            <div v-if="hoveredCell && hoveredResourceId === r.id && !isHoveringEvent" class="cell-hover-highlight"
              :style="{ left: hoveredCell.x + 'px', width: hoveredCell.width + 'px' }">
              <span class="plus-icon">+</span>
            </div>
          </div>

          <!-- Tooltip -->
          <TimelineTooltip v-if="tooltip.visible" :tooltip="tooltip" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T = any">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { useTimeline } from './useTimeline';
import { useRulerMarks, RULER_THRESHOLDS } from '../composables/useRulerMarks';
import { useSidebarResize } from '../composables/useSidebarResize';
import { useCurrentTime } from '../composables/useCurrentTime';
import TimelineEvent from './TimelineEvent.vue'
import TimelineTooltip from './TimelineTooltip.vue'
import TimelineSelection from './TimelineSelection.vue'
import type {
  TimelineEvent as TEvent, TimelineResource, TimelineOptions,
  TimelineSelection as TSType, TimelineEmits
} from '../types'
import { fleetDate } from './fleetDate';

const props = withDefaults(defineProps<{
  events: TEvent<T>[]
  resources: TimelineResource[]
  options?: TimelineOptions
  loading: boolean
}>(), {
  options: () => ({ allowOverlap: false, minCellMinutes: 15, canCreate: true, showCurrentTime: true })
})

const emit = defineEmits<TimelineEmits>()

const eventsRef = computed(() => props.events)
const resourcesRef = computed(() => props.resources)
const optionsRef = computed(() => props.options)

const {
  viewStart, viewEnd, pxPerMin, zoomLevel, snap, addMin, diffMin,
  hasOverlap, clampToBounds, clampDuration, zoom, getX, getDateFromX, containerWidth,
  eventsToShow, minCellMin
} = useTimeline(eventsRef, resourcesRef, optionsRef)

const canvasRef = ref<HTMLElement | null>(null)
const canvasWrapperRef = ref<HTMLElement | null>(null)
const options = computed(() => props.options)

// Ресайз сайдбара — логика вынесена в composables/useSidebarResize.ts (T-06)
const { sidebarWidth, isResizing, sidebarRef, rulerSpacerRef, applySavedWidth, onResizePointerDown } =
  useSidebarResize()

// --- Tooltip ---
const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  time: fleetDate(),
  resourceId: null as string | number | null
})

// --- Selection ---
const selection = ref<TSType | null>(null)

let selStartTime: dayjs.Dayjs | null = null
let selResourceId: string | number | null = null
let isSelecting = false
let selectAutoScrollRAF: number | null = null
let autoScrollRAF: number | null = null
let selectScrollDirection = 0
let scrollDirection = 0
let selectScrollSpeed = 0
let scrollSpeed = 0

const activeDragId = ref<string | number | null>(null)
const currentDragShift = ref(0)

const hoveredResourceId = ref<string | number | null>(null)
const hoveredCellTime = ref<{ absoluteStartMs: number; widthMins: number } | null>(null)
const isHoveringEvent = ref(false)

const hoveredCell = computed(() => {
  if (!hoveredCellTime.value) return null
  const { absoluteStartMs, widthMins } = hoveredCellTime.value
  const minsFromViewStart = (absoluteStartMs - viewStart.value.valueOf()) / 60000
  const x = minsFromViewStart * pxPerMin.value
  const width = widthMins * pxPerMin.value + 1
  return { x, width }
})

const onRowMouseMove = (r: TimelineResource, e: MouseEvent) => {
  if (isSelecting || activeDragId.value || isHoveringEvent.value) {
    hoveredCellTime.value = null
    return
  }
  if (!(e.target instanceof Element)) return
  const rect = e.target.closest('.tl-row')?.getBoundingClientRect()
  if (!rect) return
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  if (y >= 0 && y <= 40) {
    hoveredResourceId.value = r.id
    const step = minCellMin.value
    const viewStartMins = Math.floor(viewStart.value.valueOf() / 60000)
    const mouseOffsetMins = x / pxPerMin.value
    const absoluteMins = viewStartMins + mouseOffsetMins
    const snappedAbsoluteMins = Math.floor(absoluteMins / step) * step

    hoveredCellTime.value = {
      absoluteStartMs: snappedAbsoluteMins * 60000,
      widthMins: step
    }
  } else {
    hoveredResourceId.value = null
    hoveredCellTime.value = null
  }
}

const onRowMouseLeave = () => {
  hoveredResourceId.value = null
  hoveredCellTime.value = null
  isHoveringEvent.value = false
}

// Линия текущего времени — логика в composables/useCurrentTime.ts (T-06)
const { now, currentTimeX } = useCurrentTime(viewStart, pxPerMin, computed(() => !!options.value.showCurrentTime))

onMounted(() => {
  applySavedWidth()
  if (canvasWrapperRef.value) {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerWidth.value = entry.contentRect.width
      }
    })
    observer.observe(canvasWrapperRef.value)
  }

  emit('changeViewport', { start: viewStart.value.clone(), end: viewEnd.value.clone() })
})

onBeforeUnmount(() => {
  stopAutoScroll()
  stopSelectAutoScroll()
}) // cleanup интервалов/слушателей — внутри useCurrentTime и useSidebarResize

// Линейки: единая дедуплицированная логика в composables/useRulerMarks.ts (T-06, T-07)
const { topMarks, bottomMarks } = useRulerMarks(viewStart, pxPerMin, containerWidth)

const gridStyle = computed(() => {
  if (!props.options.showGrid) return {}
  const px = pxPerMin.value * 60
  // Пороги сетки совпадают с порогами линеек (единый источник — RULER_THRESHOLDS)
  let step = 1440
  if (px >= RULER_THRESHOLDS.minute) step = 15
  else if (px >= RULER_THRESHOLDS.hour) step = 60
  else if (px >= RULER_THRESHOLDS.day) step = 360

  const pxStep = step * pxPerMin.value
  const dj = dayjs(viewStart.value)
  const totalMinutes = dj.valueOf() / 60000 + dj.utcOffset()
  const offsetMinutes = totalMinutes % step
  const rawOffsetPx = -(offsetMinutes * pxPerMin.value)
  const cleanPxStep = Math.round(pxStep * 100) / 100
  const cleanOffset = Math.round(rawOffsetPx * 100) / 100
  const lineWidth = cleanPxStep < 1 ? cleanPxStep : 1

  return {
    backgroundImage: `linear-gradient(90deg, var(--border-color) 0 ${lineWidth}px, transparent ${lineWidth}px 100%)`,
    backgroundSize: `${cleanPxStep}px 100%`,
    backgroundPosition: `${cleanOffset}px 0`,
    backgroundRepeat: 'repeat-x',
    willChange: 'background-position',
  }
})

const startAutoScroll = (dir: number, speed: number, eventId: string | number) => {
  if (scrollDirection !== 0 && scrollDirection !== dir) return
  scrollDirection = dir
  scrollSpeed = speed
  activeDragId.value = eventId

  if (!autoScrollRAF) {
    const tick = () => {
      if (scrollDirection === 0) {
        autoScrollRAF = null
        return
      }
      const pxShift = scrollSpeed * scrollDirection
      currentDragShift.value += pxShift
      const minsDelta = pxShift / pxPerMin.value
      viewStart.value = addMin(viewStart.value, minsDelta)
      autoScrollRAF = requestAnimationFrame(tick)
    }
    autoScrollRAF = requestAnimationFrame(tick)
  }
}

const stopAutoScroll = (clear = false) => {
  scrollDirection = 0
  scrollSpeed = 0
  if (clear) {
    activeDragId.value = null
    currentDragShift.value = 0
  }
  if (autoScrollRAF) {
    cancelAnimationFrame(autoScrollRAF)
    autoScrollRAF = null
  }
}

const handleAutoScroll = (payload: { mouseX: number; direction: number; speed: number; eventId: string | number, clear?: boolean }) => {
  if (payload.direction === 0) {
    stopAutoScroll(payload.clear)
  } else {
    startAutoScroll(payload.direction, payload.speed, payload.eventId)
  }
}

const onWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const rect = canvasRef.value?.getBoundingClientRect()
    zoom(e.deltaY, rect ? e.clientX - rect.left : undefined)
  } else if (e.shiftKey) {
    e.preventDefault()
    const minsDelta = e.deltaY / pxPerMin.value
    viewStart.value = addMin(viewStart.value, minsDelta)
  }
}

// Pinch & Pan для тачскринов
const activePointers = new Map<number, PointerEvent>()
let lastPinchDistance = 0
let lastPinchCenterX = 0

watch(() => [viewStart.value, viewEnd.value], ([newStart, newEnd], [oldStart, oldEnd]) => {
  if (oldStart.valueOf() === newStart.valueOf() && oldEnd.valueOf() === newEnd.valueOf()) {
    return 
  }
  emit('changeViewport', { start: newStart.clone(), end: newEnd.clone() })
})

const onCanvasPointerDown = (e: PointerEvent) => {
  activePointers.set(e.pointerId, e)
  
  if (activePointers.size >= 2) {
    // 🔥 Мультитач обнаружен! Принудительно отменяем любое активное выделение
    isSelecting = false
    selection.value = null
    
    const pointers = Array.from(activePointers.values())
    lastPinchDistance = Math.hypot(
      pointers[0].clientX - pointers[1].clientX,
      pointers[0].clientY - pointers[1].clientY
    )
    lastPinchCenterX = (pointers[0].clientX + pointers[1].clientX) / 2
  } else if (activePointers.size === 1 && e.pointerType === 'touch' && !isSelecting && !activeDragId.value) {
    showTooltip(e)
  }
}

const onCanvasPointerMove = (e: PointerEvent) => {
  activePointers.set(e.pointerId, e)
  
  if (activePointers.size === 2) {
    e.preventDefault() // 🔥 Блокируем любые нативные жесты браузера
    
    const pointers = Array.from(activePointers.values())
    const distance = Math.hypot(
      pointers[0].clientX - pointers[1].clientX,
      pointers[0].clientY - pointers[1].clientY
    )
    const centerX = (pointers[0].clientX + pointers[1].clientX) / 2
    
    // Zoom
    const deltaDistance = distance - lastPinchDistance
    if (Math.abs(deltaDistance) > 1) {
      const rect = canvasRef.value?.getBoundingClientRect()
      const zoomX = rect ? centerX - rect.left : undefined
      zoom(-deltaDistance * 3, zoomX)
      lastPinchDistance = distance
    }
    
    // Pan
    const deltaCenterX = centerX - lastPinchCenterX
    if (Math.abs(deltaCenterX) > 1) {
      const minsDelta = -deltaCenterX / pxPerMin.value
      viewStart.value = addMin(viewStart.value, minsDelta)
      lastPinchCenterX = centerX
    }
  } else if (activePointers.size === 1 && !isSelecting && !activeDragId.value) {
    showTooltip(e)
  }
}

const onCanvasPointerUp = (e: PointerEvent) => {
  activePointers.delete(e.pointerId)
  if (activePointers.size === 0 && e.pointerType === 'touch') {
    // Скрываем tooltip через 2 секунды после отпускания
    setTimeout(() => {
      if (activePointers.size === 0) {
        tooltip.visible = false
      }
    }, 2000)
  }
}

const showTooltip = (e: PointerEvent) => {
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const time = getDateFromX(x)
  
  const rowIndex = Math.floor(y / 40)
  const resource = props.resources[rowIndex] ?? null
  const stepMs = minCellMin.value * 60 * 1000

  tooltip.visible = true
  tooltip.x = x
  tooltip.y = y
  tooltip.time = fleetDate(Math.floor(time.valueOf() / stepMs) * stepMs)
  tooltip.resourceId = resource?.id ?? null

  emit('hover', { time, resourceId: resource?.id ?? null })
}

const startSelectAutoScroll = (dir: number, speed: number) => {
  if (selectScrollDirection !== 0 && selectScrollDirection !== dir) {
    stopSelectAutoScroll()
  }
  
  selectScrollDirection = dir
  selectScrollSpeed = speed

  if (!selectAutoScrollRAF) {
    const tick = () => {
      if (selectScrollDirection === 0 || !isSelecting || !selStartTime) {
        selectAutoScrollRAF = null
        return
      }

      const pxShift = selectScrollSpeed * selectScrollDirection
      const minsDelta = pxShift / pxPerMin.value
      viewStart.value = addMin(viewStart.value, minsDelta)

      // 🔥 Обновляем selection при скролле
      if (selection.value) {
        const currentStartX = getX(selStartTime!)
        const rect = canvasRef.value?.getBoundingClientRect()
        if (rect) {
          // Используем последнюю известную позицию курсора (примерно)
          const lastX = selectScrollDirection > 0 ? rect.width - 20 : 20
          const s = snap(getDateFromX(Math.min(currentStartX, lastX)))
          const en = snap(getDateFromX(Math.max(currentStartX, lastX)))
          const finalEnd = diffMin(en, s) < minCellMin.value ? addMin(s, minCellMin.value) : en
          selection.value = { resourceId: selResourceId!, start: s, end: finalEnd }
        }
      }

      selectAutoScrollRAF = requestAnimationFrame(tick)
    }
    selectAutoScrollRAF = requestAnimationFrame(tick)
  }
}

const stopSelectAutoScroll = () => {
  selectScrollDirection = 0
  selectScrollSpeed = 0
  if (selectAutoScrollRAF) {
    cancelAnimationFrame(selectAutoScrollRAF)
    selectAutoScrollRAF = null
  }
}

const onRowPointerDown = (r: TimelineResource, e: PointerEvent) => {
  if (options.value.canCreate === false) return
  if ((e.target as HTMLElement).closest('.tl-event')) return

  activePointers.set(e.pointerId, e)

  if (e.pointerType === 'touch' && activePointers.size > 1) {
    return
  }

  const rect = canvasRef.value!.getBoundingClientRect()
  
  // 🔥 Храним время начала, а не координату X
  selStartTime = snap(getDateFromX(e.clientX - rect.left))
  selResourceId = r.id
  isSelecting = true
  
  selection.value = { 
    resourceId: r.id, 
    start: selStartTime!, 
    end: addMin(selStartTime, minCellMin.value) 
  }

  const onMove = (ev: PointerEvent) => {
    if (!isSelecting || activePointers.size >= 2) {
      isSelecting = false
      selection.value = null
      stopSelectAutoScroll()
      return
    }

    const x = ev.clientX - rect.left
    
    // 🔥 Проверка границ для автоскролла
    const scrollThreshold = 50
    const scrollSpeed = 10
    
    if (x < scrollThreshold) {
      startSelectAutoScroll(-1, scrollSpeed * (1 - x / scrollThreshold))
    } else if (x > rect.width - scrollThreshold) {
      startSelectAutoScroll(1, scrollSpeed * (1 - (rect.width - x) / scrollThreshold))
    } else {
      stopSelectAutoScroll()
    }

    // 🔥 Вычисляем текущую координату начала из времени (учитывает скролл)
    const currentStartX = getX(selStartTime!)
    const s = snap(getDateFromX(Math.min(currentStartX, x)))
    const en = snap(getDateFromX(Math.max(currentStartX, x)))
    const finalEnd = diffMin(en, s) < minCellMin.value ? addMin(s, minCellMin.value) : en
    selection.value = { resourceId: r.id, start: s, end: finalEnd }
    showTooltip(ev)
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    
    activePointers.delete(e.pointerId)
    stopSelectAutoScroll()

    if (selection.value && isSelecting) {
      const bounds = clampToBounds(selection.value.start, selection.value.end)
      const { start, end } = clampDuration(bounds.start, bounds.end)
      if (!hasOverlap(r.id, start, end)) {
        emit('create', { event: { start, end, resourceId: r.id } })
      }
    }
    selection.value = null
    isSelecting = false
    selStartTime = null
  }

  window.addEventListener('pointermove', onMove, { passive: false })
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

const emitUpdate = (ev: TEvent, changes: Partial<Pick<TEvent, 'start' | 'end'>>) => {
  if (ev.canEdit === false || options.value.canEdit === false) return
  let { start, end } = { ...ev, ...changes }
  const bounds = clampToBounds(start, end)
  const clamped = clampDuration(bounds.start, bounds.end)
  start = clamped.start; end = clamped.end
  if (hasOverlap(ev.resourceId, start, end, ev.id)) return
  emit('update', { event: ev, changes: { start, end } })
}
</script>

<style scoped lang="scss">
.tl-root {
  --border-color: #5656563a;
  --hover-sidebar-bg: #e5e7eb;
  --hover-cell-bg: #b1c3e7ee;
  --hover-row-bg: #a1aebb51;
  --plus-icon-color: #3770cd;
  --plus-border-color: #93c5fd;
}

:root[data-theme='dark'] .tl-root {
  // --border-color: #676767;
  --hover-sidebar-bg: #37415174;
  --hover-cell-bg: #4d6d9991;
  --hover-row-bg: #3e526e91;
  --plus-icon-color: #60a5fa;
  --plus-border-color: #3b82f6;
}

.tl-sidebar-item { 
  height: 40px; 
  border-bottom: 1px solid var(--border-color); 
  display: flex; 
  align-items: center; 
  padding: 0 12px; 
  font-weight: 500; 
  color: var(--ra-text);
  transition: background-color 0.1s ease;
  
  &.is-hovered {
    background-color: var(--hover-sidebar-bg);
  }
}

.tl-row { 
  height: 40px; 
  border-bottom: 1px solid var(--border-color); 
  position: relative; 
  z-index: 1; 
  cursor: crosshair;
  transition: background-color 0.1s ease;
  touch-action: pan-y;
  &.is-hovered {
    background-color: var(--hover-row-bg);
  }
}

.cell-hover-highlight {
  position: absolute;
  top: 0;
  bottom: 0;
  background-color: var(--hover-cell-bg);
  border-left: 1px dashed var(--plus-border-color);
  border-right: 1px dashed var(--plus-border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none; 
  z-index: 2;
  transition: background-color 0.1s ease;
}

.plus-icon {
  font-size: 22px;
  color: var(--plus-icon-color);
  font-weight: 600;
  line-height: 1;
  opacity: 0.9;
  margin-top: -1px;
}

.tl-root {
  display: flex;
  flex-direction: column;
  // height: calc(100dvh - 112px);
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-family: -apple-system, Segoe UI, sans-serif;
}

.tl-ruler-wrapper {
  display: flex;
  border-bottom: 2px solid var(--border-color);
  background: var(--ra-aside-bg);
  box-shadow: 0 5px 30px 1px rgba(0, 0, 0, 0.12);
}

.tl-ruler-spacer {
  flex-shrink: 0;
  border-right: 2px solid var(--border-color);
  /* 🚀 УБРАНА transition для width, чтобы ресайз был мгновенным */
}

.tl-ruler {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tl-ruler-top {
  height: 22px;
  position: relative;
  border-bottom: 1px solid var(--border-color);
}

.tl-ruler-bottom {
  height: 32px;
  position: relative;

  .tl-mark-bottom {
    &.day {
      align-items: center;
    }
  }
}

.tl-mark {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  overflow: hidden;
}

.tl-mark-label {
  padding: 4px 6px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tl-mark-bottom {
  .tl-mark-label { 
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
}

.tl-mark {
  &.hour, &.minute, &.month {
    border-left: 1px solid var(--border-color);
  }
}

.tl-mark.month .tl-mark-label {
  font-weight: 700;
  color: var(--ra-text);
  font-size: 13px;
}
.tl-mark.year .tl-mark-label {
  font-weight: 700;
  color: var(--ra-text);
  font-size: 13px;
}

.tl-mark.day {
  border-left: 1px solid var(--border-color);
}

.tl-mark.day .tl-mark-label {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 12px;
}

.tl-mark.sticky {
  z-index: 10;
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
  border-left: none;
}

.tl-mark-bottom .tl-mark-line {
  background: #9ca3af;
}

.tl-mark-bottom .tl-mark-label {
  font-size: 10px;
}

.tl-body {
  display: flex;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.tl-sidebar {
  flex-shrink: 0;
  // border-right: 1px solid var(--border-color);
  height: max-content;
  z-index: 1;
  background: var(--ra-aside-bg);
  position: relative;
  box-shadow: 5px 0px 30px 1px rgba(0, 0, 0, 0.12);
  /* 🚀 УБРАНА transition для width, чтобы ресайз был мгновенным */
}

// 🚀 СТИЛИ РЕСАЙЗЕРА
.tl-sidebar-resizer {
  width: 6px; /* Чуть шире для удобства захвата */
  flex-shrink: 0;
  cursor: col-resize;
  background: transparent;
  z-index: 10;
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  top: 0;
  right: -2px;
  touch-action: none; /* 🔥 Ключевое свойство для тачскринов */

  .content {
    opacity: 0;
    display: flex;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--plus-icon-color);
    transition: opacity 0.2s ease-in-out;
    span {
      width: 10px;
    }
  }

  &:hover, &.is-resizing {
    background: rgba(55, 112, 205, 0.1);
    .content {
      opacity: 1;
    }
  }

  // Визуальная полоска по центру ресайзера
  &::after {
    content: '';
    position: absolute;
    // top: 10%;
    // bottom: 10%;
    height: 100%;
    width: 2px;
    background: var(--border-color);
    border-radius: 2px;
    transition: background 0.2s, transform 0.2s;
  }

  &:hover::after, &.is-resizing::after {
    background: var(--plus-icon-color);
    transform: scaleX(1.5);
  }
}

.tl-canvas-wrapper {
  flex: 1;
  position: relative;
  height: min-content;
}

.tl-canvas { 
  position: relative; 
  min-height: 100%; 
  will-change: background-position; 
  transform: translateZ(0);
  touch-action: pan-y; /* Разрешаем вертикальный скролл, запрещаем pinch-zoom страницы */
}

.tl-current-time-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: #ef4444;
  z-index: 15;
  pointer-events: none;
  
  .tl-current-time-label {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    background-color: #ef4444;
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 0 0 4px 4px;
    white-space: nowrap;
    font-weight: 600;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
}

.loading-wrapper {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>