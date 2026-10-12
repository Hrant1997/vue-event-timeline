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
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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

  // Читаем состояние активного жеста через тестовый хук __activeDragEventId
  // (defineExpose в <script setup> не проксирует внутренние ref'ы на vm).
  const activeId = (w: ReturnType<typeof mount>) =>
    (w.vm as any).__activeDragEventId() as string | number | null

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
    // окно 08:00–13:00 (pxPerMin=1): событие 'far' (22:00) изначально ВНЕ viewport.
    // ВАЖНО: в jsdom ResizeObserver-shim даёт containerWidth=NaN → viewEnd=NaN и
    // viewport-фильтр не срабатывал вовсе (far был виден всегда — тест ловил
    // ложный pass). Фиксируем ширину контейнера явно: 300px * ppm1 = 300 мин.
    ;(w.vm as any).__setContainerWidth(300)
    ;(w.vm as any).__setView(base.add(8 * 60, 'minute'), 1)
    await w.vm.$nextTick()
    return w
  }

  // ИЗОЛЯЦИЯ ТЕСТОВ: Timeline монтируется с attachTo: document.body; если
  // предыдущий тест не сделал unmount (или сделал его после assert), его DOM
  // остаётся в body и findAll другого wrapper'а видит ЧУЖИЕ .tl-event.
  afterEach(() => { document.body.innerHTML = '' })

  it('до фикса этот кейс ронял тест: far скрыт, но активный drag делает его видимым до конца жеста', async () => {
    const w = await mountTL()
    expect(w.findAll('.tl-event-title').map(el => el.text())).toEqual(['near'])

    // Реальный жест drag по внеоконному событию: эмулируем старт жеста через
    // 'drag-state' (то, что делает TimelineEvent на pointerdown) — событие
    // обязано появиться в DOM, хотя изначально фильтровано viewport.
    const evFar = w.findAllComponents(TimelineEvent as any)
      .find(c => (c.props('event') as { id: string }).id === 'far')
    expect(evFar).toBeUndefined() // до жеста его нет в выдаче — корень бага
    // ВНИМАНИЕ: $emit на существующем компоненте НЕ проходит через шаблонную
    // привязку @drag-state родителя (w.emitted() лишь записывает событие в
    // emitted(), обработчик не вызывается). Для событий ВНЕ DOM (far) это
    // единственный способ эмулировать pointerdown-жест — поэтому используем
    // тестовый хук __emitDragState, который вызывает ровно тот же onDragState,
    // что и реальная привязка @drag-state="onDragState".
    ;(w.vm as any).__emitDragState({ active: true, eventId: 'far' })
    await w.vm.$nextTick()
    expect(activeId(w)).toBe('far')
    expect(w.findAll('.tl-event-title').map(el => el.text())).toEqual(['near', 'far'])

    // и не исчезает, даже если viewport уехал ещё дальше за far
    ;(w.vm as any).__setView(base.add(23 * 60 + 30, 'minute'), 1)
    await w.vm.$nextTick()
    expect(w.findAll('.tl-event-title').map(el => el.text())).toEqual(['far'])

    // завершение жеста возвращает обычную viewport-фильтрацию
    ;(w.vm as any).__emitDragState({ active: false, eventId: 'far' })
    await w.vm.$nextTick()
    expect(activeId(w)).toBeNull()
    expect(w.findAll('.tl-event')).toHaveLength(0)
    w.unmount()
  })

  // Считаем компоненты конкретного таймлайна по DOM внутри его корня
  // (findAllComponents на wrapper'е может захватывать «осиротевшие» компоненты
  // из document.body после re-render'ов с v-for).
  const evIds = (w: ReturnType<typeof mount>) => {
    const root = (w.element as HTMLElement).closest('.tl-root') as HTMLElement
    return Array.from(root.querySelectorAll('.tl-event-title')).map(el => el.textContent)
  }

  it('полный жест: pointerdown → drag-state поднимает id → pointerup вне окна сбрасывает', async () => {
    const w = await mountTL()
    const ev = w.find('.tl-event')
    ev.element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }))
    await w.vm.$nextTick()
    // Timeline поднял id через onDragState ('drag-state' → activeDragEventId)
    expect(activeId(w)).toBe('near')

    // КЛЮЧЕВАЯ ПРОВЕРКА ФИКСА: пока жест активен, перетаскиваемое событие
    // НЕ ДОЛЖНО пропадать даже если viewport уехал полностью за его пределы
    // (имитация выхода курсора/автоскролла за окно). Без защиты
    // activeDragEventId компонент был бы размонтирован посреди жеста.
    ;(w.vm as any).__setView(base.add(23 * 60 + 30, 'minute'), 1) // окно 23:30–28:30: near ВНЕ окна
    await w.vm.$nextTick()
    expect(activeId(w)).toBe('near')          // защита активна
    expect(evIds(w)).toEqual(['near'])        // near остался в DOM — не пропал

    // ВАЖНО: тест монтирует Timeline БЕЗ v-model, поэтому props.events НЕ
    // обновляются live-изменениями (emitUpdate только эмитит наружу). После
    // завершения жеста near честно отфильтруется — нормальное поведение для
    // non-controlled использования. Полный жест на по-настоящему внеоконном
    // 'far' проверяем ниже: pointerdown по far-компоненту → drag-state
    // защищает его → viewport уезжает ЗА far → компонент обязан остаться в
    // DOM до pointerup → после pointerup фильтрация восстанавливается.
    window.dispatchEvent(new Event('pointerup')) // завершаем жест near
    await w.vm.$nextTick()
    expect(activeId(w)).toBeNull()            // защита снята
    expect(evIds(w)).toEqual([])              // near вне окна → отфильтрован

    // window 20:00–25:00: near вне, far ещё в окне
    ;(w.vm as any).__setView(base.add(20 * 60, 'minute'), 1)
    await w.vm.$nextTick()
    expect(evIds(w)).toEqual(['far'])

    // реальный старт жеста: pointerdown по смонтированному far-компоненту
    const rootEl = (w.element as HTMLElement).closest('.tl-root') as HTMLElement
    const farEl = Array.from(rootEl.querySelectorAll('.tl-event')).find(el =>
      el.querySelector('.tl-event-title')?.textContent === 'far') as HTMLElement
    expect(farEl).toBeTruthy()
    farEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, bubbles: true }))
    await w.vm.$nextTick()
    expect(activeId(w)).toBe('far')
    expect(evIds(w)).toEqual(['far'])

    // viewport уезжает ЗА far — без защиты компонент был бы размонтирован
    // посреди жеста (исходный баг). С защитой far остаётся в DOM.
    ;(w.vm as any).__setView(base.add(23 * 60 + 30, 'minute'), 1) // окно 23:30–28:30
    await w.vm.$nextTick()
    expect(evIds(w)).toEqual(['far'])
    expect(activeId(w)).toBe('far')

    // pointerup ловится window-слушателем самого far-компонента (он смонтирован
    // благодаря защите) → он эмитит drag-state{active:false} → id сбрасывается
    window.dispatchEvent(new Event('pointerup'))
    await w.vm.$nextTick()
    // жест завершён — защита снята, обычная viewport-фильтрация восстановлена
    expect(activeId(w)).toBeNull()
    expect(evIds(w)).toEqual([])
    w.unmount()
  })
})
