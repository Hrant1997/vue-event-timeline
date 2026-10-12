// Тесты на фикс «ивент пропадает при перетаскивании вне viewport».
//
// Корень бага: visibleEventsByResource фильтрует события по видимому окну
// [viewStart, viewEnd]. При drag live-позиция события выходила за окно →
// событие исчезало из выдачи eventsToShow() → TimelineEvent размонтировался
// посреди жеста и ивент «пропадал».
//
// Фикс: useTimeline.activeDragEventId — активный drag/resize-ивент всегда
// остаётся в выдаче; TimelineEvent эмитит 'drag-state' (active true/false),
// Timeline поднимает id в activeDragEventId.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import { ref } from 'vue'
import { useTimeline } from '../src/components/useTimeline'
import TimelineEvent from '../src/components/TimelineEvent.vue'
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

describe('useTimeline: активный drag-ивент не выбрасывается из viewport-фильтра', () => {
  // useTimeline не возвращает сам ref events — прокидываем его наружу, как в useTimeline.spec.ts
  const setup = (opts: Partial<TimelineOptions> = {}) => {
    const events = ref<TE[]>([])
    const resources = ref<TimelineResource[]>([{ id: 'r1', name: 'Resource 1' }])
    const options = ref<TimelineOptions>({ allowOverlap: false, minCellMinutes: 15, ...opts } as TimelineOptions)
    return { ...useTimeline(events, resources, options), events }
  }

  it('без активного id — внеоконное событие отфильтровано; с id — видно; после сброса — снова скрыто', () => {
    const t = setup({ initialPxPerMin: 1 })
    t.containerWidth.value = 600 // окно = 600 минут от viewStart
    t.viewStart.value = dayjs('2026-10-09T12:00:00')
    t.events.value = [
      mkEvent({ id: 'in', start: dayjs('2026-10-09T12:30:00'), end: dayjs('2026-10-09T13:00:00') }),
      mkEvent({ id: 'far', start: dayjs('2026-10-09T22:01:00'), end: dayjs('2026-10-09T23:00:00') }),
    ]
    const ids = () => (t.visibleEventsByResource.value.get('r1') ?? []).map(e => e.id).sort()

    // базовое поведение (регрессия фильтрации сохранена)
    expect(ids()).toEqual(['in'])

    // имитируем старт drag у события вне окна — оно НЕ должно пропасть
    t.activeDragEventId.value = 'far'
    expect(ids()).toEqual(['far', 'in'])

    // drag сматывает viewport дальше за событие — всё равно остаётся
    t.viewStart.value = dayjs('2026-10-09T23:30:00')
    expect((t.visibleEventsByResource.value.get('r1') ?? []).map(e => e.id)).toEqual(['far'])

    // жест завершён — обычная viewport-фильтрация возвращается
    t.activeDragEventId.value = null
    expect(t.visibleEventsByResource.value.get('r1') ?? []).toHaveLength(0)
  })

  it('eventsToShow() тоже отдаёт активный ивент вне окна', () => {
    const t = setup({ initialPxPerMin: 1 })
    t.containerWidth.value = 600
    t.viewStart.value = dayjs('2026-10-09T12:00:00')
    t.events.value = [mkEvent({ id: 'far', start: dayjs('2026-10-09T22:01:00'), end: dayjs('2026-10-09T23:00:00') })]
    expect(t.eventsToShow('r1')).toHaveLength(0)
    t.activeDragEventId.value = 'far'
    expect(t.eventsToShow('r1').map(e => e.id)).toEqual(['far'])
  })
})

