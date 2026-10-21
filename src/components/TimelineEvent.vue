<template>
  <div
class="tl-event container" ref="rootEl" 
    :style="style" 
    :class="{ readonly: !canEditThis, blocked, selected: isSelected }" 
    @mouseenter="$emit('hover-event', true)" 
    @mouseleave="$emit('hover-event', false)"
    @pointerdown.stop="onPointerDown"
    @click.stop="onClick"
    @contextmenu.prevent.stop="onContextMenu"
>
    <div v-if="canResizeThis" class="tl-event-handle left" @pointerdown.stop="onResizeStart('start', $event)"></div>
    <div class="tl-event-body">
      <slot :event="event" :duration="duration">
        <div class="tl-event-title">{{ event.title || formatRange() }}</div>
        <div class="tl-event-dur">{{ duration }}</div>
      </slot>
    </div>
    <div v-if="canResizeThis" class="tl-event-handle right" @pointerdown.stop="onResizeStart('end', $event)"></div>

    <!-- MOBILE TOUCH HANDLES: появляются только у ВЫБРАННОГО события на тач-устройствах.
         Визуально компактные, но зона попадания ≥40px (см. CSS ::after).
         Скрытые ручки — pointer-events: none, поэтому не блокируют тапы/скролл.
         Пока жест НЕ подтверждён порогом touchDragCommitPx, браузер может
         перехватить палец для нативного скролла (pointercancel → idle). -->
    <div
      v-if="canDragThis && showTouchHandles"
      class="tl-touch-handle tl-touch-move"
      :class="{ 'is-active': gesture === 'move' }"
      aria-label="Move event"
      title="Move"
      @pointerdown.stop="onTouchHandleDown('move', $event)"
    ><span class="grip"></span></div>
    <div
      v-if="canResizeThis && showTouchHandles"
      class="tl-touch-handle tl-touch-resize start"
      :class="{ 'is-active': gesture === 'resize-start' }"
      aria-label="Resize start"
      @pointerdown.stop="onTouchHandleDown('resize-start', $event)"
    ><span class="grip"></span></div>
    <div
      v-if="canResizeThis && showTouchHandles"
      class="tl-touch-handle tl-touch-resize end"
      :class="{ 'is-active': gesture === 'resize-end' }"
      aria-label="Resize end"
      @pointerdown.stop="onTouchHandleDown('resize-end', $event)"
    ><span class="grip"></span></div>

    <button v-if="canDeleteThis" class="tl-event-delete" @click.stop="$emit('delete')" :title="deleteTitle">×</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import dayjs from 'dayjs'
import type { TimelineEvent, TimelineEventChanges } from '../types'
import { toTimelineDate } from '../utils/date';
import { isTouchPointer, movedBeyond, TOUCH_MOUSE_SUPPRESS_MS } from '../utils/touch'

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
   * T-29: геометрия lane-слоя при allowOverlap: true (top/height в px).
   * Если задана — событие занимает свой вертикальный слой внутри строки
   * вместо центрированной раскладки на всю высоту.
   */
  laneStyle?: { top: string; height: string }
  /**
   * T-32: проверка допустимости позиции (hasOverlap + clampToBounds).
   * Вызывается на каждый кадр drag/resize при allowOverlap=false —
   * событие не заходит на другое, а упирается в его границу.
   */
  canMoveTo?: (start: dayjs.Dayjs, end: dayjs.Dayjs) => boolean
  /**
   * T-32.1: нормализация позиции — те же snap + clampDuration + clampToBounds,
   * что внутри canMoveTo. Возвращает ФИНАЛЬНУЮ позицию для пары start/end.
   * Нужна, чтобы «упираться» ровно в границу соседа без зазора после snap
   * (иначе findNearestValid сходится к lo, который при нормализации отъезжает
   * назад на шаг сетки). Если не задана — используется только canMoveTo.
   */
  normalizePosition?: (start: dayjs.Dayjs, end: dayjs.Dayjs) => { start: dayjs.Dayjs; end: dayjs.Dayjs }
  /** Шаг сетки в минутах — с ним live-позиция совпадает с финальной (snap внутри canMoveTo) */
  snapMinutes?: number
  /** MOBILE: событие выбрано (тап по нему) — показывает крупные touch-ручки */
  isSelected?: boolean
  /** MOBILE: показывать touch-ручки перемещения/ресайза (options.showTouchHandles) */
  showTouchHandles?: boolean
  /** MOBILE: порог подтверждения touch-drag в CSS-px (options.touchDragCommitPx) */
  touchDragCommitPx?: number
}>(), {
  deleteTitle: 'Delete',
  rowHeight: 40,
  snapMinutes: 15,
  isSelected: false,
  showTouchHandles: true,
  touchDragCommitPx: 8
})

