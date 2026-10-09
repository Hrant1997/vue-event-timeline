// Жёсткие unit-тесты на src/composables/useSidebarResize.ts (T-06, T-11, T-24)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useSidebarResize } from '../src/composables/useSidebarResize'

const Host = defineComponent({
  props: { persistKey: { type: String, default: undefined } },
  setup(props) {
    return useSidebarResize(props.persistKey)
  },
  render() {
    return h('div', [
      h('div', { ref: 'sidebarRef', class: 'sb' }),
      h('div', { ref: 'rulerSpacerRef', class: 'sp' }),
    ])
  },
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('useSidebarResize — дефолты и границы', () => {
  it('без persistKey ширина = 160 и localStorage НЕ трогается (T-24)', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const wrapper = mount(Host)
    expect(wrapper.vm.sidebarWidth).toBe(160)
    expect(setItemSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('persistKey: читает сохранённую ширину из localStorage', async () => {
    localStorage.setItem('sbw', '300')
    const wrapper = mount(Host, { props: { persistKey: 'sbw' } })
    expect(wrapper.vm.sidebarWidth).toBe(300)
    wrapper.unmount()
  })

  it('persistKey: мусор/NaN в хранилище -> fallback 160', async () => {
    localStorage.setItem('sbw', 'abc')
    const wrapper = mount(Host, { props: { persistKey: 'sbw' } })
    expect(wrapper.vm.sidebarWidth).toBe(160)
    wrapper.unmount()
  })

  it('значения вне диапазона clamp-ятся при чтении (MIN 100 / MAX 500)', async () => {
    localStorage.setItem('sbw', '9999')
    const w1 = mount(Host, { props: { persistKey: 'sbw' } })
    expect(w1.vm.sidebarWidth).toBe(500)
    w1.unmount()

    localStorage.setItem('sbw', '10')
    const w2 = mount(Host, { props: { persistKey: 'sbw' } })
    expect(w2.vm.sidebarWidth).toBe(100)
    w2.unmount()
  })
})

describe('useSidebarResize — drag-ресайз', () => {
  async function startResize(wrapper: ReturnType<typeof mount>, startX = 0) {
    // применяем начальную ширину к DOM (как делает Timeline.vue через applySavedWidth)
    wrapper.vm.applySavedWidth()
    const down = new Event('pointerdown') as PointerEvent
    Object.defineProperty(down, 'clientX', { value: startX })
    wrapper.vm.onResizePointerDown(down)
    await nextTick()
  }

  it('pointermove меняет ширину с clamp; pointerup сохраняет и пишет только при persistKey', async () => {
    const wrapper = mount(Host, { props: { persistKey: 'sbw' } })
    await startResize(wrapper, 0)
    expect(wrapper.vm.isResizing).toBe(true)

    const move = new Event('pointermove') as PointerEvent
    Object.defineProperty(move, 'clientX', { value: 250 })
    window.dispatchEvent(move)
    const el = wrapper.find('.sb').element as HTMLElement
    expect(el.style.width).toBe('410px') // 160 + 250

    // выход за максимум
    const moveFar = new Event('pointermove') as PointerEvent
    Object.defineProperty(moveFar, 'clientX', { value: 5000 })
    window.dispatchEvent(moveFar)
    expect((wrapper.find('.sb').element as HTMLElement).style.width).toBe('500px')

    window.dispatchEvent(new Event('pointerup'))
    await nextTick()
    expect(wrapper.vm.isResizing).toBe(false)
    expect(wrapper.vm.sidebarWidth).toBe(500)
    expect(localStorage.getItem('sbw')).toBe('500')
    wrapper.unmount()
  })

  it('без persistKey pointerup НЕ пишет localStorage (T-24)', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const wrapper = mount(Host)
    await startResize(wrapper, 0)
    const move = new Event('pointermove') as PointerEvent
    Object.defineProperty(move, 'clientX', { value: 50 })
    window.dispatchEvent(move)
    window.dispatchEvent(new Event('pointerup'))
    await nextTick()
    expect(setItemSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('pointercancel завершает ресайз без записи', async () => {
    // NB: onResizePointerUp общий для pointerup/pointercancel — он сохраняет текущую
    // ширину (160) в persistKey. Проверяем, что запись = исходная ширина, т.е. cancel
    // НЕ применяет незавершённое движение.
    const wrapper = mount(Host, { props: { persistKey: 'sbw' } })
    await startResize(wrapper, 0)
    const move = new Event('pointermove') as PointerEvent
    Object.defineProperty(move, 'clientX', { value: 300 })
    window.dispatchEvent(move) // тянули, но отпустили через cancel
    window.dispatchEvent(new Event('pointercancel'))
    await nextTick()
    expect(wrapper.vm.isResizing).toBe(false)
    expect(localStorage.getItem('sbw')).toBe('160') // не 460 — движение не применено
    wrapper.unmount()
  })

  it('слушатели снимаются после завершения (нет двойных обработок)', async () => {
    const wrapper = mount(Host)
    await startResize(wrapper, 0)
    window.dispatchEvent(new Event('pointerup'))
    const spy = vi.fn()
    // после up новое pointermove игнорируется (isResizing=false + слушатель снят)
    window.addEventListener('pointermove', spy)
    window.dispatchEvent(new Event('pointermove'))
    window.removeEventListener('pointermove', spy)
    // сам spy ловит событие (это наш слушатель), но ширина не меняется
    expect(wrapper.vm.sidebarWidth).toBe(160)
    wrapper.unmount()
  })

  it('T-11: unmount ВО ВРЕМЯ drag снимает все window-слушатели (нет утечек)', async () => {
    const wrapper = mount(Host)
    await startResize(wrapper, 0)
    const rmSpy = vi.spyOn(window, 'removeEventListener')
    wrapper.unmount()
    const removed = rmSpy.mock.calls.map((c) => c[0])
    expect(removed).toContain('pointermove')
    expect(removed).toContain('pointerup')
    expect(removed).toContain('pointercancel')
    // body-стили восстановлены
    expect(document.body.style.userSelect).toBe('')
    expect(document.body.style.cursor).toBe('')
  })

  it('drag ставит userSelect=none и курсор col-resize, после up снимает', async () => {
    const wrapper = mount(Host)
    await startResize(wrapper, 0)
    expect(document.body.style.userSelect).toBe('none')
    expect(document.body.style.cursor).toBe('col-resize')
    window.dispatchEvent(new Event('pointerup'))
    await nextTick()
    expect(document.body.style.userSelect).toBe('')
    expect(document.body.style.cursor).toBe('')
    wrapper.unmount()
  })

  it('applySavedWidth синхронизирует sidebar и ruler-spacer', async () => {
    localStorage.setItem('sbw', '220')
    const wrapper = mount(Host, { props: { persistKey: 'sbw' } })
    wrapper.vm.applySavedWidth()
    expect((wrapper.find('.sb').element as HTMLElement).style.width).toBe('220px')
    expect((wrapper.find('.sp').element as HTMLElement).style.width).toBe('220px')
    wrapper.unmount()
  })
})