describe('TimelineEvent: эмитит drag-state на время жеста', () => {
  const props = () => ({
    event: mkEvent(),
    viewStart: dayjs('2026-10-09T00:00:00'),
    pxPerMin: 2,
    canEditGlobal: true,
    canDeleteGlobal: true,
    canvasWidth: 1200,
    dragShiftPx: 0,
  })

  it('drag: pointerdown → active:true, pointerup → active:false (одним и тем же id)', async () => {
    const w = mount(TimelineEvent, { props: props() })
    w.find('.tl-event').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }))

    let emitted = w.emitted('drag-state')!
    expect(emitted[0]).toEqual([{ active: true, eventId: 'e1' }])

    // двигаем так, чтобы live-позиция ушла далеко за пределы канвы (имитация выхода за viewport)
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 4000 }))
    window.dispatchEvent(new Event('pointerup'))

    emitted = w.emitted('drag-state')!
    expect(emitted).toHaveLength(2)
    expect(emitted[1]).toEqual([{ active: false, eventId: 'e1' }])
  })

  it('resize за край: handle → active:true на старте и active:false на pointerup', async () => {
    const w = mount(TimelineEvent, { props: props() })
    w.find('.tl-event-handle.right').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 600, bubbles: true }))
    expect(w.emitted('drag-state')![0]).toEqual([{ active: true, eventId: 'e1' }])

    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 5000 }))
    window.dispatchEvent(new Event('pointerup'))
    const all = w.emitted('drag-state')!
    expect(all[all.length - 1]).toEqual([{ active: false, eventId: 'e1' }])
  })

  it('canDrag=false — drag не начинается, drag-state не эмитится', () => {
    const w = mount(TimelineEvent, { props: { ...props(), event: mkEvent({ canDrag: false }) } })
    w.find('.tl-event').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }))
    expect(w.emitted('drag-state')).toBeUndefined()
  })
})

describe('Timeline (e2e в jsdom): ивент не пропадает при перетаскивании вне viewport', () => {
  const base = dayjs('2026-10-09T00:00:00')
  const mk = (id: string, startH: number, endH: number) => ({
    id,
    resourceId: 'r1',
    start: base.add(startH, 'hour'),
    end: base.add(endH, 'hour'),
    title: id,
  })

  // defineExpose в <script setup> НЕ проксирует внутренние ref'ы на vm —
  // читаем/пишем setup-состояние напрямую через экземпляр компонента.
  const internals = (w: ReturnType<typeof mount>) =>
    (w.vm as any).$.setupState as { activeDragEventId: { value: string | number | null } }

  const mountTL = async () => {
    const events = [mk('near', 8, 9), mk('far', 22, 23)]
    const w = mount(Timeline as any, {
      props: {
        events,
        resources: [{ id: 'r1', title: 'R1' }],
        options: { allowOverlap: false, minCellMinutes: 15 },
      },
      attachTo: document.body,
    })
    // окно 08:00–13:00 (pxPerMin=1): событие 'far' (22:00) изначально ВНЕ viewport
    ;(w.vm as any).__setView(base.add(8 * 60, 'minute'), 1)
    await w.vm.$nextTick()
    return w
  }

  it('до фикса этот кейс ронял тест: far скрыт, но активный drag делает его видимым до конца жеста', async () => {
    const w = await mountTL()
    expect(w.findAll('.tl-event-title').map(el => el.text())).toEqual(['near'])

    // выставляем активным именно внеоконное событие — оно обязано появиться в DOM
    internals(w).activeDragEventId.value = 'far'
    await w.vm.$nextTick()
    expect(w.findAll('.tl-event-title').map(el => el.text())).toEqual(['near', 'far'])

    // и не исчезает, даже если viewport уехал ещё дальше за far
    ;(w.vm as any).__setView(base.add(23 * 60 + 30, 'minute'), 1)
    await w.vm.$nextTick()
    expect(w.findAll('.tl-event-title').map(el => el.text())).toEqual(['far'])

    // сброс активного id возвращает обычную viewport-фильтрацию
    internals(w).activeDragEventId.value = null
    await w.vm.$nextTick()
    expect(w.findAll('.tl-event')).toHaveLength(0)
    w.unmount()
  })

  it('полный жест: pointerdown → drag-state поднимает id → pointerup вне окна сбрасывает', async () => {
    const w = await mountTL()
    const ev = w.find('.tl-event')
    ev.element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }))
    await w.vm.$nextTick()
    // Timeline поднял id через onDragState ('drag-state' → activeDragEventId)
    expect(internals(w).activeDragEventId.value).toBe('near')

    // тянем далеко за правый край окна (x=10000px ≈ +166ч от 08:00 при ppm=1) —
    // live-preview уходит за viewport, но компонент обязан остаться в DOM
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 10000 }))
    await w.vm.$nextTick()
    expect(w.findAll('.tl-event')).toHaveLength(1)

    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    // жест завершён — id сброшен, фильтрация по viewport восстановлена
    expect(internals(w).activeDragEventId.value).toBeNull()
    w.unmount()
  })
})