const emit = defineEmits<{
  (e: 'update', changes: Partial<Pick<TimelineEvent, 'start' | 'end'>>): void
  (e: 'save', changes: Partial<Pick<TimelineEvent, 'start' | 'end'>>): void
  (e: 'delete'): void
  (e: 'click'): void
  (e: 'request-autoscroll', payload: { mouseX: number; direction: number; speed: number; eventId: string | number, clear?: boolean }): void
  (e: 'hover-event', arg: boolean): void
  // FIX: сигнал родителю о начале/конце drag|resize — активный ивент
  // не должен отфильтровываться из visibleEventsByResource по viewport.
  (e: 'drag-state', payload: { active: boolean; eventId: string | number }): void
  // MOBILE: запросить выбор события (тап по карточке или старт touch-жеста)
  (e: 'select-request'): void
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

// Snap live-позиции к шагу сетки — иначе финальная позиция на pointerup
// (snap внутри canMoveTo/emitSave) расходится с последним кадром превью.
const snapMs = (d: dayjs.Dayjs): dayjs.Dayjs => {
  const stepMs = Math.max(1, props.snapMinutes) * 60_000
  return toTimelineDate(Math.round(d.valueOf() / stepMs) * stepMs)
}

// T-32.1: проверка допустимости позиции ВСЕГДА по нормализованной (snap) паре —
// ровно так же, как её увидит родитель в emitSave. Это закрывает расхождение
// «сырая позиция под курсором vs финальная после нормализации», из-за которого
// пересечение могло проскакивать на отпускании, а drag «зависал» на кадрах.
const checkValid = (start: dayjs.Dayjs, end: dayjs.Dayjs): boolean => {
  if (!props.canMoveTo) return true
  const n = props.normalizePosition
    ? props.normalizePosition(start, end)
    : { start: snapMs(start), end: snapMs(end) }
  return props.canMoveTo(n.start, n.end)
}

  // T-32.1: публичная нормализация пары границ. Fallback — snap к сетке,
  // НО только когда snapMinutes > 0: при 0 Math.round(ms/0)*0 дал бы NaN.
  const normPos = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
    if (props.normalizePosition) return props.normalizePosition(start, end)
    const stepMs = props.snapMinutes * 60_000
    if (stepMs <= 0) return { start, end }
    return { start: toTimelineDate(Math.round(start.valueOf() / stepMs) * stepMs), end: toTimelineDate(Math.round(end.valueOf() / stepMs) * stepMs) }
  }

// --- T-32.1: «упираться» вплотную к реальной границе допуска ---
// canMoveTo родителя может снапать позицию ВНУТРИ себя (как Timeline.canMoveEventTo):
// тогда финальная позиция жеста ≠ candidate и монотонного порога для бинарного
// поиска нет. Поэтому валидность всегда проверяем по ФИНАЛЬНОЙ позиции
// (checkValid применяет normalizePosition/snap — ровно так её увидит родитель
// в emitSave), а ближайшую допустимую точку ищем сканированием шагом 1 минута
// в нужном направлении — это даёт упор ВПЛОТНУЮ к границе соседа даже при
// неточных (не кратных сетке) границах, без зазора на шаг сетки.

// Финальная допустимость кандидата на ms движущейся границы.
const probeFinal = (
  cand: (ms: number) => { start: dayjs.Dayjs; end: dayjs.Dayjs },
  ms: number,
): boolean => {
  const c = cand(ms)
  return checkValid(c.start, c.end)
}

// Сканирование от fromMs в сторону dir шагом 1 мин (<= maxSteps) — первое
// финально допустимое значение. Точка допуска может лежать НЕ на минутной
// сетке скана, поэтому после нахождения первого валидного значения делаем
// «уплотнение» к стороне отказа: сначала грубым бинпоиском в интервале
// [последний отказ, первая удача] с проверкой ФИНАЛЬНОЙ позиции (после snap),
// затем точечным step-down (30/10/5/1 сек). Результат — вплотную к реальной
// границе допуска без зазора и без проскока пересечения.
const finalOf = (
  cand: (ms: number) => { start: dayjs.Dayjs; end: dayjs.Dayjs },
  rawMs: number,
): { start: dayjs.Dayjs; end: dayjs.Dayjs } | null => {
  const c = cand(rawMs)
  if (!checkValid(c.start, c.end)) return null
  return normPos(c.start, c.end)
}

