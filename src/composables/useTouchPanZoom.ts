import { ref, type Ref } from 'vue'
import dayjs from 'dayjs'
import { isTouchPointer } from '../utils/touch'

/** Скорость ниже порога — инерцию не запускаем (избегаем микро-дрожания). */
const MIN_MOMENTUM_VELOCITY = 0.05 // px/ms ≈ 50 px/s
/** Коэффициент затухания скорости за кадр (0.90 — быстро тормозит, 0.98 — долго скользит). */
const MOMENTUM_FRICTION = 0.94
/** Задержка скрытия tooltip после отпускания пальца. */
const TOOLTIP_HIDE_DELAY_MS = 2000

export interface TouchPanZoomDeps {
  viewStart: Ref<dayjs.Dayjs>
  pxPerMin: Ref<number>
  addMin: (d: dayjs.Dayjs, m: number) => dayjs.Dayjs
  /** options.touchZoom !== false — разрешён ли мультитач-жест на канвасе */
  touchZoomEnabled: Ref<boolean>
  /** Единственный палец по пустому канвасу — показать tooltip в точке касания */
  showTooltip: (e: PointerEvent) => void
  /** Отменить pending/active touch-жест создания (синхронизация с родителем) */
  cancelPendingCreate: () => void
  /** Мультитач обнаружен — принудительно отменить активное выделение диапазона */
  cancelActiveSelection: () => void
  /** Активно ли выделение диапазона (родительский isSelecting) */
  isSelecting: () => boolean
  /** Идёт ли drag/resize события (не начинаем pan поверх жеста) */
  activeDragId: Ref<string | number | null>
  /** Спрятать tooltip после отпускания последнего пальца / отмены жеста */
  hideTooltip: () => void
}

/**
 * Тач-навигация канваса (вынесено из Timeline.vue): панорамирование одним
 * пальцем с инерцией (momentum), pinch-пан двумя пальцами и подавление
 * нативных жестов браузера во время жеста.
 *
 * Десктопные пути (wheel-скролл, мышь) этот composable НЕ затрагивает:
 * все обработатели игнорируют pointerType !== 'touch', кроме случая, когда
 * второй указатель уже активен (тогда мультитач обрабатывается как pinch).
 */
