/**
 * Touch-поведение канваса: отключение зума + горизонтальный нативный скролл.
 *
 * - options.touchZoom === false → канвас получает класс .no-touch-zoom,
 *   двойной тап (compat dblclick с pointerType:'touch') НЕ меняет pxPerMin,
 *   JS-pinch игнорируется; в CSS для этого класса touch-action: pan-x pan-y —
 *   браузер тоже не может выполнить pinch-zoom/double-tap-zoom страницы,
 *   при этом горизонтальный скролл одним пальцем остаётся доступным.
 * - options.touchHorizontalScroll === false → канвас получает .no-touch-pan-x
 *   и CSS-переменная строк возвращается к pan-y (только вертикальный скролл).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
// ?raw — импорт исходника компонента как строки (решает проблему
// "URL must be of scheme file" при чтении через fs в среде vitest/jsdom).
import timelineSrc from '../src/components/Timeline.vue?raw'
import { mount, VueWrapper } from '@vue/test-utils'
import dayjs from 'dayjs'
import Timeline from '../src/components/Timeline.vue'
import type { TimelineEvent as TE, TimelineResource } from '../src/types'
import { setLibraryTimezone } from '../src/utils/date'

;(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function mkEvent(over: Partial<TE> = {}): TE {
  return {
    id: 'e1',
    resourceId: 'r1',
    start: dayjs('2026-10-14T10:00:00'),
    end: dayjs('2026-10-14T11:00:00'),
    title: 'Meeting',
    ...over,
  }
}

const RES: TimelineResource[] = [{ id: 'r1', title: 'Room A' }]

async function mountTL(options: Record<string, unknown> = {}): Promise<VueWrapper<any>> {
  const w = mount(Timeline, {
    props: { events: [mkEvent()], resources: RES, options },
    attachTo: document.body,
  })
  ;(w.vm as any).__setContainerWidth(1200)
  ;(w.vm as any).__setView(dayjs('2026-10-14T08:00:00'), 1)
  await w.vm.$nextTick()
  return w
}

const canvasEl = (w: VueWrapper<any>) => w.find('.tl-canvas').element

beforeEach(() => setLibraryTimezone(null))
afterEach(() => setLibraryTimezone(null))

describe('touchZoom:false — зум на тач-устройствах отключён', () => {
  it('по умолчанию канвас без .no-touch-zoom, touch-кнопки зума видны в DOM', async () => {
    const w = await mountTL()
    expect(canvasEl(w).classList.contains('no-touch-zoom')).toBe(false)
    expect(w.find('.tl-mobile-zoom').exists()).toBe(true)
  })

  it('touchZoom:false — канвас помечен .no-touch-zoom, панель зума скрыта', async () => {
    const w = await mountTL({ touchZoom: false })
    expect(canvasEl(w).classList.contains('no-touch-zoom')).toBe(true)
    expect(w.find('.tl-mobile-zoom').exists()).toBe(false)
  })

  it('двойной тап (pointerType:touch) при touchZoom:false не меняет масштаб', async () => {
    const w = await mountTL({ touchZoom: false })
    const before = (w.vm as any).__pxPerMin()
    ;(w.vm as any).__dblClickAt(400, 'touch')
    await w.vm.$nextTick()
    expect((w.vm as any).__pxPerMin()).toBe(before)
  })

  it('двойной тап при touchZoom:"pinch" (default) масштабирует ленту', async () => {
    const w = await mountTL()
    const before = (w.vm as any).__pxPerMin()
    ;(w.vm as any).__dblClickAt(400, 'touch')
    await w.vm.$nextTick()
    expect((w.vm as any).__pxPerMin()).not.toBe(before)
  })

  it('двойной клик мышью масштабирует даже при touchZoom:false (десктоп не затронут)', async () => {
    const w = await mountTL({ touchZoom: false })
    const before = (w.vm as any).__pxPerMin()
    ;(w.vm as any).__dblClickAt(400, 'mouse')
    await w.vm.$nextTick()
    expect((w.vm as any).__pxPerMin()).not.toBe(before)
  })

  it('pinch двумя пальцами при touchZoom:false не меняет масштаб', async () => {
    const w = await mountTL({ touchZoom: false })
    const before = (w.vm as any).__pxPerMin()
    const el = canvasEl(w)
    const fire = (type: string, id: number, x: number) =>
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: 10 }))
    fire('pointerdown', 1, 100)
    fire('pointerdown', 2, 300)
    fire('pointermove', 2, 500)
    fire('pointerup', 2, 500)
    fire('pointerup', 1, 100)
    await w.vm.$nextTick()
    expect((w.vm as any).__pxPerMin()).toBe(before)
  })

  it('CSS: .no-touch-zoom запрещает браузерный зум, но сохраняет pan-x (горизонтальный скролл)', () => {
    // читаем style-блок компонента напрямую: scoped-CSS в jsdom не применяется,
    // но исходное правило — источник правды для touch-action канваса.
    const src = timelineSrc as string
    // вырезаем тело конкретного правила: комментарии CSS не учитываем —
    // проверяем только сами объявления touch-action
    const ruleBody = (selector: string): string => {
      const idx = src.indexOf(selector)
      expect(idx, `rule ${selector} not found`).toBeGreaterThanOrEqual(0)
      const m = /\{([^}]*)\}/.exec(src.slice(idx + selector.length))
      expect(m, `body of ${selector} not found`).not.toBeNull()
      return m![1]!.replace(/\/\*[\s\S]*?\*\//g, '')
    }
    const zoomRule = ruleBody('.tl-canvas.no-touch-zoom')
    expect(zoomRule).toMatch(/touch-action:\s*pan-x pan-y\s*;?/)
    expect(zoomRule).not.toMatch(/pinch-zoom/)
    expect(zoomRule).not.toContain('auto')
    // комбинация с запретом горизонтального свайпа — только вертикальный скролл
    const comboRule = ruleBody('.tl-canvas.no-touch-pan-x.no-touch-zoom')
    expect(comboRule).toMatch(/touch-action:\s*pan-y\s*;?/)
    expect(comboRule).not.toMatch(/pinch-zoom|manipulation|pan-x/)
  })
})

describe('touchHorizontalScroll — горизонтальный нативный скролл', () => {
  it('по умолчанию включён: канвас без .no-touch-pan-x, строки получают pan-x pan-y', async () => {
    const w = await mountTL()
    expect(canvasEl(w).classList.contains('no-touch-pan-x')).toBe(false)
    const wrapper = w.find('.tl-canvas-wrapper').element as HTMLElement
    expect(wrapper.style.getPropertyValue('--tl-row-touch-action')).toBe('pan-x pan-y')
  })

  it('touchHorizontalScroll:false — канвас помечен .no-touch-pan-x, строки возвращаются к pan-y', async () => {
    const w = await mountTL({ touchHorizontalScroll: false })
    expect(canvasEl(w).classList.contains('no-touch-pan-x')).toBe(true)
    const wrapper = w.find('.tl-canvas-wrapper').element as HTMLElement
    expect(wrapper.style.getPropertyValue('--tl-row-touch-action')).toBe('pan-y')
  })
})
