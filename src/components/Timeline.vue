<template>
  <div class="tl-root" :style="{ '--tl-row-height': rowHeight + 'px' }">
    <!-- HEADER SLOT -->
    <div class="tl-header">
      <slot name="header" :view-start="viewStart" :zoom-level="zoomLevel" />
    </div>

    <!-- RULER -->
    <div class="tl-ruler-wrapper">
      <div class="tl-ruler-spacer" ref="rulerSpacerRef"></div>
      <div class="tl-ruler">
        <div class="tl-ruler-top">
          <div
v-for="m in topMarks" :key="'t' + m.time" class="tl-mark" :class="[m.type, { sticky: m.sticky }]"
            :style="{ left: m.x + 'px', width: m.width + 'px' }"
>
            <div class="tl-mark-label">{{ m.label }}</div>
          </div>
        </div>
        <div class="tl-ruler-bottom">
          <div
            v-for="m in bottomMarks" :key="'b' + m.time" class="tl-mark tl-mark-bottom"
            :class="[m.type, { sticky: m.sticky, 'is-today': m.type === 'day' && isTodayMark(m) }]" :style="{ left: m.x + 'px', width: m.width + 'px' }"
>
            <div class="tl-mark-label">{{ m.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- MOBILE ZOOM: компактные touch-кнопки (− / сегодня / +). Показываются
         только на тач-устройствах (@media hover:none) — десктопная раскладка
         и шапка-слот не меняются. Зум использует существующий zoom() с
         якорем по центру viewport; «сегодня» возвращает начало таймлайна. -->
    <div class="tl-mobile-zoom" aria-label="Timeline zoom controls">
      <button type="button" class="tl-mz-btn" :disabled="!canZoomOut" @click.stop="zoomBy(-1)" aria-label="Zoom out">−</button>
      <span class="tl-mz-level">{{ zoomLevel }}</span>
      <button type="button" class="tl-mz-btn" :disabled="!canZoomIn" @click.stop="zoomBy(1)" aria-label="Zoom in">+</button>
      <button type="button" class="tl-mz-btn tl-mz-today" @click.stop="goToday" aria-label="Jump to today">•</button>
    </div>

    <div class="tl-body">
      <!-- SIDEBAR -->
      <div class="tl-sidebar" ref="sidebarRef">
        <div
v-for="(r, ri) in resources" :key="r.id" class="tl-sidebar-item"
          :style="sidebarItemStyle(ri)"
          :class="{ 'is-hovered': hoveredResourceId === r.id }" @mouseenter="hoveredResourceId = r.id"
          @mouseleave="hoveredResourceId = null"
>
          <slot name="sidebar-item" :resource="r">{{ r.title }}</slot>
        </div>
        <!-- 🚀 RESIZER HANDLE -->
        <div 
          class="tl-sidebar-resizer" 
          :class="{ 'is-resizing': isResizing }"
          @pointerdown="onResizePointerDown"
        >
          <div class="content">
          </div>
        </div>
      </div>

      <div class="loading-wrapper" v-if="loading">
        <slot name="loading">Loading...</slot>
      </div>


      <!-- CANVAS -->
      <div class="tl-canvas-wrapper" ref="canvasWrapperRef">
        <div
class="tl-canvas" 
          ref="canvasRef" 
          :style="gridStyle" 
          @wheel="onWheel" 
          @pointerdown="onCanvasPointerDown"
          @pointermove="onCanvasPointerMove"
          @pointerup="onCanvasPointerUp"
          @pointercancel="onCanvasPointerCancel"
          @click="onCanvasClick"
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
          <div
v-for="(r, ri) in resources" :key="r.id" class="tl-row" :style="rowStyle(ri)" :class="{ 'is-hovered': hoveredResourceId === r.id, 'is-weekend': showWeekendHighlight }"
            @pointerdown="onRowPointerDown(r, $event)" 
            @mousemove="onRowMouseMove(r, $event)"
            @mouseleave="onRowMouseLeave"
>
<!-- Ивенты -->
            <TimelineEvent
v-for="ev in eventsToShow(r.id)" :key="ev.id" :event="ev"
              :view-start="viewStart" :px-per-min="pxPerMin" :can-edit-global="options.canEdit !== false"
              :can-delete-global="options.canDelete !== false" :canvas-width="containerWidth"
              :drag-shift-px="activeDragId === ev.id ? currentDragShift : 0"
              :delete-title="deleteTitle"
              :row-height="rowHeight"
              :lane-style="eventStyle[ev.id]"
              :can-move-to="(s: dayjs.Dayjs, e: dayjs.Dayjs) => canMoveEventTo(ev, s, e)"
              :normalize-position="normalizeEventPosition"
              :snap-minutes="minCellMin"
              :is-selected="selectedEventId === ev.id"
              :show-touch-handles="options.showTouchHandles !== false"
              :touch-drag-commit-px="options.touchDragCommitPx ?? 8"
              @update="(c) => emitUpdate(ev, c)"
              @save="(c) => emitSave(ev, c)"
              @drag-state="onDragState"
              @select-request="onEventSelectRequest(ev)"
              @delete="onEventDelete(ev)" @click="emit('select', { event: ev })"
              @request-autoscroll="handleAutoScroll" @hover-event="(val) => isHoveringEvent = val"
>
              <template #default="slotProps">
                <slot name="event" v-bind="slotProps" />
              </template>
            </TimelineEvent>

            <!-- Выделение для создания -->
            <TimelineSelection
v-if="selection?.resourceId === r.id" :selection="selection" :get-x="getX"
              :view-start="viewStart"
/>

            <!-- ПОДСВЕТКА ЯЧЕЙКИ С ПЛЮСОМ -->
            <div
v-if="hoveredCell && hoveredResourceId === r.id && !isHoveringEvent" class="cell-hover-highlight"
              :style="{ left: hoveredCell.x + 'px', width: hoveredCell.width + 'px' }"
>
              <span class="plus-icon">+</span>
            </div>
          </div>

          <!-- Tooltip -->
          <TimelineTooltip v-if="tooltip.visible" :tooltip="tooltip" :formatted-date="tooltipDate" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T = any">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import dayjs from 'dayjs'
import { useTimeline } from './useTimeline';
import { useRulerMarks, minStepForPx } from '../composables/useRulerMarks';
import { useSidebarResize } from '../composables/useSidebarResize';
import { useCurrentTime } from '../composables/useCurrentTime';
import TimelineEvent from './TimelineEvent.vue'
import TimelineTooltip from './TimelineTooltip.vue'
import TimelineSelection from './TimelineSelection.vue'
import type {
  TimelineEvent as TEvent, TimelineResource, TimelineOptions,
  TimelineSelection as TSType, TimelineEmits, TimelineEventChanges
} from '../types'
import { toTimelineDate, normalizeEventChanges, useFormattedTooltipDate } from '../utils/date';
import {
  LONG_PRESS_MS, MOVE_THRESHOLD_PX,
  isTouchPointer, movedBeyond, isLikelyTouchDuplicate,
} from '../utils/touch'

const props = withDefaults(defineProps<{
  events: TEvent<T>[]
  resources: TimelineResource[]
  options?: TimelineOptions
  /** T-19: опциональный prop с дефолтом false (README-пример его не передаёт) */
  loading?: boolean
  /** Высота строки ресурса в px (T-10): используется и в CSS, и в hit-testing */
  rowHeight?: number
  /** T-20: локаль dayjs для названий дней/месяцев; default — язык браузера или 'en' */
  locale?: string
  /** T-20: title кнопки удаления на событиях (default 'Delete') */
  deleteTitle?: string
}>(), {
  options: () => ({ allowOverlap: false, minCellMinutes: 15, canCreate: true, showCurrentTime: true }),
  loading: false,
  rowHeight: 40,
  locale: undefined,
  deleteTitle: 'Delete'
})

// T-20: эффективная локаль — из prop, иначе options.locale, иначе язык браузера, иначе 'en'
const effectiveLocale = computed(() => {
  const l = props.locale ?? (props.options as { locale?: string })?.locale
  if (l) return l
  return typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en'
})
// T-20: ru-локаль подгружается лениво, только когда реально запрошена
// (в дефолтном бандле dayjs/locale/ru не висит мёртвым кодом).
let ruLocaleLoaded = false
watch(effectiveLocale, async (l) => {
  if (l.startsWith('ru') && !ruLocaleLoaded) {
    await import('dayjs/locale/ru')
    ruLocaleLoaded = true
  }
}, { immediate: true })

const emit = defineEmits<TimelineEmits>()

const eventsRef = computed(() => props.events)
const resourcesRef = computed(() => props.resources)
const optionsRef = computed(() => props.options)

const {
  viewStart, viewEnd, pxPerMin, zoomLevel, snap, addMin, diffMin,
  hasOverlap, canOverlapWith, clampToBounds, clampDuration, zoom, getX, getDateFromX, containerWidth,
  eventsToShow, minCellMin, getLaneFor, activeDragEventId
} = useTimeline(eventsRef, resourcesRef, optionsRef)

// T-29 fix: строка растягивается под все дорожки. laneGeometry при minLaneHeight=16
// возвращает блок дороже rowHeight (переполнение); считаем смещение каждого слоя
// относительно ВЕРХА строки — тогда и координаты событий, и высота .tl-row согласованы.
const ROW_PAD = 4 // по 2px сверху/снизу строки (суммарно ≈ прежние 12px запаса для одиночного слоя)

const laneLayer = (lane: number, lanes: number) => {
  const rh = props.rowHeight
  // T-29 fix: минимальная высота слоя 16px; если слои не влезают в rowHeight —
  // блок НИЖЕ строки, и rowNeedHeight растянет .tl-row под него (без переполнения).
  const laneH = Math.max(16, Math.floor((rh - ROW_PAD) / lanes))
  const blockH = lanes * laneH
  const offset = Math.max(2, Math.floor((rh - blockH) / 2))
  return { top: offset + lane * laneH, height: laneH, blockBottom: offset + blockH }
}

/** Максимальное число дорожек в строке ресурса (T-29) */
const maxLanesFor = (resourceId: string | number): number => {
  let m = 1
  for (const ev of eventsToShow(resourceId)) {
    const info = getLaneFor(resourceId, ev.id)
    if (info && info.lanes > m) m = info.lanes
  }
  return m
}

/** Требуемая высота строки i: rowHeight, либо больше — если дорожки переполняют её */
const rowNeedHeight = (i: number): number => {
  const r = props.resources[i]
  if (!r) return props.rowHeight
  const lanes = maxLanesFor(r.id)
  if (lanes <= 1) return props.rowHeight 
  const needed = laneLayer(0, lanes).blockBottom + 4 // нижний падстроки
  
  return Math.max(props.rowHeight, needed)
}

// РЕГРЕССИЯ (rowHeight): раньше при lanes<=1 возвращался undefined и строка
// жила только на CSS var(--tl-row-height). В живом браузере это ломалось при
// изменении rowHeight: Vue патчит style-атрибут по ключам, и для строк без
// inline-высоты атрибут мог остаться stale (строка не менялась, хотя высота
// ивентов пересчитывалась), а переполненные строки хранили закешированный в
// inline-стиле пиксельный размер. Теперь высота строки всегда идёт из одного
// источника — computed rowNeedHeight — и гарантированно реактивна на props.
const rowStyle = (i: number) => ({ height: `${rowNeedHeight(i)}px` })

const sidebarItemStyle = (i: number) => ({ height: `${rowNeedHeight(i)}px` })

const eventStyle = computed(() => {
  const m: Record<string | number, { top: string; height: string }> = {}
  for (const r of props.resources) {
    for (const ev of eventsToShow(r.id)) {
      const info = getLaneFor(r.id, ev.id)
      if (info) {
        const g = laneLayer(info.lane, info.lanes)
        m[ev.id] = { top: `${g.top}px`, height: `${g.height}px` }
      }
    }
  }
  return m
})

const canvasRef = ref<HTMLElement | null>(null)
const canvasWrapperRef = ref<HTMLElement | null>(null)
const options = computed(() => props.options)

// Ресайз сайдбара — логика вынесена в composables/useSidebarResize.ts (T-06)
// T-24: localStorage по умолчанию НЕ используется (persistKey не передаём)
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- sidebarWidth/isResizing возвращены API комposable; ширина применяется через setWidth внутри useSidebarResize (T-06)
const { sidebarWidth, isResizing, sidebarRef, rulerSpacerRef, applySavedWidth, onResizePointerDown } =
  useSidebarResize()

// --- Tooltip ---
const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  time: toTimelineDate(),
  resourceId: null as string | number | null
})

