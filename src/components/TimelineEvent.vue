<template>
  <div
class="tl-event container" ref="rootEl" 
    :style="style" 
    :class="{ readonly: !canEditThis, blocked }" 
    @mouseenter="$emit('hover-event', true)" 
    @mouseleave="$emit('hover-event', false)"
    @pointerdown.stop="onPointerDown"
    @click.stop="$emit('click')"
>
    <div v-if="canResizeThis" class="tl-event-handle left" @pointerdown.stop="onResizeStart('start', $event)"></div>
    <div class="tl-event-body">
      <slot :event="event" :duration="duration">
        <div class="tl-event-title">{{ event.title || formatRange() }}</div>
        <div class="tl-event-dur">{{ duration }}</div>
      </slot>
    </div>
    <div v-if="canResizeThis" class="tl-event-handle right" @pointerdown.stop="onResizeStart('end', $event)"></div>
    <button v-if="canDeleteThis" class="tl-event-delete" @click.stop="$emit('delete')" :title="deleteTitle">×</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import dayjs from 'dayjs'
import type { TimelineEvent, TimelineEventChanges } from '../types'
import { fleetDate } from '../utils/date';

const props = withDefaults(defineProps<{
  event: TimelineEvent
  viewStart: dayjs.Dayjs
  pxPerMin: number
  canEditGlobal: boolean
  canDeleteGlobal: boolean
  canvasWidth: number
  dragShiftPx: number // Компенсация сдвига при автоскролле
  /** T-20: title кнопки удаления (интернационализация) */
  deleteTitle?: string
  /** Высота строки — ивент масштабируется вместе с ней (top/height из неё) */
  rowHeight?: number
  /**
   * T-32: проверка допустимости позиции (hasOverlap + clampToBounds).
   * Вызывается на каждый кадр drag/resize при allowOverlap=false —
   * событие не заходит на другое, а упирается в его границу.
   */
  canMoveTo?: (start: dayjs.Dayjs, end: dayjs.Dayjs) => boolean
}>(), {
  deleteTitle: 'Delete',
  rowHeight: 40
})

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

// Живой предпросмотр drag/resize: пока идёт перетаскивание, рисуем позиции из
// последних changes (эмит update), не дожидаясь обновления props.events родителем.
// На отпускании preview сбрасывается и включается реальный event (после save).
const preview = ref<{ start: number; end: number } | null>(null)
// T-32: позиция недопустима (наложение при allowOverlap=false) — визуальная индикация
const blocked = ref(false)

// --- T-32: поиск ближайшей допустимой позиции ("упереться" в соседа) ---
// Бинарный поиск: ищем границу между допустимой (orig) и недопустимой (target) позицией.
// target отличается от orig только одной границей (drag смещает обе, resize — одну).
const findNearestValid = (
  origStart: dayjs.Dayjs, origEnd: dayjs.Dayjs,
  targetStart: dayjs.Dayjs, targetEnd: dayjs.Dayjs
): { start: dayjs.Dayjs; end: dayjs.Dayjs } => {
  const bothChanged = !targetStart.isSame(origStart) && !targetEnd.isSame(origEnd)
  let loMs = (bothChanged ? origStart : origEnd).valueOf()
  let hiMs = (bothChanged ? targetStart : targetEnd).valueOf()
  const test = (ms: number) => bothChanged
    ? props.canMoveTo!(dayjs(ms), targetEnd)
    : (targetStart.valueOf() === origStart.valueOf()
        ? props.canMoveTo!(origStart, dayjs(ms))
        : props.canMoveTo!(dayjs(ms), origEnd))
  // guard: если даже исходная позиция недопустима — возвращаем её
  if (!test(loMs)) return { start: origStart, end: origEnd }
  for (let i = 0; i < 24 && Math.abs(hiMs - loMs) > 15000; i++) {
    const mid = Math.round((loMs + hiMs) / 2)
    if (test(mid)) loMs = mid
    else hiMs = mid
  }
  return bothChanged ? { start: dayjs(loMs), end: targetEnd }
    : (targetStart.valueOf() === origStart.valueOf()
        ? { start: origStart, end: dayjs(loMs) }
        : { start: dayjs(loMs), end: origEnd })
}

// T-32: если даже ближайшая «упёршаяся» позиция после snap всё равно перекрывается —
// сдвигаем событие ЦЕЛИКОМ за соседа (сохраняем длительность, шаг = minCell).
// Двигать можно в обе стороны: сначала к исходной позиции (orig), потом дальше.
const slideUntilValid = (
  origStart: dayjs.Dayjs, _origEnd: dayjs.Dayjs,
  target: { start: dayjs.Dayjs; end: dayjs.Dayjs }
): { start: dayjs.Dayjs; end: dayjs.Dayjs } | null => {
  if (!props.canMoveTo) return target
  const durMin = Math.max(1, target.end.diff(target.start, 'minute'))
  // Пробуем позиции от target к orig и дальше за orig,
  // максимум 96 шагов по 15 минут ~ 24 часа поиска.
  const dir = target.start.isAfter(origStart) ? -1 : 1
  for (let i = 1; i <= 96; i++) {
    const s = target.start.add(dir * i * 15, 'minute')
    const e = s.add(durMin, 'minute')
    if (props.canMoveTo(s, e)) return { start: s, end: e }
  }
  return null
}