const refineToEdge = (
  failMs: number, okMs: number,
  cand: (ms: number) => { start: dayjs.Dayjs; end: dayjs.Dayjs },
): number => {
  // Критерий «финальной допустимости»: позиция candidate после snap/normalize
  // должна проходить canMoveTo — ровно так её увидит родитель при сохранении.
  const okAt = (t: number) => {
    const c = cand(t)
    const n = normPos(c.start, c.end)
    return props.canMoveTo ? props.canMoveTo(n.start, n.end) : true
  }
  // Бинарное сужение в закрытом интервале [fail..ok]: ищем крайнее значение со
  // СТОРОНЫ fail, чья финальная (после snap) позиция допустима.
  let lo = Math.min(failMs, okMs)
  let hi = Math.max(failMs, okMs)
  while (hi - lo > 60_000) {
    const mid = Math.floor((lo + hi) / 2)
    if (okAt(mid)) {
      if (failMs < okMs) hi = mid; else lo = mid
    } else {
      if (failMs < okMs) lo = mid; else hi = mid
    }
  }
  // Step-down внутри оставшегося ~минутного окна: идём ОТ fail-стороны к ok,
  // последнее финально допустимое значение — искомый край.
  let best: number | null = null
  for (const step of [30_000, 10_000, 5_000, 1_000]) {
    const from: number = best !== null ? best : failMs
    const dirSign: 1 | -1 = okMs > failMs ? 1 : -1
    for (let t: number = from + dirSign * step; dirSign === 1 ? t <= okMs : t >= okMs; t += dirSign * step) {
      if (okAt(t)) best = t
      else break
    }
  }
  return best !== null ? best : okMs
}

const scanTight = (
  fromMs: number, dir: 1 | -1,
  cand: (ms: number) => { start: dayjs.Dayjs; end: dayjs.Dayjs },
  maxSteps: number,
): { start: dayjs.Dayjs; end: dayjs.Dayjs } | null => {
  // Финальная валидность кандидата: нормализуем И проверяем canMoveTo по
  // нормализованной паре — ровно так позицию увидит родитель при сохранении.
  const finalOk = (t: number) => {
    const c = cand(t)
    const n = normPos(c.start, c.end)
    return props.canMoveTo ? props.canMoveTo(n.start, n.end) : true
  }
  for (let i = 0; i <= maxSteps; i++) {
    const ms = fromMs + dir * i * 60_000
    if (finalOk(ms)) {
      if (i === 0) {
        const c = cand(ms)
        return normPos(c.start, c.end)
      }
      const prevMs = ms - dir * 60_000
      const edge = refineToEdge(prevMs, ms, cand)
      const r = finalOf(cand, edge)
      if (r && finalOk(edge)) return r
      const c = cand(ms)
      return normPos(c.start, c.end)
    }
  }
  return null
}

// --- T-32/T-32.1: поиск ближайшей допустимой позиции ("упереться" в соседа) ---
// T-32.1: проверка и результат работают с ФИНАЛЬНОЙ (после snap/normalize) позицией,
// поэтому «упираемся» вплотную к границе соседа без расхождения проверяемого/сохраняемого.
// bothChanged=true — drag (движется весь интервал, фиксирована длительность);
// bothChanged=false — resize (фиксированная противоположная граница из orig).