// Собственный формат даты тултипа («20 окт. 19:45») с поддержкой локалей dayjs —
// вместо внешней директивы v-format-date. Локаль наследуется от effectiveLocale (T-20).
const tooltipTimeRef = computed(() => tooltip.time)
const tooltipDate = useFormattedTooltipDate(tooltipTimeRef, effectiveLocale)

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

// ============================================================================
// MOBILE TOUCH INTERACTION MODEL (src/utils/touch.ts — константы жестикуляции)
// -------------------------------------------------------------------------------
// Машина состояний одиночного пальца на строке таймлайна:
//   idle → pending-tap|pending-long-press → range-creating → done/canceled
//   idle → tap (quick creation, если options.touchCreate включает 'tap')
// Свайп (смещение > touchMoveThresholdPx до лонг-пресса) НИКОГДА не перехватывается:
// браузер прокручивает нативно (touch-action остаётся pan-x pan-y), жест отменяется.
// Мультитач (2+ пальца) отменяет одиночный жест — pinch-zoom продолжает работать
// через существующий canvas-обработчик.
// lastTouchAt — окно подавления синтезированных compat-mouse событий (dblclick и т.п.).
// ============================================================================
const selectedEventId = ref<string | number | null>(null)
let lastTouchAt = 0
let longPressTimer: ReturnType<typeof setTimeout> | null = null

