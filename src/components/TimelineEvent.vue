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
import { toTimelineDate } from '../utils/date';

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
}>(), {
  deleteTitle: 'Delete',
  rowHeight: 40,
  snapMinutes: 15
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

onBeforeUnmount(() => {
  // T-11: размонтирование посреди drag/resize больше не оставляет слушателей на window
  activePointerCleanup?.()
  activePointerCleanup = null
  stopAutoScroll(true)
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

.tl-event {
  --tl-event-text-color: #{$event-text-color};
  --tl-event-shadow: #{$event-shadow};
  --tl-event-shadow-hover: #{$event-shadow-hover};
  --tl-event-blocked-shadow: #{$event-blocked-shadow};
  --tl-event-handle-bg: #{$event-handle-bg};
  --tl-event-handle-bg-hover: #{$event-handle-bg-hover};
  --tl-event-delete-bg: #{$event-delete-bg};
  --tl-event-delete-color: #{$event-delete-color};
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
  border-radius: 6px;
  cursor: grab;
  box-shadow: var(--tl-event-shadow, #{$event-shadow});
  overflow: visible;
  color: var(--tl-event-text-color, #{$event-text-color});
  user-select: none;
}

.tl-event:hover {
  box-shadow: var(--tl-event-shadow-hover, #{$event-shadow-hover});
}

.tl-event.readonly {
  cursor: default;
  opacity: 0.85;
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
}

.tl-event-handle:hover {
  background: var(--tl-event-handle-bg-hover, #{$event-handle-bg-hover});
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
  background: var(--tl-event-delete-bg, #{$event-delete-bg});
  color: var(--tl-event-delete-color, #{$event-delete-color});
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