export function useTouchPanZoom(deps: TouchPanZoomDeps) {
  const activePointers = new Map<number, PointerEvent>()
  let lastPinchCenterX = 0

  // --- Pan с инерцией (один палец) ---
  let lastX = 0
  let lastTime = 0
  let velocity = 0 // px/ms
  let momentumId: number | null = null

  const cancelMomentum = () => {
    if (momentumId !== null) {
      cancelAnimationFrame(momentumId)
      momentumId = null
    }
  }

  const startMomentum = () => {
    cancelMomentum()
    if (Math.abs(velocity) < MIN_MOMENTUM_VELOCITY) return

    let lastFrameTime = performance.now()
    const animate = () => {
      const now = performance.now()
      const dt = now - lastFrameTime
      lastFrameTime = now

      const minsDelta = (velocity * dt) / deps.pxPerMin.value
      deps.viewStart.value = deps.addMin(deps.viewStart.value, minsDelta)
      velocity *= MOMENTUM_FRICTION

      if (Math.abs(velocity) > MIN_MOMENTUM_VELOCITY) {
        momentumId = requestAnimationFrame(animate)
      } else {
        momentumId = null
      }
    }
    momentumId = requestAnimationFrame(animate)
  }

  /** Прокрутка ленты одним пальцем; смещение считается ОТ ПРЕДЫДУЩЕГО кадра. */
  const panWithSingleTouch = (e: PointerEvent): void => {
    e.preventDefault()
    const now = performance.now()
    const dt = now - lastTime
    const deltaX = -(e.clientX - lastX)

    if (dt > 0) {
      velocity = deltaX / dt
      deps.viewStart.value = deps.addMin(deps.viewStart.value, deltaX / deps.pxPerMin.value)
    }

    lastX = e.clientX
    lastTime = now
  }

  const canPanWithSingleTouch = (e: PointerEvent): boolean =>
    isTouchPointer(e) &&
    activePointers.size === 1 &&
    !deps.isSelecting() &&
    !deps.activeDragId.value &&
    lastX !== 0

  const onCanvasPointerDown = (e: PointerEvent) => {
    activePointers.set(e.pointerId, e)

    if (isTouchPointer(e)) {
      // Пользователь коснулся экрана во время скольжения — останавливаем инерцию
      cancelMomentum()
      lastX = e.clientX
      lastTime = performance.now()
      velocity = 0
    }

    if (activePointers.size >= 2) {
      // touchZoom:false — мультитач-жест не обрабатываем вовсе; одиночные
      // pending-жесты (тап/лонг-пресс) оставляем живыми: если второй палец уйдёт,
      // первый сможет завершить жест как обычно.
      if (!deps.touchZoomEnabled.value && isTouchPointer(e)) return
      // Мультитач обнаружен — принудительно отменяем любое активное выделение
      deps.cancelActiveSelection()
      deps.cancelPendingCreate()

      const pointers = Array.from(activePointers.values())
      lastPinchCenterX = (pointers[0].clientX + pointers[1].clientX) / 2
    } else if (activePointers.size === 1 && e.pointerType === 'touch' && !deps.isSelecting() && !deps.activeDragId.value) {
      deps.showTooltip(e)
    }
  }

  /** Pinch-пан двумя пальцами: центр щипка двигает окно просмотра. */
  const panWithPinch = (e: PointerEvent) => {
    // options.touchZoom === false: щипок пальцами не зумит ленту. Жест только
    // «глушим» (preventDefault без зума/пана), чтобы браузер не запускал
    // собственное масштабирование страницы; указатели НЕ захватываются и
    // одиночный палец по-прежнему прокручивает ленту нативно.
    e.preventDefault()

    const pointers = Array.from(activePointers.values())
    const centerX = (pointers[0].clientX + pointers[1].clientX) / 2

    const deltaCenterX = centerX - lastPinchCenterX
    if (Math.abs(deltaCenterX) > 1) {
      deps.viewStart.value = deps.addMin(deps.viewStart.value, -deltaCenterX / deps.pxPerMin.value)
      lastPinchCenterX = centerX
    }
  }

  const onCanvasPointerMove = (e: PointerEvent) => {
    activePointers.set(e.pointerId, e)

    if (canPanWithSingleTouch(e)) {
      panWithSingleTouch(e)
      return
    }

    if (activePointers.size === 2) {
      panWithPinch(e)
    } else if (activePointers.size === 1 && !deps.isSelecting() && !deps.activeDragId.value) {
      deps.showTooltip(e)
    }
  }

  const onCanvasPointerUp = (e: PointerEvent) => {
    activePointers.delete(e.pointerId)
    lastX = 0

    if (isTouchPointer(e) && activePointers.size === 0) {
      startMomentum()
      // Скрываем tooltip через 2 секунды после отпускания,
      // если за это время не появился новый палец
      setTimeout(() => {
        if (activePointers.size === 0) deps.hideTooltipAfterIdle?.()
      }, TOOLTIP_HIDE_DELAY_MS)
    }
  }

  const onCanvasPointerCancel = (e: PointerEvent) => {
    activePointers.delete(e.pointerId)
    // Обязательно останавливаем инерцию при системной отмене жеста
    cancelMomentum()
    if (activePointers.size === 0) deps.hideTooltipAfterIdle?.()
  }

  /** Очистка петель RAF при размонтировании. */
  const dispose = () => {
    cancelMomentum()
    activePointers.clear()
  }

  return {
    activePointers,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onCanvasPointerCancel,
    cancelMomentum,
    dispose,
  }
}
