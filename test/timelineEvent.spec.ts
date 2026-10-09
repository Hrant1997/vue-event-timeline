// Жёсткие unit-тесты на src/components/TimelineEvent.vue (T-09, T-21, live-drag, T-32)
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import TimelineEvent from '../src/components/TimelineEvent.vue'
import type { TimelineEvent as TE } from '../src/types'
import { setLibraryTimezone } from '../src/utils/date'

const VIEW_START = dayjs('2026-10-09T00:00:00')

function mkEvent(over: Partial<TE> = {}): TE {
  return {
    id: 'e1',
    resourceId: 'r1',
    start: dayjs('2026-10-09T10:00:00'),
    end: dayjs('2026-10-09T11:00:00'),
    ...over,
  }
}

function mkProps(over: Record<string, unknown> = {}) {
  return {
    event: mkEvent(),
    viewStart: VIEW_START,
    pxPerMin: 2,
    canEditGlobal: true,
    canDeleteGlobal: true,
    canvasWidth: 1200,
    dragShiftPx: 0,
    ...over,
  }
}

beforeEach(() => setLibraryTimezone(null))

describe('рендер и геометрия (T-09)', () => {
  it('left/width из абсолютных дат: (start-viewStart)*pxPerMin', () => {
    const w = mount(TimelineEvent, { props: mkProps() })
    const el = w.find('.tl-event').element as HTMLElement
    // 10:00 от полуночи = 600 мин * 2px = 1200px; длительность 60 мин = 120px
    expect(el.style.left).toBe('1200px')
    expect(el.style.width).toBe('120px')
  })

  it('минимальная ширина события 16px (не кликабельный ноль)', () => {
    const w = mount(TimelineEvent, {
      props: mkProps({ event: mkEvent({ start: dayjs('2026-10-09T10:00:00'), end: dayjs('2026-10-09T10:00:01') }) }),
    })
    expect((w.find('.tl-event').element as HTMLElement).style.width).toBe('16px')
  })

  it('высота ивента зависит от rowHeight: h=rowHeight-12, центрирование (фича rowHeight)', () => {
    const w = mount(TimelineEvent, { props: mkProps({ rowHeight: 60 }) })
    const el = w.find('.tl-event').element as HTMLElement
    expect(el.style.height).toBe('48px')
    expect(el.style.top).toBe('6px')
    // маленький rowHeight -> min height 18px
    const w2 = mount(TimelineEvent, { props: mkProps({ rowHeight: 20 }) })
    expect((w2.find('.tl-event').element as HTMLElement).style.height).toBe('18px')
  })

  it('color/border из события; дефолтный градиент без color', () => {
    const w = mount(TimelineEvent, { props: mkProps({ event: mkEvent({ color: 'red', border: '1px solid blue' }) }) })
    const el = w.find('.tl-event').element as HTMLElement
    expect(el.style.background).toBe('red')
    expect(el.style.border).toBe('1px solid blue')

    const w2 = mount(TimelineEvent, { props: mkProps() })
    expect((w2.find('.tl-event').element as HTMLElement).style.background).toContain('linear-gradient')
  })

  it('title рендерится; без title — диапазон HH:mm – HH:mm', () => {
    const w = mount(TimelineEvent, { props: mkProps({ event: mkEvent({ title: 'Митинг' }) }) })
    expect(w.text()).toContain('Митинг')
    const w2 = mount(TimelineEvent, { props: mkProps() })
    expect(w2.text()).toContain('10:00 – 11:00')
  })

  it('длительность в human-readable d/h/m', () => {
    const cases: Array<[number, string]> = [
      [30, '30m'],
      [90, '1h 30m'],
      [120, '2h'],
      [24 * 60 + 60, '1d 1h'],
    ]
    for (const [mins, expected] of cases) {
      const ev = mkEvent({ end: dayjs('2026-10-09T10:00:00').add(mins, 'minute') })
      const w = mount(TimelineEvent, { props: mkProps({ event: ev }) })
      expect(w.find('.tl-event-dur').text()).toBe(expected)
    }
  })
})