/** Отмена pending-жеста создания (таймер + состояние). selection уже очищен вызывающим. */
const cancelPendingTouchCreate = () => {
  if (longPressTimer !== null) { clearTimeout(longPressTimer); longPressTimer = null }
}

onBeforeUnmount(cancelPendingTouchCreate)

// FIX(автоскролл): защита активного ивента от viewport-фильтра живёт до КОНЦА
// ЖЕСТА, а не только пока крутится RAF-петля автоскролла. activeGestureId — id
// события с активным drag/resize (TimelineEvent сообщает через 'drag-state'),
// autoscrollActiveId — id события под автоскроллом. Ивент защищён, пока жив
// хотя бы один из них; иначе RAF-петля может остановиться раньше конца жеста
// (или наоборот), событие выпадет из visibleEventsByResource → компонент
// размонтируется посреди перетаскивания и ивент «пропадает».
let activeGestureId: string | number | null = null
let autoscrollActiveId: string | number | null = null

/** Активный drag/resize-ивент обязан оставаться в выдаче visibleEventsByResource,
 *  пока идёт жест ИЛИ автоскролл — иначе он исчезнет из DOM посреди перетаскивания. */
const syncActiveDragEventId = () => {
  const id = activeGestureId ?? autoscrollActiveId
  if (id !== null || activeDragEventId.value !== null) activeDragEventId.value = id
}

