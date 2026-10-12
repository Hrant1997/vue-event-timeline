// Тесты на фикс «ивент пропадает при перетаскивании С АВТОСКРОЛЛОМ».
//
// Корень бага: visibleEventsByResource фильтрует события по видимому окну
// [viewStart, viewEnd]. При drag у края канвы включается автоскролл — RAF-петля
// в Timeline сдвигает viewStart, live-позиция перетаскиваемого ивента уходит за
// viewport → событие выпадало из выдачи eventsToShow() → TimelineEvent
// размонтировался ПОСРЕДИ ЖЕСТА, автоскролл обрывался, ивент «пропадал» и его
// нельзя было бросить в новой позиции.
//
// Фикс: защита активного ивента от viewport-фильтра живёт до КОНЦА ЖЕСТА:
// Timeline хранит activeGestureId (из 'drag-state') и autoscrollActiveId (из
// request-autoscroll) и держит activeDragEventId выставленным, пока жив ХОТЬ
// ОДИН из них — поэтому событие остаётся в DOM независимо от того, крутится ли
// сейчас RAF-петля, остановилась ли она раньше конца жеста или жест пережил её.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import { ref } from 'vue'
import { useTimeline } from '../src/components/useTimeline'
import Timeline from '../src/components/Timeline.vue'
import { setLibraryTimezone } from '../src/utils/date'
import type { TimelineEvent as TE, TimelineOptions, TimelineResource } from '../src/types'