const findNearestValid = (
  origStart: dayjs.Dayjs, origEnd: dayjs.Dayjs,
  targetStart: dayjs.Dayjs, targetEnd: dayjs.Dayjs,
  bothChanged: boolean,
  side?: 'start' | 'end'
): { start: dayjs.Dayjs; end: dayjs.Dayjs } | null => {
  // Сторона движения задаётся ЯВНО вызывающим (applyDrag/onUp): раньше она
  // выводилась из «targetStart === origStart», и при точном попадании курсора
  // в исходную границу (raw start == orig start при resize right) распознавалась
  // неверно — поиск «упирался» не в ту сторону.
  const movingStart = bothChanged || side === 'start'
  const movingTarget = movingStart ? targetStart : targetEnd
  const movingOrig = movingStart ? origStart : origEnd

  // cand(ms) строит позицию: для drag движется весь интервал с длительностью
  // исходного события (orig end - orig start); для resize противоположная
  // граница фиксирована (она равна соответствующей orig-границе).
  const durMs = origEnd.valueOf() - origStart.valueOf()
  const fixedEnd = targetEnd
  const fixedStart = targetStart
  // T-32.1: «вплотную» к реальной границе допуска — только когда родитель дал
  // normalizePosition (тогда финальная позиция = нормализация кандидата и
  // скан/уплотнение работают по ней). Без него snap применяется ДО проверки
  // (raw в applyDrag уже снапан), и финал обязан остаться на сетке: иначе
  // несеткаовой край после snap «проскочил» бы пересечение на сохранении.
  const tight = !!props.normalizePosition
  const cand = (ms: number) => movingStart
    ? (bothChanged
        ? { start: dayjs(ms), end: dayjs(ms + durMs) }
        : { start: dayjs(ms), end: fixedEnd })
    : { start: fixedStart, end: dayjs(ms) }

  // Направление движения жеста: от orig к target
  const dirSign = movingTarget.valueOf() >= movingOrig.valueOf() ? 1 : -1

  // Без canMoveTo всё допустимо — сразу нормализуем край допуска.
  if (!props.canMoveTo) {
    const edgeMs = bothChanged
      ? (dirSign === 1 ? targetEnd.valueOf() : targetStart.valueOf())
      : movingStart ? origEnd.valueOf() : origStart.valueOf()
    const e = cand(edgeMs)
    return normPos(e.start, e.end)
  }

  // 0) Target сам финально допустим — используем его как есть.
  if (checkValid(targetStart, targetEnd)) return normPos(targetStart, targetEnd)

  // 1) Точка допуска лежит МЕЖДУ orig и target (например, resize right к
  //    соседу 10:40, когда исходный end 11:00 уже внутри запрещённой зоны):
  //    монотонный скан от target НАЗАД (против направления жеста) шагом 1 мин
  //    садит событие ВПЛОТНУЮ к реальной границе соседа.
  // 2) Target недопустим, а orig допустим — зона допуска со стороны orig:
  //    скан назад даёт границу «вплотную» без пересечения запрещённой зоны.
  const aMs = movingOrig.valueOf()
  const bMs = movingTarget.valueOf()
  const distMin = Math.round(Math.abs(aMs - bMs) / 60_000)
  const origOk = probeFinal(cand, aMs)
  if (tight) {
    // Т-32.1 «вплотную»: скан шагом 1 мин + уплотнение к реальной границе допуска.
    const back = scanTight(bMs, (dirSign === 1 ? -1 : 1) as 1 | -1, cand, distMin + 1)
    if (back && origOk) return back

    // Ни одной допустимой позиции между target и orig — широкий поиск дальше за orig.
    const far = scanTight(bMs, (dirSign === 1 ? -1 : 1) as 1 | -1, cand, 480)
    if (far && (!back || !origOk)) return far

    // Fallback: ближайшая допустимая точка из ограниченного/широкого скана —
    // лучше упёреться туда, чем «зависнуть» на недопустимом кадре.
    if (back) return back
    if (far) return far
  } else {
    // Без normalizePosition snap уже применён к raw в applyDrag — ищем ближайшую
    // ДОПУСТИМУЮ ПОСЛЕ SNAP позицию строго на сетке: дискретный проход по узлам
    // сетки от target к orig и дальше за orig (шаг = snapMinutes).
    const stepMs = Math.max(1, props.snapMinutes) * 60_000
    const gridFrom = Math.round(bMs / stepMs) * stepMs
    const scanGrid = (maxSteps: number) => {
      for (let i = 0; i <= maxSteps; i++) {
        const ms = gridFrom - dirSign * i * stepMs
        const c = cand(ms)
        if (checkValid(c.start, c.end)) return normPos(c.start, c.end)
      }
      return null
    }
    const near = scanGrid(Math.ceil(distMin / Math.max(1, stepMs / 60_000)) + 1)
    if (near && origOk) return near
    const far = scanGrid(480)
    if (far && (!near || !origOk)) return far
    if (near) return near
    if (far) return far
  }

  // 5) Исходная нормализованная позиция, если она допустима.
  const origNorm = normPos(origStart, origEnd)
  return checkValid(origNorm.start, origNorm.end) ? origNorm : null
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
    // Т-32.1: проверка по ФИНАЛЬНОЙ позиции (checkValid применяет normalize/snap),
    // иначе guard отвергал корректные «упёршиеся» кадры и drag замирал.
    if (checkValid(s, e)) return normPos(s, e)
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
  // T-29: при lane-раскладке (allowOverlap) top/height приходят из слоя;
  // иначе — высота ивента масштабируется вместе со строкой (было захардкожено 28px/5px)
  let top: number
  let h: number
  if (props.laneStyle) {
    top = parseInt(props.laneStyle.top, 10)
    h = parseInt(props.laneStyle.height, 10)
  } else {
    h = Math.max(18, props.rowHeight - 12)
    top = Math.round((props.rowHeight - h) / 2)
  }
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

// MOBILE: состояние touch-жеста (взаимоисключает десктопные mouse-пути)
type TouchGesture = 'none' | 'pending-move' | 'pending-resize-start' | 'pending-resize-end' | 'move' | 'resize-start' | 'resize-end'
const gesture = ref<TouchGesture>('none')
// Время последнего подтверждённого touch-жеста — родитель использует его для
// подавления совместимых mouse-событий (click после тапа и т.п.)
const lastTouchAt = ref(0)
let touchCleanup: (() => void) | null = null

// Главная функция пересчета и отправки update
const applyDrag = (): TimelineEventChanges | null => {
  if ((!isDragging && !isResizing) || !origStart || !origEnd) return null

  // dx включает в себя и движение мыши, и сдвиг от автоскролла
  const dx = lastMouseX - startX + props.dragShiftPx
  const dMin = dx / props.pxPerMin
  
  let changes: TimelineEventChanges
  if (isDragging) {
    // T-32.1: snap ДО проверки коллизий — live-позиция совпадает с финальной
    // (snap внутри canMoveTo/normalizePosition). Проверяем именно ФИНАЛЬНУЮ
    // позицию (checkValid применяет нормализацию), иначе пересечение
    // «проскакивает» между кадрами и на отпускании.
    const rawStart = snapMs(origStart.add(dMin, 'minute'))
    const rawEnd = snapMs(origEnd.add(dMin, 'minute'))
    // T-32: при allowOverlap=false событие не должно залезать на другое.
    // Если финальная позиция перекрывается — берём ближайшую допустимую
    // ("упираемся" в соседа) и продолжаем live-preview с ней,
    // чтобы перетаскивание не "зависало", а на отпускании
    // применялась именно валидная позиция без пересечения.
    let target = props.canMoveTo
      ? checkValid(rawStart, rawEnd)
        ? normPos(rawStart, rawEnd)
        : findNearestValid(origStart, origEnd, rawStart, rawEnd, true) ??
          // ни одна позиция в направлении движения недопустима — остаём на исходной
          (() => { blocked.value = true; return null })()
      : { start: rawStart, end: rawEnd }
    if (!target) return null
    // Финальный guard: после snap всё равно могло оказаться наложение —
    // сдвигаем событие целиком за соседа (сохраняя длительность).
    if (props.canMoveTo && !checkValid(target.start, target.end)) {
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
    const raw = snapMs(toTimelineDate(orig.valueOf() + dMin * 60000))
    const rawStart = resizeSide === 'start' ? raw : origStart
    const rawEnd = resizeSide === 'end' ? raw : origEnd
    // resize: двигаемся только до ближайшей допустимой границы
    let fixed = { start: rawStart, end: rawEnd }
    if (props.canMoveTo && !checkValid(rawStart, rawEnd)) {
      const nearest = findNearestValid(origStart, origEnd, rawStart, rawEnd, false, resizeSide)
      if (nearest) {
        fixed = nearest
      } else {
        // Ни одна позиция (включая исходную) недопустима — остаём на
        // последнем валидном кадре превью (или на исходной позиции),
        // с индикацией blocked; движение не «зависает» намертво.
        blocked.value = true
        const lastGood = preview.value
          ? { start: dayjs(preview.value.start), end: dayjs(preview.value.end) }
          : normPos(origStart, origEnd)
        changes = resizeSide === 'start'
          ? { start: lastGood.start }
          : { end: lastGood.end }
        emit('update', changes)
        return changes
      }
    }
    blocked.value = false
    changes = resizeSide === 'start'
      ? { start: fixed.start }
      : { end: fixed.end }
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
  // MOBILE: жесты, начатые на touch-ручках, живут в своей машине состояний —
  // не запускаем десктопный drag по телу события.
  if (gesture.value !== 'none') return
  // TOUCH: палец по карточке НЕ начинает перетаскивание — это жест скролла
  // (браузер прокрутит ленту, включая случай, когда свайп начался над событием)
  // либо тап-выбор. Перемещение на тач — только через крупную touch-ручку.
  if (isTouchPointer(e)) {
    lastTouchAt.value = Date.now()
    emit('select-request')
    return
  }
  if (!canDragThis.value) return
  isDragging = true
  // FIX: сообщаем родителю — активный ивент нельзя выбрасывать из viewport-фильтра
  emit('drag-state', { active: true, eventId: props.event.id })
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
    // FIX: жест завершён — возвращаем обычную viewport-фильтрацию
    emit('drag-state', { active: false, eventId: props.event.id })
    stopAutoScroll(true)
    // T-32: финальная позиция = последний ДОПУСТИМЫЙ live-preview кадр.
    // Формат changes сохраняем как при обычном жесте (drag — обе границы,
    // resize — только двигавшаяся), без canMoveTo поведение не меняется.
    const finalTarget = preview.value
      ? { start: dayjs(preview.value.start), end: dayjs(preview.value.end) }
      : null
    let finalChanges = changes
    if (finalTarget) {
      finalChanges = isDragging || !resizeSide
        ? { start: finalTarget.start, end: finalTarget.end }
        : resizeSide === 'start'
          ? { start: finalTarget.start }
          : { end: finalTarget.end }
    }
    if (props.canMoveTo) {
      const lastTarget = finalTarget ?? (changes
        ? { start: changes.start ?? origStart!, end: changes.end ?? origEnd! }
        : null)
      if (lastTarget && !checkValid(lastTarget.start, lastTarget.end)) {
        // drag: обе границы смещены целиком; resize: двигается только граница resizeSide
        const fixed = isDragging || !resizeSide
          ? findNearestValid(origStart!, origEnd!, lastTarget.start, lastTarget.end, true)
          : resizeSide === 'start'
            ? findNearestValid(origStart!, origEnd!, lastTarget.start, origEnd!, false, 'start')
            : findNearestValid(origStart!, origEnd!, origStart!, lastTarget.end, false, 'end')
        finalChanges = fixed ? { start: fixed.start, end: fixed.end } : null
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
  if (gesture.value !== 'none') return
  // TOUCH: мелкие десктопные ручки не участвуют в тач-жестах — перемещение/
  // ресайз пальцем идёт через крупные touch-ручки выбранного события.
  // Палец по краю карточки — это скролл (нативный) или тап-выбор.
  if (isTouchPointer(e)) {
    lastTouchAt.value = Date.now()
    emit('select-request')
    return
  }
  if (!canResizeThis.value) return
  
  isResizing = true
  // FIX: ресайз тоже должен держать ивент в DOM вне viewport
  emit('drag-state', { active: true, eventId: props.event.id })
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
    // FIX: жест завершён — возвращаем обычную viewport-фильтрацию
    emit('drag-state', { active: false, eventId: props.event.id })
    stopAutoScroll(true)
    // T-32: см. drag onUp — финал = последний допустимый кадр (частичный формат resize)
    // Т-32.1: resizeSide сохраняем до расчёта стороны — он нужен ниже.
    const upSide = resizeSide
    resizeSide = null
    const finalTarget = preview.value
      ? { start: dayjs(preview.value.start), end: dayjs(preview.value.end) }
      : null
    let finalChanges = changes
    if (finalTarget) {
      finalChanges = upSide === 'start'
        ? { start: finalTarget.start }
        : { end: finalTarget.end }
    }
    if (props.canMoveTo) {
      const lastTarget = finalTarget ?? (changes
        ? { start: changes.start ?? origStart!, end: changes.end ?? origEnd! }
        : null)
      // сторону берём из формата changes (надёжно даже без превью-кадра)
      const side = changes && changes.start !== undefined && changes.end === undefined
        ? 'start'
        : changes && changes.end !== undefined && changes.start === undefined
          ? 'end'
          : upSide
      if (lastTarget && !checkValid(lastTarget.start, lastTarget.end)) {
        // resize: двигается только одна граница — side определяет, какая
        const fixed = side === 'start'
          ? findNearestValid(origStart!, origEnd!, lastTarget.start, origEnd!, false, 'start')
          : side === 'end'
            ? findNearestValid(origStart!, origEnd!, origStart!, lastTarget.end, false, 'end')
            : findNearestValid(origStart!, origEnd!, lastTarget.start, lastTarget.end, true)
        finalChanges = fixed
          ? (side === 'start'
              ? { start: fixed.start }
              : side === 'end'
                ? { end: fixed.end }
                : { start: fixed.start, end: fixed.end })
          : null
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

// ============================================================================
// MOBILE TOUCH GESTURES (перемещение / ресайз через крупные touch-ручки)
// ----------------------------------------------------------------------------
// Машина состояний:
//   none → pending-move|pending-resize-*  (pointerdown на ручке, capture)
//        → move|resize-start|resize-end   (смещение > touchDragCommitPx —
//                                          подтверждаем жест, touch-action:none)
//        → none                           (pointerup — save; pointercancel — откат)
// До подтверждения палец остаётся доступным браузеру для нативного скролла:
// если браузер перехватывает жест, приходит pointercancel и мы чисто откатываемся.
// После подтверждения включаем setPointerCapture + touch-action:none — скролл
// больше не мешает, превью обновляется каждый кадр, автоскролл у краёв тот же,
// что на десктопе (checkAutoScroll).
// ============================================================================
const onTouchHandleDown = (kind: 'move' | 'resize-start' | 'resize-end', e: PointerEvent) => {
  if (gesture.value !== 'none') return
  if (kind === 'move' && !canDragThis.value) return
  if (kind !== 'move' && !canResizeThis.value) return

  lastTouchAt.value = Date.now()
  emit('select-request')

  const target = e.currentTarget as HTMLElement
  const x0 = e.clientX
  const y0 = e.clientY
  let committed = false

  const begin = () => {
    committed = true
    gesture.value = kind
    isDragging = kind === 'move'
    isResizing = kind !== 'move'
    resizeSide = kind === 'resize-start' ? 'start' : kind === 'resize-end' ? 'end' : null
    origStart = props.event.start
    origEnd = props.event.end
    startX = e.clientX
    lastMouseX = e.clientX
    // На время жеста запрещаем браузеру перехватывать указатель для скролла
    target.style.touchAction = 'none'
    document.body.classList.add('tl-touch-manipulating')
    try { target.setPointerCapture(e.pointerId) } catch { /* environment без capture */ }
    // FIX(viewport-фильтр): активный ивент нельзя выбрасывать из DOM посреди жеста
    emit('drag-state', { active: true, eventId: props.event.id })
  }

  const finish = (commitSave: boolean) => {
    const upSide = resizeSide
    const wasDrag = isDragging
    cleanup()
    target.style.touchAction = ''
    document.body.classList.remove('tl-touch-manipulating')
    if (!committed) return
    emit('drag-state', { active: false, eventId: props.event.id })
    stopAutoScroll(true)
    const finalTarget = preview.value
      ? { start: dayjs(preview.value.start), end: dayjs(preview.value.end) }
      : null
    if (commitSave && finalTarget) {
      const finalChanges: TimelineEventChanges = wasDrag
        ? { start: finalTarget.start, end: finalTarget.end }
        : upSide === 'start'
          ? { start: finalTarget.start }
          : { end: finalTarget.end }
      blocked.value = false
      // preview держим до nextTick — родитель обновляет events асинхронно (без отскока)
      emit('save', finalChanges)
      nextTick(() => { preview.value = null })
    } else {
      blocked.value = false
      preview.value = null
    }
  }

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    if (!committed) {
      if (!movedBeyond(x0, y0, ev.clientX, ev.clientY, props.touchDragCommitPx)) return
      begin()
    }
    lastMouseX = ev.clientX
    applyDrag()
    checkAutoScroll(ev.clientX)
  }

  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    finish(true)
  }

  const onCancel = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    // Браузер забрал палец под скролл / жест прерван — чистый откат к idle
    finish(false)
  }

  const cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    target.removeEventListener('lostpointercapture', onCancel)
    touchCleanup = null
    gesture.value = 'none'
    isDragging = false
    isResizing = false
    resizeSide = null
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  target.addEventListener('lostpointercapture', onCancel)
  touchCleanup = cleanup
}

// --- Click / context menu ---
const onClick = () => {
  // MOBILE: тап по событию уже обработан в pointerdown (select-request →
  // родитель эмитит 'select' ровно один раз). Совместимый mouse-клик, который
  // мобильные браузеры синтезируют после touch, должен его дублировать —
  // иначе детали откроются дважды. Мышь (pointerType='mouse') не помечает
  // lastTouchAt, поэтому десктопный клик проходит как раньше.
  if (Date.now() - lastTouchAt.value < TOUCH_MOUSE_SUPPRESS_MS) return
  emit('click')
}

const onContextMenu = () => {
  // Долгое удержание пальца вызывает контекстное меню на некоторых мобильных
  // браузерах; шаблоны карточек содержат user-select: none, поэтому стандартное
  // поведение сохраняем без изменений (хук оставлен для кастомизации).
}

onBeforeUnmount(() => {
  // T-11: размонтирование посреди drag/resize больше не оставляет слушателей на window
  activePointerCleanup?.()
  activePointerCleanup = null
  touchCleanup?.()
  touchCleanup = null
  document.body.classList.remove('tl-touch-manipulating')
  stopAutoScroll(true)
})

defineExpose({
  /** Тестовый хук: текущее состояние touch-машины состояний */
  __gesture: () => gesture.value,
  /** Тестовый хук: время последнего touch-жеста (подавление compat-mouse) */
  __lastTouchAt: () => lastTouchAt.value,
})
</script>

<style scoped lang="scss">
// ============================================================================
// SCSS-переменные (design tokens) карточки события.
// Пробрасываются в CSS custom properties — переопределяются извне,
// подробности в README → «Темизация (CSS переменные)».
// Значения по умолчанию = исторические, поведение не меняется.
// ============================================================================
$event-text-color: #fff !default;
$event-shadow: 0 2px 8px rgba(37, 99, 235, 0.3) !default;
$event-shadow-hover: 0 4px 12px rgba(37, 99, 235, 0.4) !default;
$event-blocked-shadow: 0 2px 10px rgba(239, 68, 68, 0.55) !default;
$event-handle-bg: rgba(255, 255, 255, 0.2) !default;
$event-handle-bg-hover: rgba(255, 255, 255, 0.5) !default;
$event-delete-bg: #ef4444 !default;
$event-delete-color: #fff !default;
// MOBILE touch handles (крупные ручки перемещения/ресайза выбранного события)
$event-touch-handle-bg: rgba(255, 255, 255, 0.92) !default;
$event-touch-handle-active-bg: #ffffff !default;
$event-touch-handle-icon: #3770cd !default;

.tl-event {
  --tl-event-text-color: #{$event-text-color};
  --tl-event-shadow: #{$event-shadow};
  --tl-event-shadow-hover: #{$event-shadow-hover};
  --tl-event-blocked-shadow: #{$event-blocked-shadow};
  --tl-event-handle-bg: #{$event-handle-bg};
  --tl-event-handle-bg-hover: #{$event-handle-bg-hover};
  --tl-event-delete-bg: #{$event-delete-bg};
  --tl-event-delete-color: #{$event-delete-color};
  --tl-event-touch-handle-bg: #{$event-touch-handle-bg};
  --tl-event-touch-handle-active-bg: #{$event-touch-handle-active-bg};
  --tl-event-touch-handle-icon: #{$event-touch-handle-icon};
}

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
  border-radius: 8px;
  cursor: grab;
  box-shadow: var(--tl-event-shadow, #{$event-shadow});
  overflow: visible;
  color: var(--tl-event-text-color, #{$event-text-color});
  user-select: none;
  transition: box-shadow 0.15s ease, transform 0.15s ease, filter 0.15s ease;
}

.tl-event:hover {
  box-shadow: var(--tl-event-shadow-hover, #{$event-shadow-hover});
  /* лёгкий «подъём» карточки — обратная связь без сдвига геометрии drag */
  transform: translateY(-1px);
}

.tl-event:active {
  cursor: grabbing;
  transform: none;
}

.tl-event.readonly {
  cursor: default;
  opacity: 0.85;

  &:hover {
    transform: none;
  }
}

/* T-32: недопустимая позиция при allowOverlap=false */
.tl-event.blocked {
  cursor: not-allowed;
  filter: grayscale(0.4);
  box-shadow: var(--tl-event-blocked-shadow, #{$event-blocked-shadow});
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
  background: var(--tl-event-handle-bg, #{$event-handle-bg});
  flex-shrink: 0;
  position: relative;
  transition: background 0.15s ease;
}

/* невидимая зона захвата шире видимой ручки — легче начать ресайз на тач/мелких событиях */
.tl-event-handle::after {
  content: '';
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 14px;
}

.tl-event-handle.left::after {
  left: -6px;
}

.tl-event-handle.right::after {
  right: -6px;
}

.tl-event-handle:hover {
  background: var(--tl-event-handle-bg-hover, #{$event-handle-bg-hover});
}

.tl-event-handle.left {
  border-radius: 8px 0 0 8px;
}

.tl-event-handle.right {
  border-radius: 0 8px 8px 0;
}

.tl-event-delete {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--tl-event-delete-bg, #{$event-delete-bg});
  color: var(--tl-event-delete-color, #{$event-delete-color});
  border: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.35);
  transition: filter 0.15s ease, transform 0.15s ease;
}

.tl-event:hover .tl-event-delete,
.tl-event-delete:focus-visible {
  display: flex;
}

/* ==========================================================================
   MOBILE TOUCH HANDLES (перемещение / ресайз выбранного события пальцем)
   --------------------------------------------------------------------------
   * Появляются только у .selected на тач-устройствах (@media hover:none).
   * Визуально компактные (24px), но реальная зона попадания ≥40px (::after) —
     требование Apple HIG / Material (44px).
   * Скрытые ручки имеют pointer-events: none → не перекрывают тапы и скролл.
   * touch-action: pan-x pan-y pinch-zoom — до подтверждения жеста браузер
     может забрать палец под нативный скролл (pointercancel → чистый откат).
   * Во время активного жеста JS ставит inline touch-action:none и класс
     .is-active (визуальная индикация активной ручки/конца).
   * Компактные строки: при rowHeight < 36px сужаем hit-area по вертикали,
     чтобы ручки соседних строк не перекрывались (hit area остаётся ≥32px).
   ========================================================================== */
.tl-touch-handle {
  position: absolute;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--tl-event-touch-handle-bg, rgba(255, 255, 255, 0.92));
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.35);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 20;
  /* скрытые — не участвуют в hit-testing вообще */
  pointer-events: none;
  touch-action: manipulation;
}

.tl-touch-handle .grip {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: var(--tl-event-touch-handle-icon, #{$event-touch-handle-icon});
  opacity: 0.9;
}

/* крупная невидимая зона попадания ~40px вокруг визуальной ручки */
.tl-touch-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: max(40px, 100%);
  height: max(var(--tl-touch-hit-height, 40px), 100%);
  transform: translate(-50%, -50%);
}

.tl-touch-move {
  left: 50%;
  top: 50%;
  transform: translateY(-50%);
  cursor: grab;
}

.tl-touch-resize.start {
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: ew-resize;
}

.tl-touch-resize.end {
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: ew-resize;
}

/* Ручки показываются только у выбранного события на тач-устройствах
   (hover-capable десктоп остаётся с исторической раскладкой). */
@media (hover: none) and (pointer: coarse) {
  .tl-event.selected .tl-touch-handle {
    display: flex;
    pointer-events: auto;
  }
}

.tl-touch-handle.is-active {
  background: var(--tl-event-touch-handle-active-bg, #ffffff);
  box-shadow: 0 0 0 2px var(--tl-selection-border, #3b82f6), 0 2px 10px rgba(37, 99, 235, 0.45);
}

/* активный конец при ресайзе подсвечивается дополнительно */
.tl-touch-resize.is-active .grip {
  opacity: 1;
  transform: scaleX(1.4);
}

/* выделение карточки на тач — понятная рамка (десктопный ховер сохраняется) */
.tl-event.selected {
  outline: 2px solid var(--tl-selection-border, #3b82f6);
  outline-offset: 1px;
}

/* во время touch-манипуляции запрещаем выделение текста на всей странице */
body.tl-touch-manipulating {
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.tl-event-delete:hover {
  filter: brightness(1.1);
  transform: scale(1.1);
}

.tl-event-delete:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .tl-event,
  .tl-event-handle,
  .tl-event-delete {
    transition: none;
  }
  .tl-event:hover {
    transform: none;
  }
}
</style>