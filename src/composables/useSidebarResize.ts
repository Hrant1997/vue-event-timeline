import { ref, onBeforeUnmount, type Ref } from 'vue'

export interface SidebarResizeApi {
  sidebarWidth: Ref<number>
  isResizing: Ref<boolean>
  sidebarRef: Ref<HTMLElement | null>
  rulerSpacerRef: Ref<HTMLElement | null>
  applySavedWidth: () => void
  onResizePointerDown: (e: PointerEvent) => void
}

const MIN_WIDTH = 100
const MAX_WIDTH = 500

/**
 * Ресайз сайдбара (вынесен из Timeline.vue — T-06).
 * Ширина хранится в localStorage под переданным ключом.
 */
export function useSidebarResize(storageKey = 'timeline-sidebar-width'): SidebarResizeApi {
  const readStored = (): number => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      const parsed = raw ? parseInt(raw, 10) : NaN
      return Number.isFinite(parsed) ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed)) : 160
    } catch {
      return 160 // SSR / приватный режим
    }
  }

  const sidebarWidth = ref(readStored())
  const isResizing = ref(false)
  const sidebarRef = ref<HTMLElement | null>(null)
  const rulerSpacerRef = ref<HTMLElement | null>(null)

  let startX = 0
  let startWidth = 0

  const setWidth = (w: number) => {
    if (sidebarRef.value) sidebarRef.value.style.width = `${w}px`
    if (rulerSpacerRef.value) rulerSpacerRef.value.style.width = `${w}px`
  }

  const applySavedWidth = () => setWidth(sidebarWidth.value)

  const onResizePointerMove = (e: PointerEvent) => {
    if (!isResizing.value) return
    e.preventDefault()
    setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + (e.clientX - startX))))
  }

  const onResizePointerUp = () => {
    isResizing.value = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''

    window.removeEventListener('pointermove', onResizePointerMove)
    window.removeEventListener('pointerup', onResizePointerUp)
    window.removeEventListener('pointercancel', onResizePointerUp)

    if (sidebarRef.value) {
      const w = parseInt(sidebarRef.value.style.width, 10)
      if (Number.isFinite(w)) {
        sidebarWidth.value = w
        try {
          window.localStorage.setItem(storageKey, String(w))
        } catch {
          /* ignore quota/SSR errors */
        }
      }
    }
  }

  const onResizePointerDown = (e: PointerEvent) => {
    e.preventDefault()
    isResizing.value = true
    startX = e.clientX
    startWidth = sidebarWidth.value

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    window.addEventListener('pointermove', onResizePointerMove, { passive: false })
    window.addEventListener('pointerup', onResizePointerUp)
    window.addEventListener('pointercancel', onResizePointerUp)
  }

  // T-11: гарантированная очистка слушателей при размонтировании во время drag
  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onResizePointerMove)
    window.removeEventListener('pointerup', onResizePointerUp)
    window.removeEventListener('pointercancel', onResizePointerUp)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  })

  return { sidebarWidth, isResizing, sidebarRef, rulerSpacerRef, applySavedWidth, onResizePointerDown }
}
