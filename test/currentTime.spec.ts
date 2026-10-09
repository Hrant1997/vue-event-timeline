// Жёсткие unit-тесты на src/composables/useCurrentTime.ts (T-06, T-11)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import { useCurrentTime } from '../src/composables/useCurrentTime'
import { setLibraryTimezone } from '../src/utils/date'

beforeEach(() => {
  setLibraryTimezone(null)
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function mountTime(opts: { enabled?: boolean; tickMs?: number } = {}) {
  const viewStart = ref(dayjs('2026-10-09T00:00:00'))
  const pxPerMin = ref(2)
  const enabled = ref(opts.enabled ?? true)
  const Host = defineComponent({
    setup() {
      return { ...useCurrentTime(viewStart, pxPerMin, enabled, opts.tickMs), viewStart, pxPerMin, enabled }
    },
    render: () => h('div'),
  })
  const wrapper = mount(Host)
  return { wrapper, viewStart, pxPerMin, enabled }
}

describe('useCurrentTime', () => {
  it('enabled=true создаёт интервал, now тикает каждые tickMs', async () => {
    const { wrapper } = mountTime({ tickMs: 1000 })
    const t0 = wrapper.vm.now.valueOf()
    vi.advanceTimersByTime(3500)
    await nextTick()
    expect(wrapper.vm.now.valueOf()).toBe(t0 + 3000) // ровно 3 тика
    wrapper.unmount()
  })

  it('enabled=false НЕ создаёт интервал — линия времени выключена', async () => {
    const spy = vi.spyOn(window, 'setInterval')
    const { wrapper } = mountTime({ enabled: false })
    expect(spy).not.toHaveBeenCalled()
    expect(wrapper.vm.currentTimeX).toBeNull()
    wrapper.unmount()
  })

  it('переключение enabled запускает/останавливает тикер без утечек', async () => {
    const { wrapper, enabled } = mountTime({ enabled: false, tickMs: 1000 })
    enabled.value = true
    await nextTick()
    const t0 = wrapper.vm.now.valueOf()
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(wrapper.vm.now.valueOf()).toBe(t0 + 2000)

    enabled.value = false
    await nextTick()
    const tStop = wrapper.vm.now.valueOf()
    vi.advanceTimersByTime(5000)
    await nextTick()
    expect(wrapper.vm.now.valueOf()).toBe(tStop) // больше не тикает
    wrapper.unmount()
  })

  it('currentTimeX = минуты от viewStart * pxPerMin (линия в нужной позиции)', async () => {
    vi.setSystemTime(dayjs('2026-10-09T10:30:00').valueOf())
    const { wrapper, pxPerMin } = mountTime({ tickMs: 60_000 })
    expect(wrapper.vm.currentTimeX).toBeCloseTo(630 * 2, 0) // 10:30 = 630 мин
    pxPerMin.value = 4
    await nextTick()
    expect(wrapper.vm.currentTimeX).toBeCloseTo(630 * 4, 0)
    wrapper.unmount()
  })

  it('unmount снимает интервал (нет работы таймера после уничтожения)', async () => {
    const { wrapper } = mountTime({ tickMs: 1000 })
    const before = wrapper.vm.now.valueOf()
    wrapper.unmount()
    vi.advanceTimersByTime(5000)
    await nextTick()
    expect(wrapper.vm.now.valueOf()).toBe(before) // тикер мёртв
  })

  it('несколько инстансов независимы (два таймлайна на странице)', async () => {
    const a = mountTime({ tickMs: 1000 })
    const b = mountTime({ tickMs: 500 })
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(a.wrapper.vm.now.diff(b.wrapper.vm.now, 'second')).toBeLessThanOrEqual(1)
    a.wrapper.unmount()
    const bt = b.wrapper.vm.now.valueOf()
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(b.wrapper.vm.now.valueOf()).toBe(bt + 1000) // b жив после unmount a
    b.wrapper.unmount()
  })
})