// FIX: активный drag/resize-ивент никогда не должен выпадать из viewport-фильтра
// visibleEventsByResource — иначе компонент размонтируется посреди жеста,
// автоскролл обрывается и ивент «пропадает» при перетаскивании за край окна.
const onDragState = (payload: { active: boolean; eventId: string | number }) => {
  if (payload.active) {
    activeGestureId = payload.eventId
    // синхронизируем и activeDragId (для drag-shift компенсации автоскролла)
    activeDragId.value = payload.eventId
    syncActiveDragEventId()
  } else if (activeGestureId === payload.eventId) {
    activeGestureId = null
    // защита снимается только если автоскролл этого события тоже завершён
    if (autoscrollActiveId === payload.eventId) autoscrollActiveId = null
    if (activeDragId.value === payload.eventId) {
      activeDragId.value = null
      currentDragShift.value = 0
    }
    syncActiveDragEventId()
  }
}

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
  
  if (y >= 0 && y <= rect.height) {
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
const { topMarks, bottomMarks } = useRulerMarks(viewStart, pxPerMin, containerWidth, effectiveLocale)

/** UI/UX: подсветка «сегодня» на дневной линейке (метка совпадает с текущим днём) */
const isTodayMark = (m: { time: number }): boolean =>
  toTimelineDate(m.time).isSame(now.value, 'day')

/** UI/UX: тонкая подсветка выходных — только когда сетка показывает сутки и мельче */
const showWeekendHighlight = computed(() => {
  const stepMin = minStepForPx(pxPerMin.value * 60)
  return stepMin >= 24 * 60
})

const gridStyle = computed(() => {
  if (!props.options.showGrid) return {}
  const px = pxPerMin.value * 60
  // Пороги сетки совпадают с порогами линеек (единый источник — minStepForPx)
  const step = minStepForPx(px)

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
  // FIX: на время автоскролла держим событие в visibleEventsByResource,
  // даже если его позиция вышла за viewport — иначе оно исчезнет в момент
  // жеста и drag оборвётся.
  autoscrollActiveId = eventId
  syncActiveDragEventId()

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
    autoscrollActiveId = null
    // FIX: жест завершён — снимаем защиту только если drag/resize-жест тоже
    // закончен (activeGestureId null). Иначе при остановке RAF извне живой
    // жест терял защиту и ивент пропадал при следующем выходе за viewport.
    if (activeGestureId === null) {
      activeDragId.value = null
      currentDragShift.value = 0
    }
    syncActiveDragEventId()
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
    cancelPendingTouchCreate()
    // touch-жест создания (pending или range) откатываем через общий путь —
    // слушатели/таймер снимутся сами, превью не останется.
    if (activeRangeSel && isTouchPointer(e)) endRangeSelection(false)
    
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

const onCanvasPointerCancel = (e: PointerEvent) => {
  activePointers.delete(e.pointerId)
  // pointercancel (жест системы/перехват браузером) — не должен оставлять
  // «призрачные» активные указатели, иначе следующий тап воспримется как pinch.
  if (activePointers.size === 0) {
    tooltip.visible = false
  }
}

const showTooltip = (e: PointerEvent) => {
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const time = getDateFromX(x)
  
  // T-29: строки могут иметь разную высоту (растяжка под дорожки) — индекс считаем перебором,
  // а не делением на rowHeight.
  let rowIndex = -1
  {
    let acc = 0
    for (let i = 0; i < props.resources.length; i++) {
      const h = rowNeedHeight(i)
      if (y < acc + h) { rowIndex = i; break }
      acc += h
    }
  }
  const resource = rowIndex >= 0 ? props.resources[rowIndex] : null

  tooltip.visible = true
  tooltip.x = x
  tooltip.y = y
  tooltip.time = snap(time)
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
    // Вторая рука/палец — pinch-zoom перехватывает canvas-обработчик;
    // одиночный touch-жест создания отменяем чисто.
    cancelPendingTouchCreate()
    return
  }

  // TOUCH: палец по пустой строке НЕ начинает выделение сразу — сначала
  // «pending»: тап (quick create) или long-press (range create). Смещение за
  // порог touchMoveThresholdPx или pointercancel = обычный нативный скролл.
  if (isTouchPointer(e)) {
    handleTouchRowDown(r, e)
    return
  }

  startRangeSelection(r, e.clientX, e.clientY, { commitOnTap: true })
}

/** Эффективный режим touch-создания (options.touchCreate, default 'both') */
const touchCreateMode = computed(() => props.options.touchCreate ?? 'both')

/**
 * MOBILE: pointerdown пальцем по пустой строке.
 * Состояния: pending-tap / pending-long-press → range-creating → done/canceled.
 * Таймер лонг-пресса и слушатели снимаются на любом завершении жеста, включая
 * unmount (cancelPendingTouchCreate) — «залипших» состояний нет.
 */
const handleTouchRowDown = (r: TimelineResource, e: PointerEvent) => {
  lastTouchAt = Date.now()
  const mode = touchCreateMode.value
  const allowTap = mode === 'tap' || mode === 'both'
  const allowLongPress = mode === 'long-press' || mode === 'both'
  const longPressMs = props.options.touchLongPressMs ?? LONG_PRESS_MS
  const moveThreshold = props.options.touchMoveThresholdPx ?? MOVE_THRESHOLD_PX

  if (mode === false || (!allowTap && !allowLongPress)) return

  const pid = e.pointerId
  const x0 = e.clientX
  const y0 = e.clientY
  let phase: 'pending' | 'range' | 'done' = 'pending'
  let rangeStarted = false
  const rect = canvasRef.value!.getBoundingClientRect()

  const cleanup = () => {
    if (longPressTimer !== null) { clearTimeout(longPressTimer); longPressTimer = null }
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
  }

  const beginRange = () => {
    if (phase !== 'pending') return
    phase = 'range'
    rangeStarted = true
    lastTouchAt = Date.now()
    // Подтверждённый жест: запрещаем браузеру перехватывать ЭТОТ указатель под
    // скролл. Нативный скролл для остальных пальцев/свайпов остаётся доступным.
    try { canvasRef.value?.setPointerCapture(pid) } catch { /* env без capture */ }
    document.body.classList.add('tl-touch-manipulating')
    startRangeSelection(r, x0, y0, { commitOnTap: false })
  }

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pid) return
    if (phase === 'pending') {
      // Ждём либо таймаут лонг-пресса, либо явное смещение (отмена = скролл).
      if (movedBeyond(x0, y0, ev.clientX, ev.clientY, moveThreshold)) {
        // Свайп: пользователь листает ленту — никаких созданий/выделений.
        cancel()
      }
      return
    }
    if (phase === 'range' && rangeStarted) {
      // Обновляем превью диапазона в координатах последнего пальца
      // (общая логика вычисления selection — в updateSelectionFromPoint).
      updateSelectionFromPoint(ev.clientX - rect.left)
      showTooltip(ev)
    }
  }

  const finishRange = (commit: boolean) => {
    if (phase !== 'range') { cleanup(); return }
    phase = 'done'
    cleanup()
    document.body.classList.remove('tl-touch-manipulating')
    endRangeSelection(commit)
  }

  const cancel = () => {
    // pending-жест стал скроллом/прерван — чистый возврат к browsing
    phase = 'done'
    cleanup()
  }

  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pid) return
    lastTouchAt = Date.now()
    if (phase === 'pending') {
      // Короткий тап: quick creation — тот же публичный контракт 'create',
      // длительность = minDurationMinutes ?? шаг сетки.
      cancel()
      if (allowTap) emitQuickCreate(r, x0, rect)
    } else if (phase === 'range') {
      finishRange(true)
    }
  }

  const onCancel = (ev: PointerEvent) => {
    if (ev.pointerId !== pid) return
    // pointercancel: браузер забрал палец (скролл/жест системы) — полный откат
    if (phase === 'range') finishRange(false)
    else cancel()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)

  if (allowLongPress) {
    longPressTimer = setTimeout(beginRange, longPressMs)
  }
}

/** Quick creation: тап по пустой ячейке → 'create' с минимальной длительностью */
const emitQuickCreate = (r: TimelineResource, clientX: number, rect: DOMRect) => {
  const snapped = snap(getDateFromX(clientX - rect.left))
  const minDur = props.options.minDurationMinutes ?? minCellMin.value
  const bounds = clampToBounds(snapped, addMin(snapped, minDur))
  const { start, end } = clampDuration(bounds.start, bounds.end)
  if (hasOverlap(r.id, start, end)) return
  emit('create', { event: { start, end, resourceId: r.id } })
}

