// Тесты собственного формата даты тултипа («20 окт. 19:45») с переводами (локалями dayjs)
import { describe, it, expect, beforeEach } from 'vitest'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { ref, nextTick } from 'vue'
import { setLibraryTimezone, TOOLTIP_DATE_FORMAT, normalizeDayjsLocale, useFormattedTooltipDate } from '../src/utils/date'

beforeEach(() => {
  setLibraryTimezone(null)
})

describe('normalizeDayjsLocale', () => {
  it('берёт базовый подтег и приводит к нижнему регистру', () => {
    expect(normalizeDayjsLocale('ru-RU')).toBe('ru')
    expect(normalizeDayjsLocale('EN-us')).toBe('en')
    expect(normalizeDayjsLocale('de')).toBe('de')
  })

  it('пусто/undefined → en (fallback)', () => {
    expect(normalizeDayjsLocale(undefined)).toBe('en')
    expect(normalizeDayjsLocale('')).toBe('en')
    expect(normalizeDayjsLocale(null)).toBe('en')
  })
})

describe('TOOLTIP_DATE_FORMAT / useFormattedTooltipDate', () => {
  const sample = dayjs(new Date(2025, 9, 20, 19, 45)) // 20 октября 2025, 19:45

  it('формат "D MMM HH:mm" даёт «20 Oct 19:45» в en', () => {
    expect(sample.format(TOOLTIP_DATE_FORMAT)).toBe('20 Oct 19:45')
  })

  it('тот же формат в ru-локали даёт «20 окт. 19:45» (перевод месяца)', () => {
    expect(sample.locale('ru').format(TOOLTIP_DATE_FORMAT)).toBe('20 окт. 19:45')
  })

  it('composable форматирует реактивно и переключает локаль с переводом', async () => {
    const time = ref<dayjs.ConfigType>(sample)
    const locale = ref<string | undefined>('ru')
    const formatted = useFormattedTooltipDate(time, locale)

    await nextTick() // дождаться загрузки локали из watch(immediate)
    expect(formatted.value).toBe('20 окт. 19:45')

    locale.value = 'en'
    await nextTick()
    expect(formatted.value).toBe('20 Oct 19:45')
  })

  it('неизвестная локаль — fallback на en без падения', async () => {
    const locale = ref<string | undefined>('xx-YY')
    const formatted = useFormattedTooltipDate(ref<dayjs.ConfigType>(sample), locale)
    await nextTick()
    expect(formatted.value).toBe('20 Oct 19:45')
  })

  it('пустое значение → пустая строка', () => {
    const formatted = useFormattedTooltipDate(ref<dayjs.ConfigType>(null), ref<string | undefined>('ru'))
    expect(formatted.value).toBe('')
  })
})
