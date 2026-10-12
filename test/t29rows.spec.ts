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

  it('без перекрытий высота строки остаётся rowHeight', async () => {
    const events = [mk(1, 9 * 60, 10 * 60)]
    const w = await mountTL({ events, rowHeight: 40, options: { allowOverlap: true } })
    const row = w.find('.tl-row')
    expect(row.exists()).toBe(true)
    // РЕГРЕССИЯ: раньше inline-высота ставилась только при переполнении
    // (lanes>1) и залипала при смене rowHeight; теперь высота строки ВСЕГДА
    // идёт из единого реактивного источника rowNeedHeight.
    expect(styleH(row)).toBe(40)
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

  // РЕГРЕССИЯ: при изменении rowHeight высота строки должна пересчитываться.
  // Было: .tl-row получала inline height только когда дорожки ПЕРЕПОЛНЯЛИ
  // исходную строку (lanes>1); для одиночных событий inline не ставился и
  // строка зависала на старом CSS var(--tl-row-height) — ивенты меняли
  // высоту, а строка нет.
  it('изменение rowHeight пересобирает строку и события (одиночный ивент, allowOverlap:false)', async () => {
    const events = [mk(1, 9 * 60, 10 * 60)]
    const w = await mountTL({ events, rowHeight: 40, options: {} })
    const root = w.find('.tl-root')
    const row = w.find('.tl-row')
    expect(root.attributes('style')).toContain('--tl-row-height: 40px')
    expect(styleH(row)).toBe(40) // высота строки всегда из единого источника
    expect(evStyle(w).height).toBe('28px')
    expect(evStyle(w).top).toBe('6px')

    await w.setProps({ rowHeight: 60 })
    expect(root.attributes('style')).toContain('--tl-row-height: 60px')
    expect(styleH(row)).toBe(60) // СТРОКА тоже пересобралась под новый rowHeight
    expect(evStyle(w).height).toBe('48px') // 60-12
    expect(evStyle(w).top).toBe('6px')     // (60-48)/2
    w.unmount()
  })

  // РЕГРЕССИЯ (главный баг): переполненная строка хранила закешированный в
  // inline-стиле пиксельный размер; setProps({rowHeight}) не обновлял его —
  // строка оставалась старой высоты, хотя lane-ивенты пересчитывались.
  it('увеличение rowHeight растягивает переполненную строку (lane-ивенты, allowOverlap:true)', async () => {
    const events = [mk(1, 9 * 60, 10 * 60 + 30), mk(2, 10 * 60, 11 * 60)]
    const w = await mountTL({ events, rowHeight: 40, options: { allowOverlap: true } })
    const row = w.find('.tl-row')
    const item = w.find('.tl-sidebar-item')
    expect(styleH(row)).toBeGreaterThan(40)
    const h40 = styleH(row)
    expect(styleH(item)).toBe(h40)

    await w.setProps({ rowHeight: 60 })
    const h60 = styleH(row)
    expect(h60).toBeGreaterThan(h40)          // строка ВЫРАСЛА вместе с rowHeight
    expect(styleH(item)).toBe(h60)            // сайдбар синхронен
    for (let i = 0; i < w.findAll('.tl-event').length; i++) {
      const s = evStyle(w, i)
      expect(parseInt(s.height, 10)).toBeGreaterThanOrEqual(16)
      expect(parseInt(s.top, 10) + parseInt(s.height, 10)).toBeLessThanOrEqual(h60)
    }
    w.unmount()
  })

  it('уменьшение rowHeight сжимает переполненную строку (нет залипания на старой высоте)', async () => {
    const events = [mk(1, 9 * 60, 10 * 60 + 30), mk(2, 10 * 60, 11 * 60)]
    const w = await mountTL({ events, rowHeight: 60, options: { allowOverlap: true } })
    const big = styleH(w.find('.tl-row'))
    expect(big).toBeGreaterThan(60)

    await w.setProps({ rowHeight: 40 })
    const small = styleH(w.find('.tl-row'))
    expect(small).toBeLessThan(big)           // строка уменьшилась
    expect(small).toBeGreaterThan(40)         // но всё ещё вмещает 2 слоя
    expect(styleH(w.find('.tl-sidebar-item'))).toBe(small)
    for (let i = 0; i < w.findAll('.tl-event').length; i++) {
      const s = evStyle(w, i)
      expect(parseInt(s.top, 10) + parseInt(s.height, 10)).toBeLessThanOrEqual(small)
    }
    w.unmount()
  })

  // allowOverlap:true + несколько ивентов вместе: корректная высота ивентов
  it('allowOverlap: три пересекающихся ивента -> 3 слоя, строка растянута, слои не вылезают', async () => {
    const events = [
      mk(1, 9 * 60, 10 * 60),
      mk(2, 9 * 60 + 30, 10 * 60 + 30),
      mk(3, 9 * 60 + 45, 10 * 60 + 45),
    ]
    const w = await mountTL({ events, rowHeight: 60, options: { allowOverlap: true } })
    const evs = w.findAll('.tl-event')
    expect(evs.length).toBe(3)
    const rh = styleH(w.find('.tl-row'))
    expect(rh).toBeGreaterThan(60) // 3 слоя по минимум 16px не влезают в 60? 3*floor((60-4)/3)=57 → bottom 2+57+4=63 > 60
    const layers = evs.map((_, i) => evStyle(w, i))
    // все слои одинаковой высоты, лежат внутри строки, не пересекаются
    const hs = new Set(layers.map((l) => parseInt(l.height, 10)))
    expect(hs.size).toBe(1)
    const laneH = [...hs][0]
    expect(laneH).toBeGreaterThanOrEqual(16)
    const tops = layers.map((l) => parseInt(l.top, 10)).sort((a, b) => a - b)
    expect(tops[1]).toBe(tops[0] + laneH)
    expect(tops[2]).toBe(tops[1] + laneH)
    expect(tops[2] + laneH).toBeLessThanOrEqual(rh)
    w.unmount()
  })

  it('allowOverlap: два непересекающихся ивента остаются в один слой (строка = rowHeight)', async () => {
    const events = [mk(1, 9 * 60, 10 * 60), mk(2, 10 * 60, 11 * 60)] // касание end==start — не пересечение
    const w = await mountTL({ events, rowHeight: 40, options: { allowOverlap: true } })
    const row = w.find('.tl-row')
    expect(styleH(row)).toBe(40) // без переполнения строка = ровно rowHeight
    for (let i = 0; i < w.findAll('.tl-event').length; i++) {
      const s = evStyle(w, i)
      expect(parseInt(s.top, 10)).toBe(2) // laneLayer(0,1): offset=max(2,(40-36)/2=2)
      expect(parseInt(s.height, 10)).toBe(36) // floor((40-4)/1)
      expect(parseInt(s.top, 10) + parseInt(s.height, 10)).toBeLessThanOrEqual(40)
    }
    w.unmount()
  })
})