// ---------------------------------------------------------------------------
// Range selection — ОБЩАЯ логика для десктопного mouse-drag и touch long-press.
// Вынесена из onRowPointerDown без изменения семантики (snap/clamp/overlap/
// автоскролл у краёв — те же правила). isSelecting/selection — единое состояние.
// ---------------------------------------------------------------------------
interface RangeSelState { onMove: (ev: PointerEvent) => void; onUp: () => void }
let activeRangeSel: RangeSelState | null = null

const updateSelectionFromPoint = (x: number) => {
  if (!isSelecting || selStartTime === null || selResourceId === null) return
  const rect = canvasRef.value!.getBoundingClientRect()

  // Автоскролл у краёв (то же, что на десктопе)
  const edge = 50
  const speed = 10
  if (x < edge) startSelectAutoScroll(-1, speed * (1 - x / edge))
  else if (x > rect.width - edge) startSelectAutoScroll(1, speed * (1 - (rect.width - x) / edge))
  else stopSelectAutoScroll()

  const currentStartX = getX(selStartTime)
  const s = snap(getDateFromX(Math.min(currentStartX, x)))
  const en = snap(getDateFromX(Math.max(currentStartX, x)))
  const finalEnd = diffMin(en, s) < minCellMin.value ? addMin(s, minCellMin.value) : en
  selection.value = { resourceId: selResourceId, start: s, end: finalEnd }
}

/** Начать выделение диапазона. commitOnTap=false — клик без движения ничего не создаёт. */
const startRangeSelection = (
  r: TimelineResource, clientX: number, _clientY: number,
  opts: { commitOnTap: boolean },
) => {
  const rect = canvasRef.value!.getBoundingClientRect()
  // Храним время начала, а не координату X (устойчиво к автоскроллу)
  selStartTime = snap(getDateFromX(clientX - rect.left))
  selResourceId = r.id
  isSelecting = true
  selection.value = {
    resourceId: r.id,
    start: selStartTime,
    end: addMin(selStartTime, minCellMin.value),
  }

  const onMove = (ev: PointerEvent) => {
    if (!isSelecting || activePointers.size >= 2) {
      isSelecting = false
      selection.value = null
      stopSelectAutoScroll()
      return
    }
    updateSelectionFromPoint(ev.clientX - rect.left)
    showTooltip(ev)
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    activeRangeSel = null
    stopSelectAutoScroll()

    if (selection.value && isSelecting) {
      const moved = diffMin(selection.value.end, selection.value.start) > minCellMin.value
      if (opts.commitOnTap || moved) {
        const bounds = clampToBounds(selection.value.start, selection.value.end)
        const { start, end } = clampDuration(bounds.start, bounds.end)
        // T-36: hasOverlap учитывает группы «строгих» соседей
        if (!hasOverlap(r.id, start, end)) {
          emit('create', { event: { start, end, resourceId: r.id } })
        }
      }
    }
    selection.value = null
    isSelecting = false
    selStartTime = null
  }

  window.addEventListener('pointermove', onMove, { passive: false })
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  activeRangeSel = { onMove, onUp }
}

/** Завершить выделение из touch-машины: commit=true → обычный путь onUp. */
const endRangeSelection = (commit: boolean) => {
  const sel = activeRangeSel
  if (!sel) return
  if (!commit) {
    // Откат: убираем превью до вызова onUp, чтобы он ничего не эмитировал
    isSelecting = false
    selection.value = null
    selStartTime = null
  }
  sel.onUp()
}

/**
 * MOBILE: тап по событию (select-request из TimelineEvent) — выбор без перемещения.
 * Ровно один 'select' на жест: сам child compat-click не эмитит (окно подавления),
 * а повторный тап по выбранному событию детали не «закрывает» повторно.
 */
const onEventSelectRequest = (ev: TEvent) => {
  lastTouchAt = Date.now()
  if (selectedEventId.value === ev.id) return
  selectedEventId.value = ev.id
  emit('select', { event: ev })
}

/**
 * Тап по пустому месту (compat click после touch) — снять выбор события.
 * В окне подавления touch-дубликатов игнорируем, чтобы не «двойным» кликом
 * сбросить только что выбранное событие.
 */
const onCanvasClick = (e: MouseEvent) => {
  if (isLikelyTouchDuplicate(lastTouchAt, Date.now())) return
  if ((e.target as HTMLElement).closest('.tl-event')) return
  if (selectedEventId.value !== null) selectedEventId.value = null
}

// ============================================================================
// MOBILE ZOOM CONTROLS (шаблон: .tl-mobile-zoom, виден только на тач-устройствах)
// ----------------------------------------------------------------------------
// Используют существующий zoom() с теми же пределами (options.zoomRange):
// delta>0 уменьшает pxPerMin (zoom out), delta<0 увеличивает (zoom in).
// Якорь — центр viewport: время под центром экрана остаётся на месте.
// ============================================================================
const zoomOutStep = 1 // delta>0 → factor 0.9 (мельче / больше времени в окне)
const zoomInStep = -1 // delta<0 → factor 1.1 (крупнее)

const applyZoomStep = (delta: number) => {
  const anchorX = (canvasRef.value?.clientWidth ?? containerWidth.value ?? 0) / 2
  zoom(delta, anchorX > 0 ? anchorX : undefined)
}

const zoomBy = (dir: 1 | -1) => applyZoomStep(dir === 1 ? zoomInStep : zoomOutStep)

const canZoomIn = computed(() => pxPerMin.value < (props.options.zoomRange?.max ?? 10))
const canZoomOut = computed(() => pxPerMin.value > (props.options.zoomRange?.min ?? 0.02))

/** Вернуться к началу таймлайна («домой») — край всегда достижим на мобильных */
const goToday = () => {
  viewStart.value = toTimelineDate().startOf('day')
}

/**
 * v-model:events — эмитим НОВЫЙ массив с уже применёнными изменениями.
 * Позволяет писать `v-model:events="events"` и не мутировать свой массив
 * вручную в каждом обработчике save/delete (обратно совместимо: старые
 * обработчики @save/@delete продолжают работать как раньше).
 */
const emitChange = (nextEvents: TEvent[]) => {
  emit('change', { events: nextEvents })
  emit('update:modelValue', nextEvents)
}

