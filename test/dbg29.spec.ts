import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import Timeline from '../src/components/Timeline.vue'
;(globalThis as any).ResizeObserver ??= class { observe(){} unobserve(){} disconnect(){} }

describe('dbg', () => {
  it('dbg', async () => {
    const base = dayjs().startOf('day')
    const events = [
      { id: 1, resourceId: 1, start: base.add(540,'minute'), end: base.add(630,'minute'), title: 'E1' },
      { id: 2, resourceId: 1, start: base.add(600,'minute'), end: base.add(660,'minute'), title: 'E2' },
    ]
    const w = mount(Timeline as any, { props: { events, resources: [{ id: 1, title: 'R1' }], rowHeight: 40, options: { allowOverlap: true } }, attachTo: document.body })
    ;(w.vm as any).__setView(base.add(360,'minute'))
    await w.vm.$nextTick()
    const vmRowStyle = (w.vm as any).rowStyle ? (w.vm as any).rowStyle(0) : 'no-rowStyle-exposed'
    console.log('DBG rowNeedHeight:', (w.vm as any).rowNeedHeight ? (w.vm as any).rowNeedHeight(0) : 'N/A')
    console.log('DBG maxLanesFor:', (w.vm as any).maxLanesFor ? (w.vm as any).maxLanesFor(1) : 'N/A')
    console.log('DBG rowStyle(0):', JSON.stringify(vmRowStyle))
    console.log('ROW ATTR:', JSON.stringify(w.find('.tl-row').attributes('style')))
    w.unmount()
  })
})