// jsdom не имеет ResizeObserver — нужен shim для полного монтирования Timeline
(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ??=
  class { observe() {} unobserve() {} disconnect() {} }

beforeEach(() => setLibraryTimezone(null))

const mkEvent = (over: Partial<TE> = {}): TE => ({
  id: 'e1',
  resourceId: 'r1',
  start: dayjs('2026-10-09T10:00:00'),
  end: dayjs('2026-10-09T11:00:00'),
  ...over,
})

// ============================================================================
// 1. Уровень composable: viewport-фильтр обязан пропускать активный ивент
//    на протяжении ВСЕГО жеста — включая кадры, когда автоскролл унёс
//    viewStart далеко за пределы события.
// ============================================================================
describe('useTimeline: активный ивент виден при движении viewport (автоскролл)', () => {
  const setup = (opts: Partial<TimelineOptions> = {}) => {
    const events = ref<TE[]>([])
    const resources = ref<TimelineResource[]>([{ id: 'r1', name: 'Resource 1' }])
    const options = ref<TimelineOptions>({ allowOverlap: false, minCellMinutes: 15, ...opts } as TimelineOptions)
    return { ...useTimeline(events, resources, options), events }
  }

  it('событие остаётся в выдаче на КАЖДОМ кадре автоскролла, пока activeDragEventId выставлен', () => {
    const t = setup({ initialPxPerMin: 1 })
    t.containerWidth.value = 300 // окно = 300 минут
    t.viewStart.value = dayjs('2026-10-09T10:00:00')
    // событие 10:00–11:00 изначально ВНУТРИ окна
    t.events.value = [mkEvent({ id: 'dragged' })]
    expect(t.eventsToShow('r1').map(e => e.id)).toEqual(['dragged'])

    t.activeDragEventId.value = 'dragged'

    // имитируем кадры RAF-автоскролла вправо: viewStart уезжает всё дальше,
    // событие последовательно уходит за ЛЕВЫЙ край окна — оно обязано остаться
    for (const shiftMin of [100, 300, 600, 1200, 2400]) {
      t.viewStart.value = dayjs('2026-10-09T10:00:00').add(shiftMin, 'minute')
      expect(t.eventsToShow('r1').map(e => e.id), `кадр +${shiftMin} мин`).toEqual(['dragged'])
    }

    // жест завершён — обычная фильтрация возвращается, событие снова скрыто
    t.activeDragEventId.value = null
    expect(t.eventsToShow('r1')).toHaveLength(0)
  })
})

// ============================================================================
// 2. E2E в jsdom: полный жест drag У ПРАВОГО КРАЯ канвы.
//    Мышь заходит в edge-зону → TimelineEvent эмитит request-autoscroll →
//    Timeline крутит RAF-петлю, двигая viewStart. Без фикса на первом же
//    кадре, когда live-позиция выходит за окно, компонент размонтируется —
//    тест это ловит по исчезновению .tl-event из DOM посреди жеста.
// ============================================================================
describe('Timeline e2e: drag с автоскроллом — ивент не пропадает', () => {
  const base = dayjs('2026-10-09T00:00:00')

  // Детерминированный mock RAF: кадры прокручиваем вручную через flush().
  let rafQueue: Array<(t: number) => void> = []
  const flush = (frames = 1, t0 = 0) => {
    for (let i = 0; i < frames; i++) {
      const q = rafQueue
      rafQueue = []
      q.forEach(cb => cb(t0 + i * 16))
    }
  }

  beforeEach(() => {
    rafQueue = []
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const internals = (w: ReturnType<typeof mount>) => ({
    activeId: () => (w.vm as any).__activeDragEventId() as string | number | null,
    viewStart: () => (w.vm as any).viewStart as dayjs.Dayjs,
  })

  const mountTL = async () => {
    const w = mount(Timeline as any, {
      props: {
        events: [{ id: 'ev1', resourceId: 'r1', title: 'ev1', start: base.add(10, 'hour'), end: base.add(11, 'hour') }],
        resources: [{ id: 'r1', title: 'R1' }],
        options: { allowOverlap: true, minCellMinutes: 15 },
      },
      attachTo: document.body,
    })
    // pxPerMin=1 → ширина окна = containerWidth (1000px по умолчанию) = 1000 минут
    ;(w.vm as any).__setView(base.add(8, 'hour'), 1)
    await w.vm.$nextTick()
    return w
  }

  /** Ставим канве реальную ширину в jsdom (getBoundingClientRect иначе = 0). */
  const fakeCanvasRect = (w: ReturnType<typeof mount>, width: number) => {
    const canvas = w.find('.tl-canvas').element as HTMLElement
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: width, bottom: 0, width, height: 100, x: 0, y: 0, toJSON() {} } as DOMRect)
  }

  it('перетаскивание к правому краю: viewport уезжает за ивент, но он остаётся в DOM до pointerup', async () => {
    const w = await mountTL()
    fakeCanvasRect(w, 600)

    expect(w.findAll('.tl-event')).toHaveLength(1)

    // старт drag по событию (clientX=300 — центр канвы)
    w.find('.tl-event').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 300, bubbles: true }))
    await w.vm.$nextTick()
    expect(internals(w).activeId()).toBe('ev1')

    // заводим мышь в правую edge-зону (x > 600-80) → request-autoscroll dir=+1
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 590 }))
    await w.vm.$nextTick()
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 650 }))
    await w.vm.$nextTick()

    // прокручиваем кадры автоскролла: каждый сдвигает viewStart вперёд.
    // Суммарно viewport уезжает ДАЛЕКО за live-позицию ивента (багованный момент).
    const vs0 = internals(w).viewStart().valueOf()
    flush(30)
    await w.vm.$nextTick()
    expect(internals(w).viewStart().valueOf()).toBeGreaterThan(vs0) // автоскролл реально крутился

    // ГЛАВНАЯ ПРОВЕРКА: посреди жеста с работающим автоскроллом ивент НЕ пропал
    expect(w.findAll('.tl-event')).toHaveLength(1)
    expect(internals(w).activeId()).toBe('ev1')

    // ещё несколько кадров + движение мыши (viewport продолжает уезжать)
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 700 }))
    flush(60)
    await w.vm.$nextTick()
    expect(w.findAll('.tl-event')).toHaveLength(1)

    // отпускаем мышь — жест завершается штатно, save эмитится с новой позицией
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()

    const saves = w.emitted('save')
    expect(saves).toBeTruthy()
    const last = saves![saves!.length - 1][0] as { event: { id: string }; changes: { start: dayjs.Dayjs } }
    expect(last.event.id).toBe('ev1')
    // ивент уехал вперёд как минимум на величину автоскролла (> 11:00 + сдвиг)
    expect(last.changes.start.valueOf()).toBeGreaterThan(base.add(11, 'hour').valueOf())

    // после завершения жеста защита снята — id сброшен
    expect(internals(w).activeId()).toBeNull()
    w.unmount()
  })

  it('автоскролл остановлен РАНЬШЕ конца жеста (мышь вернулась в центр): защита держится до pointerup', async () => {
    // Регрессия второй грани бага: stopAutoScroll(true) извне раньше сбрасывал
    // activeDragEventId, хотя жест продолжался — следующий выход за viewport
    // размонтировал живой drag.
    const w = await mountTL()
    fakeCanvasRect(w, 600)

    w.find('.tl-event').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 300, bubbles: true }))
    await w.vm.$nextTick()

    // edge-зона → автоскролл запустился
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 650 }))
    await w.vm.$nextTick()
    flush(10)
    await w.vm.$nextTick()

    // мышь вернулась в центр канвы → checkAutoScroll вызывает stopAutoScroll()
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 300 }))
    await w.vm.$nextTick()

    // жест ЕЩЁ активен (pointerup не было) — защита обязана остаться
    expect(internals(w).activeId()).toBe('ev1')

    // и viewport может снова уехать за ивент — он всё равно остаётся в DOM
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 10000 }))
    await w.vm.$nextTick()
    expect(w.findAll('.tl-event')).toHaveLength(1)

    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    expect(internals(w).activeId()).toBeNull()
    w.unmount()
  })
})
