/**
 * Touch-gesture tuning constants (mobile interaction model).
 *
 * The timeline must keep NATIVE one-finger scrolling (horizontal and vertical)
 * while still supporting deliberate touch manipulations. We therefore do NOT
 * disable native scrolling anywhere (`touch-action` stays `pan-x pan-y pinch-zoom`
 * on the canvas; only active manipulation targets switch to `touch-action: none`
 * for the duration of a confirmed gesture).
 *
 * Deliberate touch gestures are recognised with a small state machine driven by
 * Pointer Events:
 *   idle → pending-long-press → range-creating → done/canceled
 *   idle → tap (quick creation / selection)
 *   handle-pointerdown → moving / resizing (confirmed after MOVE_THRESHOLD px)
 *
 * Values follow platform conventions (iOS long-press ≈ 500 ms, Android ≈ 400–500 ms;
 * browser drag-start slop ≈ 8–12 CSS px). They are intentionally exported as
 * plain constants so components and tests share ONE source of truth.
 */

/** Delay before a stationary touch is treated as an intentional long press. */
export const LONG_PRESS_MS = 400

/** Movement tolerance (CSS px) before a stationary touch becomes a scroll. */
export const MOVE_THRESHOLD_PX = 10

/**
 * Minimum sustained movement (CSS px) before a pointerdown on a touch drag
 * handle / resize grip commits to move/resize and switches the element to
 * `touch-action: none`. Below it the browser may still take the pointer over
 * for native scrolling (pointercancel), which we honour by returning to idle.
 */
export const TOUCH_DRAG_COMMIT_PX = 8

/**
 * Mobile browsers synthesise compatibility mouse events (mousedown/mousemove/
 * click) after a touch interaction. Remembering the last touch timestamp lets
 * mouse-based paths ignore those duplicates. The window is generous enough for
 * the ~300 ms click delay but short enough not to swallow genuine quick re-clicks.
 */
export const TOUCH_MOUSE_SUPPRESS_MS = 400

/** True when the event originates from a finger (not mouse/pen). */
export function isTouchPointer(e: { pointerType?: string }): boolean {
  return e.pointerType === 'touch'
}

/**
 * Safe variant for native MouseEvent handlers (dblclick, click): browsers do
 * not expose `pointerType` on MouseEvent, so we detect touch via the
 * last-touch timestamp window instead. Returns false for pure mouse events.
 */
export function isTouchLikeMouseEvent(e: MouseEvent, lastTouchAt: number, now = Date.now()): boolean {
  // Compat-mouse events synthesized after a tap arrive within TOUCH_MOUSE_SUPPRESS_MS.
  return typeof (e as PointerEvent).pointerType === 'string'
    ? isTouchPointer(e as PointerEvent)
    : now - lastTouchAt <= TOUCH_MOUSE_SUPPRESS_MS
}

/**
 * Should this pointerdown start a touch-specific gesture pipeline at all?
 * Mouse and pen keep using the existing desktop code paths unchanged.
 */
export function shouldUseTouchGestures(e: { pointerType?: string }): boolean {
  return e.pointerType === 'touch'
}

/** Squared-distance helper to avoid Math.sqrt in move handlers. */
export function movedBeyond(x0: number, y0: number, x1: number, y1: number, thresholdPx: number): boolean {
  const dx = x1 - x0
  const dy = y1 - y0
  const t = thresholdPx
  return dx * dx + dy * dy > t * t
}

/**
 * Compatibility-mouse guard: returns true if a mouse event arriving now is
 * most likely a synthesised duplicate of a recent touch interaction.
 */
export function isLikelyTouchDuplicate(lastTouchAt: number, now: number): boolean {
  return now - lastTouchAt < TOUCH_MOUSE_SUPPRESS_MS
}