const applyChangesToEvents = (ev: TEvent, changes: TimelineEventChanges): TEvent[] => {
  const start = changes.start ?? ev.start
  const end = changes.end ?? ev.end
  return props.events.map((e) => (e.id === ev.id ? ({ ...e, start, end } as TEvent) : e))
}

const emitUpdate = (ev: TEvent, changes: Partial<Pick<TEvent, 'start' | 'end'>>) => {
  if (ev.canEdit === false || options.value.canEdit === false) return
  // T-26: нормализуем частичные changes (drag/resize из child) к полному диапазону
  const raw = normalizeEventChanges(ev, changes)
  const bounds = clampToBounds(raw.start, raw.end)
  const clamped = clampDuration(bounds.start, bounds.end)
  const start = clamped.start; const end = clamped.end
  // T-36: per-group проверка (глобальный allowOverlap=false всё ещё перебивает группы)
  if (!canOverlapWith({ ...ev, start, end }, ev.resourceId, start, end, ev.id)) return
  emit('update', { event: ev, changes: { start, end } })
  emitChange(applyChangesToEvents(ev, { start, end }))
}

/**
 * T-26: `save` получает ФИНАЛЬНЫЕ валидные значения (после центрального
 * clamp/overlap), а не сырые changes из child-компонента.
 */
const emitSave = (ev: TEvent, changes: Partial<Pick<TEvent, 'start' | 'end'>>) => {
  if (ev.canEdit === false || options.value.canEdit === false) return
  const raw = normalizeEventChanges(ev, changes)
  const bounds = clampToBounds(raw.start, raw.end)
  const clamped = clampDuration(bounds.start, bounds.end)
  const start = clamped.start; const end = clamped.end
  // T-36: per-group проверка (глобальный allowOverlap=false перебивает группы)
  if (!canOverlapWith({ ...ev, start, end }, ev.resourceId, start, end, ev.id)) return
  emit('save', { event: ev, changes: { start, end } })
  emitChange(applyChangesToEvents(ev, { start, end }))
}

const onEventDelete = (ev: TEvent) => {
  emit('delete', { event: ev })
  emitChange(props.events.filter((e) => e.id !== ev.id))
}

/**
 * T-32: проверка допустимости позиции для drag/resize "на лету".
 * Передаётся в TimelineEvent как prop canMoveTo — вызывается на каждый кадр
 * движения мыши при allowOverlap=false. snap() + clampDuration применяются,
 * чтобы live-проверка совпадала с финальной проверкой в emitSave.
 */
const canMoveEventTo = (ev: TEvent, start: dayjs.Dayjs, end: dayjs.Dayjs): boolean => {
  // T-32.1: snap НЕ применяется здесь — child (TimelineEvent) сам проверяет
  // финальную (после своей нормализации) позицию через checkValid. Двойной snap
  // ломал «упирание вплотную»: неточная граница соседа (например 10:40 при
  // сетке 15) округлялась вверх до 10:45 и создавала фиктивное наложение.
  // hasOverlap работает с точными ms-границами, как и финальный emitSave.
  // T-36: per-group проверка — группа кандидата (ev.group/allowOverlap) учитывается,
  // но глобальный allowOverlap=false по-прежнему перебивает любые групповые разрешения.
  return canOverlapWith({ ...ev, start, end }, ev.resourceId, start, end, ev.id)
}

/**
 * T-32.1: нормализация для live-проверки в TimelineEvent: snap к шагу сетки
 * (если он задан) БЕЗ clampDuration — иначе минимальная длительность «расталкивает»
 * границы и событие не может вплотную упереться в соседа (корректное поведение
 * при allowOverlap=false). Финальный clampDuration/clampToBounds родитель применяет
 * в emitSave; проверка hasOverlap там идёт по той же снапнутой паре.
 * При snapMinutes = 0 нормализация — identity (Math.round(ms/0)*0 дал бы NaN).
 */
const normalizeEventPosition = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
  const stepMs = Math.max(0, options.value.snapMinutes ?? 0) * 60_000
  if (stepMs <= 0) return { start, end }
  const sn = (d: dayjs.Dayjs) => toTimelineDate(Math.round(d.valueOf() / stepMs) * stepMs)
  return { start: sn(start), end: sn(end) }
}

/**
 * Тестовые хуки: позволяют в тестах выставить видимое окно (viewStart/pxPerMin)
 * и читать/сбрасывать id активного drag-жеста, не добавляя публичные props.
 * В рантайме не используются.
 */
defineExpose({
  __setView: (vs: dayjs.Dayjs, ppm?: number) => { viewStart.value = vs; if (ppm) pxPerMin.value = ppm },
  // Ширина контейнера в jsdom всегда 0/NaN → viewEnd = viewStart + NaN и
  // viewport-фильтр не срабатывает вовсе. Тестам нужно управляемое окно.
  __setContainerWidth: (w: number) => { containerWidth.value = w },
  __activeDragEventId: () => activeDragEventId.value,
  __clearActiveDragEventId: () => { activeDragEventId.value = null },
  // Эмуляция начала/конца drag-жеста для событий, которых НЕТ в DOM (вне окна):
  // реальный TimelineEvent на pointerdown эмитит ровно такой же 'drag-state'.
  __emitDragState: (payload: { active: boolean; eventId: string | number }) => onDragState(payload),
})
</script>

<style scoped lang="scss">
// ============================================================================
// SCSS-переменные (design tokens) — единая точка настройки темы.
// Каждая пробрасывается в CSS custom property вида var(--имя, fallback),
// значения по умолчанию совпадают с историческими, поведение не меняется.
// Переопределение извне: см. раздел «Темизация (CSS переменные)» в README.
// ============================================================================
$border-color: #5656563a !default;
$grid-line-color: #e5e7eb !default;
$hover-sidebar-bg: #e5e7eb !default;
$hover-cell-bg: #dbeafe !default;
$hover-row-bg: #f3f6fc !default;
$plus-icon-color: #3770cd !default;
$plus-border-color: #93c5fd !default;
$row-height: 40px !default;
$text-primary: #111827 !default;
$text-secondary: #6b7280 !default;
$aside-bg: #ffffff !default;
$canvas-bg: #ffffff !default;
$ruler-line-color: #9ca3af !default;
$weekend-bg: rgba(148, 163, 184, 0.08) !default;
$root-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06) !default;
$radius: 12px !default;
$now-color: #ef4444 !default;
$loading-spinner-color: #3b82f6 !default;
$selection-bg: rgba(59, 130, 246, 0.25) !default;
$selection-border: #3b82f6 !default;
$tooltip-bg: #1f2937 !default;
$tooltip-color: #fff !default;
$today-accent: #2563eb !default;