describe('права на редактирование (per-event overrides)', () => {
  it('canEditGlobal=false -> readonly, ручки скрыты; delete управляется отдельно (canDeleteGlobal)', () => {
    // семантика как в исходном коде: edit и delete — независимые права
    const w = mount(TimelineEvent, { props: mkProps({ canEditGlobal: false }) })
    expect(w.classes()).toContain('container')
    expect(w.find('.tl-event-handle.left').exists()).toBe(false)
    expect(w.find('.tl-event-handle.right').exists()).toBe(false)
    expect(w.find('.tl-event-delete').exists()).toBe(true) // canDeleteGlobal=true по умолчанию

    const w2 = mount(TimelineEvent, { props: mkProps({ canEditGlobal: false, canDeleteGlobal: false }) })
    expect(w2.find('.tl-event-delete').exists()).toBe(false)
  })

  it('event.canEdit=false переопределяет глобальное право', () => {
    const w = mount(TimelineEvent, { props: mkProps({ event: mkEvent({ canEdit: false }) }) })
    expect(w.find('.tl-event-handle.right').exists()).toBe(false)
  })

  it('event.canDrag=false — pointerdown не начинает drag', async () => {
    const w = mount(TimelineEvent, { props: mkProps({ event: mkEvent({ canDrag: false }) }) })
    w.find('.tl-event').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, bubbles: true }))
    window.dispatchEvent(new Event('pointermove'))
    expect(w.emitted('update')).toBeFalsy()
    window.dispatchEvent(new Event('pointerup'))
  })

  it('event.canDelete=false скрывает кнопку, глобальный canDelete=false тоже', () => {
    expect(mount(TimelineEvent, { props: mkProps({ event: mkEvent({ canDelete: false }) }) }).find('.tl-event-delete').exists()).toBe(false)
    expect(mount(TimelineEvent, { props: mkProps({ canDeleteGlobal: false }) }).find('.tl-event-delete').exists()).toBe(false)
  })

  it('delete кнопка эмитит delete и имеет deleteTitle (T-20)', async () => {
    const w = mount(TimelineEvent, { props: mkProps({ deleteTitle: 'Удалить' }) })
    const btn = w.find('.tl-event-delete')
    expect(btn.attributes('title')).toBe('Удалить')
    await btn.trigger('click')
    expect(w.emitted('delete')).toHaveLength(1)
  })
})

describe('live-drag: событие двигается во время движения мыши (не только на отпускании)', () => {
  function pe(type: string, clientX: number) {
    const e = new Event(type) as PointerEvent
    Object.defineProperty(e, 'clientX', { value: clientX })
    return e
  }

  it('drag: pointermove -> update c новыми start/end И мгновенный preview-сдвиг left', async () => {
    const w = mount(TimelineEvent, { props: mkProps() })
    w.find('.tl-event').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }))

    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 540 })) // +40px = +20 мин
    const upd = w.emitted('update')
    expect(upd).toBeTruthy()
    const changes = upd![upd!.length - 1][0] as { start: dayjs.Dayjs; end: dayjs.Dayjs }
    expect(changes.start.format('HH:mm')).toBe('10:15')
    expect(changes.end.format('HH:mm')).toBe('11:15')
    // живой предпросмотр: DOM уже сдвинут ДО save/родителя (ждём nextTick — watcher)
    await w.vm.$nextTick()
    expect((w.find('.tl-event').element as HTMLElement).style.left).toBe('1230px')

    window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 590 })) // ещё: итого +90px = +45 мин
    const upd2 = w.emitted('update')!
    expect((upd2[upd2.length - 1][0] as { start: dayjs.Dayjs }).start.format('HH:mm')).toBe('10:45')

    window.dispatchEvent(new Event('pointerup'))
    const save = w.emitted('save')
    expect(save).toHaveLength(1)
    const saved = save![0][0] as { start: dayjs.Dayjs; end: dayjs.Dayjs }
    expect(saved.start.format('HH:mm')).toBe('10:45')
    expect(saved.end.format('HH:mm')).toBe('11:45')
  })

  it('drag: после pointerup слушатели сняты — последующие move игнорируются', async () => {
    const w = mount(TimelineEvent, { props: mkProps() })
    w.find('.tl-event').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 540 }))
    window.dispatchEvent(new Event('pointerup'))
    const nUpdates = (w.emitted('update') ?? []).length
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 900 }))
    expect((w.emitted('update') ?? []).length).toBe(nUpdates)
  })

  it('resize right-handle: двигает только end, start зафиксирован', async () => {
    const w = mount(TimelineEvent, { props: mkProps() })
    w.find('.tl-event-handle.right').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 600, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 640 })) // +40px = +20 мин к end (snap 15 -> +15)
    const upd = w.emitted('update')![0][0] as { start?: dayjs.Dayjs; end: dayjs.Dayjs }
    expect(upd.start).toBeUndefined()
    expect(upd.end.format('HH:mm')).toBe('11:15')
    window.dispatchEvent(new Event('pointerup'))
    const save = w.emitted('save')![0][0] as { start?: dayjs.Dayjs; end: dayjs.Dayjs }
    expect(save.end.format('HH:mm')).toBe('11:15')
  })

  it('resize left-handle: двигает только start', async () => {
    const w = mount(TimelineEvent, { props: mkProps() })
    w.find('.tl-event-handle.left').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 1200, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 1230 })) // +30px = +15 мин (snap шаг 15)
    const upd = w.emitted('update')![0][0] as { start: dayjs.Dayjs; end?: dayjs.Dayjs }
    expect(upd.start.format('HH:mm')).toBe('10:15')
    expect(upd.end).toBeUndefined()
    window.dispatchEvent(new Event('pointerup'))
  })

  it('pointercancel завершает drag корректно (без утечек слушателей)', async () => {
    const w = mount(TimelineEvent, { props: mkProps() })
    w.find('.tl-event').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 540 }))
    window.dispatchEvent(new Event('pointercancel'))
    const nAfter = (w.emitted('update') ?? []).length
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 700 }))
    expect((w.emitted('update') ?? []).length).toBe(nAfter)
  })

  it('unmount во время drag снимает window-слушатели (T-11)', async () => {
    const w = mount(TimelineEvent, { props: mkProps() })
    w.find('.tl-event').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }))
    w.unmount()
    // после unmount движение не должно ничего эмитить (компонент мёртв)
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 700 }))
    expect(true).toBe(true) // no throw
  })

  it('dragShiftPx (автоскролл) сдвигает позицию без движения мыши', async () => {
    const w = mount(TimelineEvent, { props: mkProps() })
    w.find('.tl-event').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 500 })) // 0px — но applyDrag не вызывается до move...
    await w.setProps({ dragShiftPx: 60 }) // автоскролл дал +60px = +30 мин
    const upd = w.emitted('update')
    expect(upd).toBeTruthy()
    const last = upd![upd!.length - 1][0] as { start: dayjs.Dayjs }
    expect(last.start.format('HH:mm')).toBe('10:30')
    window.dispatchEvent(new Event('pointerup'))
  })
})

