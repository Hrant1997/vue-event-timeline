import { Ref } from 'vue';
import { default as dayjs } from 'dayjs';

export interface CurrentTimeApi {
    now: Ref<dayjs.Dayjs>;
    currentTimeX: Ref<number | null>;
}
/**
 * Тик «текущего времени» + позиция вертикальной линии (вынесено из Timeline.vue — T-06).
 * Интервал создаётся только при включённой опции; корректно снимается при unmount.
 */
export declare function useCurrentTime(viewStart: Ref<dayjs.Dayjs>, pxPerMin: Ref<number>, enabled: Ref<boolean>, tickMs?: number): CurrentTimeApi;