// Тёмная тема (:root[data-theme='dark'])
$dark-border-color: #676767 !default;
$dark-grid-line-color: #374151 !default;
$dark-hover-sidebar-bg: #37415174 !default;
$dark-hover-cell-bg: #4d6d9991 !default;
$dark-hover-row-bg: #3e526e91 !default;
$dark-plus-icon-color: #60a5fa !default;
$dark-plus-border-color: #3b82f6 !default;
$dark-text-primary: #f9fafb !default;
$dark-text-secondary: #9ca3af !default;
$dark-aside-bg: #1f2937 !default;
$dark-canvas-bg: #111827 !default;
$dark-weekend-bg: rgba(148, 163, 184, 0.06) !default;
$dark-now-color: #f87171 !default;
$dark-loading-spinner-color: #60a5fa !default;
$dark-selection-bg: rgba(96, 165, 250, 0.25) !default;
$dark-selection-border: #60a5fa !default;
$dark-tooltip-bg: #374151 !default;
$dark-today-accent: #60a5fa !default;

.tl-root {
  --border-color: #{$border-color};
  --grid-line-color: #{$grid-line-color};
  --hover-sidebar-bg: #{$hover-sidebar-bg};
  --hover-cell-bg: #{$hover-cell-bg};
  --hover-row-bg: #{$hover-row-bg};
  --plus-icon-color: #{$plus-icon-color};
  --plus-border-color: #{$plus-border-color};
  --tl-row-height: #{$row-height};
  --ra-text: #{$text-primary};
  --text-secondary: #{$text-secondary};
  --ra-aside-bg: #{$aside-bg};
  --tl-canvas-bg: #{$canvas-bg};
  --ruler-line-color: #{$ruler-line-color};
  --tl-weekend-bg: #{$weekend-bg};
  --tl-root-shadow: #{$root-shadow};
  --tl-radius: #{$radius};
  --tl-now-color: #{$now-color};
  --tl-loading-spinner-color: #{$loading-spinner-color};
  --tl-selection-bg: #{$selection-bg};
  --tl-selection-border: #{$selection-border};
  --tl-tooltip-bg: #{$tooltip-bg};
  --tl-tooltip-color: #{$tooltip-color};
  --tl-tooltip-text: #{$tooltip-color};
  --tl-tooltip-radius: 8px;
  --tl-tooltip-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  --tl-today-accent: #{$today-accent};
}

:root[data-theme='dark'] .tl-root {
  --border-color: #{$dark-border-color};
  --grid-line-color: #{$dark-grid-line-color};
  --hover-sidebar-bg: #{$dark-hover-sidebar-bg};
  --hover-cell-bg: #{$dark-hover-cell-bg};
  --hover-row-bg: #{$dark-hover-row-bg};
  --plus-icon-color: #{$dark-plus-icon-color};
  --plus-border-color: #{$dark-plus-border-color};
  --ra-text: #{$dark-text-primary};
  --text-secondary: #{$dark-text-secondary};
  --ra-aside-bg: #{$dark-aside-bg};
  --tl-canvas-bg: #{$dark-canvas-bg};
  --tl-weekend-bg: #{$dark-weekend-bg};
  --tl-now-color: #{$dark-now-color};
  --tl-loading-spinner-color: #{$dark-loading-spinner-color};
  --tl-selection-bg: #{$dark-selection-bg};
  --tl-selection-border: #{$dark-selection-border};
  --tl-tooltip-bg: #{$dark-tooltip-bg};
  --tl-today-accent: #{$dark-today-accent};
}