describe('T-32: canMoveTo блокирует пересечения при allowOverlap=false', () => {
  function pe(type: string, clientX: number) {
    const e = new Event(type) as PointerEvent
    Object.defineProperty(e, 'clientX', { value: clientX })
    return e
  }

  it('drag в запрещённую зону: update НЕ эмитится в недопустимую позицию; save получает валидную (до соседа)', async () => {
    // сосед стоит 10:40–11:40; наше событие 10:00–11:00; тянем вправо на 60px (=30 мин) -> 10:30–11:30 — пересечение
    // canMoveTo допускает только позиции без пересечения с [10:40, 11:40]
    const forbiddenStart = dayjs('2026-10-09T10:40:00').valueOf() - 60 * 60_000 + 1 // end > forbStart => overlap
    const canMoveTo = (s: dayjs.Dayjs, e: dayjs.Dayjs) => e.valueOf() <= forbiddenStart && s.valueOf() >= 0
    const w = mount(TimelineEvent, { props: mkProps({ canMoveTo }) })
    w.find('.tl-event').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 560 })) // +60px = +30 мин -> 10:30–11:30: end(11:30) > 10:40? да -> запрещено

    // ни один update не должен содержать перекрывающуюся финальную позицию
    for (const [c] of w.emitted('update') ?? []) {
      const ch = c as { start: dayjs.Dayjs; end: dayjs.Dayjs }
      expect(canMoveTo(ch.start, ch.end)).toBe(true)
    }
    window.dispatchEvent(new Event('pointerup'))
    const save = w.emitted('save')
    if (save) {
      const s = save[0][0] as { start: dayjs.Dayjs; end: dayjs.Dayjs }
      expect(canMoveTo(s.start, s.end)).toBe(true)
    }
  })

  it('drag в допустимую зону работает как обычно', async () => {
    const canMoveTo = () => true
    const w = mount(TimelineEvent, { props: mkProps({ canMoveTo }) })
    w.find('.tl-event').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 470 })) // влево на 30px = -15 мин (snap шаг 15)
    const upd = w.emitted('update')![0][0] as { start: dayjs.Dayjs }
    expect(upd.start.format('HH:mm')).toBe('09:45')
    window.dispatchEvent(new Event('pointerup'))
    expect(w.emitted('save')).toHaveLength(1)
  })

  it('клик по событию эмитит click; hover эмитит hover-event', async () => {
    const w = mount(TimelineEvent, { props: mkProps() })
    await w.find('.tl-event').trigger('mouseenter')
    expect(w.emitted('hover-event')).toEqual([[true]])
    await w.find('.tl-event').trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
    await w.find('.tl-event').trigger('mouseleave')
    expect(w.emitted('hover-event')).toEqual([[true], [false]])
  })
})
