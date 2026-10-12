import { Ref } from 'vue';

export interface SidebarResizeApi {
    sidebarWidth: Ref<number>;
    isResizing: Ref<boolean>;
    sidebarRef: Ref<HTMLElement | null>;
    rulerSpacerRef: Ref<HTMLElement | null>;
    applySavedWidth: () => void;
    onResizePointerDown: (e: PointerEvent) => void;
}
/**
 * Ресайз сайдбара (вынесен из Timeline.vue — T-06).
 *
 * T-24: по умолчанию ширина НЕ сохраняется в localStorage (библиотека не
 * должна писать в хранилище потребителя без ведома — сюрприз + конфликт
 * имён ключей + поломка SSR). Опционально включается параметром persistKey.
 */
export declare function useSidebarResize(persistKey?: string): SidebarResizeApi;
