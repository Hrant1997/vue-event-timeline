import { describe, it, expect } from 'vitest'
import { mount, type DOMWrapper } from '@vue/test-utils'
import dayjs from 'dayjs'
import Timeline from '../src/components/Timeline.vue'

// jsdom не имеет ResizeObserver — монтировать Timeline целиком можно только с shim'ом
(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ??=
  class { observe() {} unobserve() {} disconnect() {} }

/**
 * Точка входа для тестов: у Timeline нет props viewStart/viewEnd (окно живёт
 * внутри useTimeline, дефолт — startOf('day')). Для детерминизма фиксируем
 * окно через test-only hook __setView: 06:00 того же дня.
 */
const mk = (id: number, startMin: number, endMin: number) => {
  const base = dayjs().startOf('day')
  return {
    id,
    resourceId: 1,
    start: base.add(startMin, 'minute'),
    end: base.add(endMin, 'minute'),
    title: `E${id}`,
  }
}

const styleH = (el: DOMWrapper<Element>): number =>
  parseInt((el.attributes('style') || '').match(/height:\s*(\d+(?:\.\d+)?)px/)?.[1] ?? '0', 10)

// `.tl-event` — корневой элемент TimelineEvent, берём computed-стили напрямую из element.style
const evStyle = (w: ReturnType<typeof mount>, i = 0) => {
  const el = w.findAll('.tl-event')[i]?.element as HTMLElement | undefined
  return { top: el?.style.top ?? '', height: el?.style.height ?? '' }
}

const mountTL = async (props: Record<string, unknown>) => {
  const w = mount(Timeline as any, {
    props: { resources: [{ id: 1, title: 'R1' }], ...props },
    attachTo: document.body,
  })
  ;(w.vm as any).__setView(dayjs().startOf('day').add(6 * 60, 'minute'))
  await w.vm.$nextTick()
  return w
}

describe('T-29 row stretch', () => {
  it('перекрывающиеся события растягивают .tl-row и сайдбар, не переполняя строку', async () => {
    // 09:00–10:30 и 10:00–11:00 → кластер из 2 дорожек при allowOverlap
    const events = [mk(1, 9 * 60, 10 * 60 + 30), mk(2, 10 * 60, 11 * 60)]
    const w = await mountTL({ events, rowHeight: 40, options: { allowOverlap: true } })
    const row = w.find('.tl-row')
    const item = w.find('.tl-sidebar-item')
    expect(w.findAll('.tl-event')).toHaveLength(2)
    expect(row.exists()).toBe(true)
    expect(item.exists()).toBe(true)
    const rh = styleH(row)
    expect(rh).toBeGreaterThan(40) // строка растянулась под 2 слоя по минимуму 16px + пад
    expect(styleH(item)).toBe(rh)  // сайдбар синхронен с высотой строки
    // ни одно событие не вылезает за нижнюю границу строки
    for (let i = 0; i < w.findAll('.tl-event').length; i++) {
      const s = evStyle(w, i)
      const top = parseInt(s.top || '0', 10)
      const h = parseInt(s.height || '0', 10)
      expect(top + h).toBeLessThanOrEqual(rh)
    }
    w.unmount()
  })

  it('без перекрытий высота строки остаётся rowHeight (inline-стиль не ставится)', async () => {
    const events = [mk(1, 9 * 60, 10 * 60)]
    const w = await mountTL({ events, rowHeight: 40, options: { allowOverlap: true } })
    const row = w.find('.tl-row')
    expect(row.exists()).toBe(true)
    expect(row.attributes('style') || '').not.toMatch(/height/)
    // событие масштабируется с rowHeight: центрировано, h = max(18, 40-12)=28
    expect(evStyle(w).height).toBe('28px')
    expect(evStyle(w).top).toBe('6px')
    w.unmount()
  })

  it('rowHeight=60 без перекрытий -> событие выше (обратная связь высоты)', async () => {
    const events = [mk(1, 9 * 60, 10 * 60)]
    const w = await mountTL({ events, rowHeight: 60, options: {} })
    expect(w.findAll('.tl-event').length).toBe(1)
    expect(evStyle(w).height).toBe('48px') // 60-12
    expect(evStyle(w).top).toBe('6px')      // (60-48)/2
    w.unmount()
  })
})