.tl-sidebar-item {
  height: var(--tl-row-height, 40px);
  border-bottom: 1px solid var(--border-color, #{$border-color});
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-weight: 500;
  font-size: 13px;
  letter-spacing: 0.01em;
  color: var(--ra-text, #{$text-primary});
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color 0.15s ease;

  &.is-hovered {
    background-color: var(--hover-sidebar-bg, #{$hover-sidebar-bg});
  }
}

.tl-row {
  height: var(--tl-row-height, 40px);
  border-bottom: 1px solid var(--border-color, #{$border-color});
  position: relative;
  z-index: 1;
  cursor: crosshair;
  transition: background-color 0.15s ease;
  touch-action: pan-y;
  &.is-hovered {
    background-color: var(--hover-row-bg, #{$hover-row-bg});
  }
}

/* Подсветка выходных дней на строке (когда линейки показывают сутки) */
.tl-row.is-weekend {
  background-color: var(--tl-weekend-bg, #{$weekend-bg});

  &.is-hovered {
    background-color: var(--hover-row-bg, #{$hover-row-bg});
  }
}

.cell-hover-highlight {
  position: absolute;
  top: 2px;
  bottom: 2px;
  background-color: var(--hover-cell-bg, #{$hover-cell-bg});
  border: 1px dashed var(--plus-border-color, #{$plus-border-color});
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 2;
  transition: background-color 0.15s ease;
}

.plus-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--ra-aside-bg, #{$aside-bg});
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.18);
  font-size: 16px;
  color: var(--plus-icon-color, #{$plus-icon-color});
  font-weight: 600;
  line-height: 1;
}

.tl-root {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid var(--border-color, #{$border-color});
  border-radius: var(--tl-radius, #{$radius});
  background: var(--tl-canvas-bg, #{$canvas-bg});
  color: var(--ra-text, #{$text-primary});
  box-shadow: var(--tl-root-shadow, #{$root-shadow});
  font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}

.tl-header:not(:empty) {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color, #{$border-color});
  background: var(--ra-aside-bg, #{$aside-bg});
}

/* ==========================================================================
   MOBILE ZOOM BAR (.tl-mobile-zoom)
   Компактные touch-кнопки зума (− / уровень / + / «домой»). Показываются
   ТОЛЬКО на устройствах без hover-указателя (телефоны/планшеты), чтобы
   десктопная раскладка не менялась. Позиционируются абсолютно внутри
   .tl-root над лентой в правом верхнем углу области body; размеры кнопок
   ≥ 40×40 CSS px — комфортная зона касания.
   ========================================================================== */
.tl-root { position: relative; }

.tl-mobile-zoom {
  display: none; /* на десктопе скрыто — поведение и вёрстка не меняются */
}

@media (hover: none) and (pointer: coarse) {
  .tl-mobile-zoom {
    display: flex;
    align-items: center;
    gap: 6px;
    position: absolute;
    top: calc(100% - 52px);
    right: 10px;
    z-index: 30;
    padding: 4px 6px;
    border-radius: 999px;
    background: var(--ra-aside-bg, #{$aside-bg});
    border: 1px solid var(--border-color, #{$border-color});
    box-shadow: var(--tl-root-shadow, #{$root-shadow});
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation; /* убираем 300ms click-delay, не блокируем скролл */
  }

  .tl-mz-btn {
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    line-height: 1;
    font-weight: 600;
    color: var(--ra-text, #{$text-primary});
    background: transparent;
    border: 1px solid var(--border-color, #{$border-color});
    border-radius: 50%;
    cursor: pointer;
    padding: 0;
    -webkit-tap-highlight-color: transparent;

    &:active {
      background: var(--hover-sidebar-bg, #{$hover-sidebar-bg});
    }

    &[disabled] {
      opacity: 0.35;
      pointer-events: none;
    }
  }

  .tl-mz-level {
    min-width: 44px;
    text-align: center;
    font-size: 12px;
    color: var(--text-secondary, #{$text-secondary});
    text-transform: capitalize;
  }
}

.tl-ruler-wrapper {
  display: flex;
  border-bottom: 1px solid var(--border-color, #{$border-color});
  background: var(--ra-aside-bg, #{$aside-bg});
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
  position: relative;
  z-index: 20;
}

.tl-ruler-spacer {
  flex-shrink: 0;
  border-right: 2px solid var(--border-color, #{$border-color});
  /* 🚀 УБРАНА transition для width, чтобы ресайз был мгновенным */
}

.tl-ruler {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tl-ruler-top {
  height: 24px;
  position: relative;
  border-bottom: 1px solid var(--border-color, #{$border-color});
}

.tl-ruler-bottom {
  height: 32px;
  position: relative;

  .tl-mark.day.is-today {
    background: rgba(37, 99, 235, 0.08);

    .tl-mark-label {
      color: var(--tl-today-accent, #{$today-accent});
      font-weight: 700;
    }
  }

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
  padding: 4px 8px;
  font-size: 11px;
  line-height: 1.3;
  color: var(--text-secondary, #{$text-secondary});
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
    border-left: 1px solid var(--border-color, #{$border-color});
  }
}

.tl-mark.month .tl-mark-label {
  font-weight: 700;
  color: var(--ra-text, #{$text-primary});
  font-size: 13px;
}
.tl-mark.year .tl-mark-label {
  font-weight: 700;
  color: var(--ra-text, #{$text-primary});
  font-size: 13px;
}

.tl-mark.day {
  border-left: 1px solid var(--border-color, #{$border-color});
}

.tl-mark.day .tl-mark-label {
  font-weight: 600;
  color: var(--text-secondary, #{$text-secondary});
  font-size: 12px;
}

.tl-mark.sticky {
  z-index: 10;
  box-shadow: 2px 0 6px rgba(15, 23, 42, 0.08);
  border-left: none;
}

.tl-mark-bottom .tl-mark-line {
  background: var(--ruler-line-color, #{$ruler-line-color});
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
  // border-right: 1px solid var(--border-color, #{$border-color});
  height: max-content;
  z-index: 1;
  background: var(--ra-aside-bg, #{$aside-bg});
  position: relative;
  box-shadow: 2px 0 10px rgba(15, 23, 42, 0.06);
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
    background: var(--plus-icon-color, #{$plus-icon-color});
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
    background: var(--border-color, #{$border-color});
    border-radius: 2px;
    transition: background 0.2s, transform 0.2s;
  }

  &:hover::after, &.is-resizing::after {
    background: var(--plus-icon-color, #{$plus-icon-color});
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
  background: var(--tl-canvas-bg, #{$canvas-bg});
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
  background-color: var(--tl-now-color, #{$now-color});
  z-index: 15;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    top: -3px;
    left: 50%;
    transform: translateX(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--tl-now-color, #{$now-color});
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--tl-now-color, #{$now-color}) 25%, transparent);
  }

  .tl-current-time-label {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--tl-now-color, #{$now-color});
    color: #fff;
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 0 0 6px 6px;
    white-space: nowrap;
    font-weight: 600;
    letter-spacing: 0.02em;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18);
  }
}

.loading-wrapper {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--tl-canvas-bg, #{$canvas-bg}) 70%, transparent);
  backdrop-filter: blur(1px);
  z-index: 30;
  color: var(--text-secondary, #{$text-secondary});
  font-size: 12px;
  font-weight: 500;
}

.loading-spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 3px solid color-mix(in srgb, var(--tl-loading-spinner-color, #{$loading-spinner-color}) 25%, transparent);
  border-top-color: var(--tl-loading-spinner-color, #{$loading-spinner-color});
  animation: tl-spin 0.8s linear infinite;
}

@keyframes tl-spin {
  to { transform: rotate(360deg); }
}

/* Уважение к системной настройке «уменьшить движение» */
@media (prefers-reduced-motion: reduce) {
  .tl-sidebar-item,
  .tl-row,
  .cell-hover-highlight {
    transition: none;
  }
  .loading-spinner {
    animation-duration: 1.6s;
  }
}
</style>