const effStart = computed(() => preview.value ? dayjs(preview.value.start) : props.event.start)
const effEnd = computed(() => preview.value ? dayjs(preview.value.end) : props.event.end)

// T-09: один расчёт границ + delta из pxPerMin вместо повторных вычитаний
const style = computed(() => {
  const s = props.viewStart.valueOf()
  const left = (effStart.value.valueOf() - s) / 60000 * props.pxPerMin
  const width = Math.max(16, (effEnd.value.valueOf() - effStart.value.valueOf()) / 60000 * props.pxPerMin)
  // Высота ивента масштабируется вместе с высотой строки (было захардкожено 28px/5px)
  const h = Math.max(18, props.rowHeight - 12)
  const top = Math.round((props.rowHeight - h) / 2)
  return {
    left: `${left}px`,
    width: `${width}px`,
    top: `${top}px`,
    height: `${h}px`,
    background: props.event.color || 'linear-gradient(135deg, #3b82f6, #2563eb)',
    border: props.event.border || 'none'
  }
})

const duration = computed(() => {
  const m = Math.round((effEnd.value.valueOf() - effStart.value.valueOf()) / 60000)
  const h = Math.floor(m / 60), mm = m % 60
  // T-20: интернациональные сокращения (было 'д/ч/м')
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`.trim()
  return h > 0 ? `${h}h ${mm ? mm + 'm' : ''}`.trim() : `${mm}m`
})

const formatRange = () =>
  effStart.value.format('HH:mm') + ' – ' + effEnd.value.format('HH:mm')

// --- Auto-scroll logic ---
const EDGE_THRESHOLD = 80
const MAX_SPEED = 15

// T-25: вместо глобального document.querySelector('.tl-canvas') (два таймлайна на странице = баг)
// берём canvas через ближайшего предка элемента события (closest ограничивает поиск subtree'ом компонента).
const rootEl = ref<HTMLElement | null>(null)

const checkAutoScroll = (mouseX: number) => {
  // T-25: ищем canvas среди предков самого элемента события — два таймлайна на странице больше не конфликтуют
  const canvasEl = rootEl.value?.closest('.tl-canvas') as HTMLElement | null
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
const applyDrag = (): TimelineEventChanges | null => {
  if ((!isDragging && !isResizing) || !origStart || !origEnd) return null

  // dx включает в себя и движение мыши, и сдвиг от автоскролла
  const dx = lastMouseX - startX + props.dragShiftPx
  const dMin = dx / props.pxPerMin
  
  let changes: TimelineEventChanges
  if (isDragging) {
    const rawStart = origStart.add(dMin, 'minute')
    const rawEnd = origEnd.add(dMin, 'minute')
    // T-32: при allowOverlap=false событие не должно залезать на другое.
    // Проверяем финальную позицию (после snap/clamp внутри canMoveTo),
    // а если она перекрывается — бёрем ближайшую допустимую
    // ("упираемся" в соседа) и продолжаем live-preview с ней,
    // чтобы перетаскивание не "зависало", а на отпускании
    // применялась именно валидная позиция без пересечения.
    let target = props.canMoveTo
      ? props.canMoveTo(rawStart, rawEnd)
        ? { start: rawStart, end: rawEnd }
        : findNearestValid(origStart, origEnd, rawStart, rawEnd)
      : { start: rawStart, end: rawEnd }
    // Финальный guard: после snap всё равно могло оказаться наложение —
    // сдвигаем событие целиком за соседа (сохраняя длительность).
    if (props.canMoveTo && !props.canMoveTo(target.start, target.end)) {
      const slid = slideUntilValid(origStart, origEnd, target)
      if (!slid) {
        blocked.value = true
        return null
      }
      target = slid
    }
    blocked.value = false
    changes = { start: target.start, end: target.end }
  } else if (isResizing && resizeSide) {
    const orig = resizeSide === 'start' ? origStart : origEnd
    const raw = fleetDate(orig.valueOf() + dMin * 60000)
    const rawStart = resizeSide === 'start' ? raw : origStart
    const rawEnd = resizeSide === 'end' ? raw : origEnd
    // resize: двигаемся только до ближайшей допустимой границы
    let fixed = { start: rawStart, end: rawEnd }
    if (props.canMoveTo && !props.canMoveTo(rawStart, rawEnd)) {
      fixed = findNearestValid(origStart, origEnd, rawStart, rawEnd)
      if (!props.canMoveTo(fixed.start, fixed.end)) {
        blocked.value = true
        return null
      }
    }
    blocked.value = false
    changes = resizeSide === 'start'
      ? { start: fixed.start, end: origEnd }
      : { start: origStart, end: fixed.end }
  } else {
    return null
  }
  // Живой предпросмотр: рисуем новую позицию сразу, не дожидаясь
  // обновления props.events родителем (controlled-компонент).
  preview.value = {
    start: (changes.start ?? origStart).valueOf(),
    end: (changes.end ?? origEnd).valueOf()
  }
  emit('update', changes)
  return changes
}

// 🚀 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Следим за изменением dragShiftPx
// Когда автоскролл меняет это значение, мы мгновенно пересчитываем позиции
watch(() => props.dragShiftPx, () => {
  applyDrag()
})

// T-11: ссылка на активный cleanup — снимает window-слушатели при размонтировании во время drag/resize
let activePointerCleanup: (() => void) | null = null

// --- Drag ---
const onPointerDown = (e: PointerEvent) => {
  if (!canDragThis.value) return
  isDragging = true
  startX = e.clientX
  lastMouseX = e.clientX
  origStart = props.event.start
  origEnd = props.event.end
  let changes: TimelineEventChanges | null = null;
  const onMove = (ev: PointerEvent) => {
    lastMouseX = ev.clientX
    changes = applyDrag() || null // Вызываем пересчет при движении мыши
    checkAutoScroll(ev.clientX)
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    activePointerCleanup = null
    isDragging = false
    stopAutoScroll(true)
    // T-32: финальная позиция = последний ДОПУСТИМЫЙ live-preview кадр
    // (applyDrag уже "упирался" в соседа). Если превью нет или оно
    // всё же недопустимо — фиксируем ближайшую валидную позицию.
    let finalChanges = changes
    if (props.canMoveTo) {
      const lastTarget = preview.value
        ? { start: dayjs(preview.value.start), end: dayjs(preview.value.end) }
        : changes
          ? { start: changes.start ?? origStart!, end: changes.end ?? origEnd! }
          : null
      if (lastTarget && !props.canMoveTo(lastTarget.start, lastTarget.end)) {
        const fixed = findNearestValid(origStart!, origEnd!, lastTarget.start, lastTarget.end)
        finalChanges = { start: fixed.start, end: fixed.end }
      } else if (lastTarget) {
        finalChanges = { start: lastTarget.start, end: lastTarget.end }
      }
    }
    blocked.value = false
    // preview держим до следующего тика: родитель (controlled-компонент)
    // обновляет events асинхронно в обработчике save — если сбросить сразу,
    // событие на миг «отскочит» к старой позиции.
    const restore = () => { preview.value = null }
    if (finalChanges) {
      emit('save', finalChanges)
      nextTick(restore)
    } else {
      restore()
    }
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  activePointerCleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }
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
  let changes: TimelineEventChanges | null = null;

  const onMove = (ev: PointerEvent) => {
    lastMouseX = ev.clientX
    changes = applyDrag() ?? null // Вызываем пересчет при движении мыши
    checkAutoScroll(ev.clientX)
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    activePointerCleanup = null
    isResizing = false
    resizeSide = null
    stopAutoScroll(true)
    // T-32: см. drag onUp — финал = последний допустимый кадр
    let finalChanges = changes
    if (props.canMoveTo) {
      const lastTarget = preview.value
        ? { start: dayjs(preview.value.start), end: dayjs(preview.value.end) }
        : changes
          ? { start: changes.start ?? origStart!, end: changes.end ?? origEnd! }
          : null
      if (lastTarget && !props.canMoveTo(lastTarget.start, lastTarget.end)) {
        const fixed = findNearestValid(origStart!, origEnd!, lastTarget.start, lastTarget.end)
        finalChanges = { start: fixed.start, end: fixed.end }
      } else if (lastTarget) {
        finalChanges = { start: lastTarget.start, end: lastTarget.end }
      }
    }
    blocked.value = false
    // см. комментарий в drag onUp: preview держим до nextTick, чтобы не было отскока
    const restore = () => { preview.value = null }
    if (finalChanges) {
      emit('save', finalChanges)
      nextTick(restore)
    } else {
      restore()
    }
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  activePointerCleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }
}

onBeforeUnmount(() => {
  // T-11: размонтирование посреди drag/resize больше не оставляет слушателей на window
  activePointerCleanup?.()
  activePointerCleanup = null
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
  /* top/height приходят из inline-стиля (computed style, зависит от rowHeight) */
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

/* T-32: недопустимая позиция при allowOverlap=false */
.tl-event.blocked {
  cursor: not-allowed;
  filter: grayscale(0.4);
  box-shadow: 0 2px 10px rgba(239, 68, 68, 0.55);
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