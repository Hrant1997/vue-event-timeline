/**
 * Тесты глобального i18n playground: смена языка, переводы, интерполяция,
 * fallback на en, синхронизация dayjs-локали и html[lang], реактивность UI.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, defineComponent, computed } from 'vue'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import 'dayjs/locale/de'
import 'dayjs/locale/fr'
import 'dayjs/locale/en'
import 'dayjs/locale/hy-am'
import {
  LANGUAGES,
  MESSAGES,
  currentLocale,
  setLocale,
  translate,
  useI18n,
  timelineDayjsLocale,
  dayjsLocaleFor,
} from '../playground/src/i18n'

/** Ключи, переопределённые в частичном hy-словаре (поверх базы en) */
const HY_OWN_KEYS = [
  'app.subtitle',
  'topbar.addEvent',
  'topbar.clear',
  'panel.settings',
  'panel.reset',
  'info.viewport',
  'info.none',
]

describe('playground i18n — словари и метаданные языков', () => {
  it('содержит все объявленные языки и только они имеют словари', () => {
    const codes = LANGUAGES.map((l) => l.code)
    expect(codes).toEqual(['en', 'ru', 'hy', 'de', 'fr'])
    for (const code of codes) {
      expect(MESSAGES[code], `dict for ${code}`).toBeTruthy()
    }
    expect(Object.keys(MESSAGES).sort()).toEqual([...codes].sort())
  })

  it('каждый язык имеет флаг (data URI), короткое имя и подсказку', () => {
    for (const l of LANGUAGES) {
      expect(l.flag.startsWith('data:image/svg+xml,')).toBe(true)
      expect(l.name.length).toBeGreaterThan(0)
      expect(l.title.length).toBeGreaterThan(0)
    }
  })

  it('ru полностью переведён: ключи ru покрывают ключи en', () => {
    const enKeys = Object.keys(MESSAGES.en)
    const ruKeys = Object.keys(MESSAGES.ru)
    expect(ruKeys).toEqual(expect.arrayContaining(enKeys))
  })

  it('частичные словари (hy/de/fr) наследуют en — ключи всегда резолвятся', () => {
    for (const code of ['hy', 'de', 'fr']) {
      setLocale(code)
      for (const key of Object.keys(MESSAGES.en)) {
        expect(translate(key).length, `${code}/${key}`).toBeGreaterThan(0)
      }
      // конкретный пример переопределения
      expect(MESSAGES[code]['panel.settings']).not.toBe(undefined)
    }
  })

  it('hy — частичный словарь: переопределены только собственные ключи, остальные равны en', () => {
    setLocale('hy')
    // hy = {...en, ...overrides}: все ключи присутствуют (fallback структурный)…
    expect(Object.keys(MESSAGES.hy).sort()).toEqual(Object.keys(MESSAGES.en).sort())
    // …но переведены лишь HY_OWN_KEYS, остальные физически равны en-значениям
    for (const key of HY_OWN_KEYS) {
      expect(MESSAGES.hy[key], `hy override ${key}`).not.toBe(MESSAGES.en[key])
    }
    const sameAsEn = Object.keys(MESSAGES.en).filter((k) => MESSAGES.hy[k] === MESSAGES.en[k])
    expect(sameAsEn.length + HY_OWN_KEYS.length).toBe(Object.keys(MESSAGES.en).length)
    // непереведённый ключ резолвится через en
    expect(translate('panel.minDuration')).toBe(MESSAGES.en['panel.minDuration'])
    // переведённые ключи берутся из hy
    expect(translate('panel.settings')).toBe(MESSAGES.hy['panel.settings'])
  })
})

describe('playground i18n — setLocale / translate', () => {
  beforeEach(() => {
    setLocale('en')
  })

  it('по умолчанию язык en', () => {
    expect(currentLocale.value).toBe('en')
  })

  it('setLocale меняет язык и возвращает true для поддерживаемых кодов', () => {
    for (const code of ['ru', 'de', 'fr', 'hy', 'en']) {
      expect(setLocale(code)).toBe(true)
      expect(currentLocale.value).toBe(code)
    }
  })

  it('setLocale игнорирует неизвестный код (язык остаётся прежним)', () => {
    setLocale('ru')
    expect(setLocale('xx')).toBe(false)
    expect(currentLocale.value).toBe('ru')
  })

  it('translate возвращает строки текущего языка', () => {
    setLocale('en')
    expect(translate('panel.settings')).toBe('Settings')
    setLocale('ru')
    expect(translate('panel.settings')).toBe('Настройки')
    setLocale('de')
    expect(translate('panel.settings')).toBe('Einstellungen')
    setLocale('fr')
    expect(translate('panel.settings')).toBe('Paramètres')
  })

  it('de — словарь на базе en: переопределённые ключи свои, остальные резолвятся как en', () => {
    setLocale('de')
    // de создан как {...en, ...overrides}: собственные переводы присутствуют…
    expect(MESSAGES.de['panel.settings']).toBe('Einstellungen')
    // …а непереведённый ключ физически равен en-копии и резолвится корректно
    expect(MESSAGES.de['panel.minDuration']).toBe(MESSAGES.en['panel.minDuration'])
    expect(translate('panel.minDuration')).toBe(MESSAGES.en['panel.minDuration'])
  })

  it('translate для неизвестного ключа возвращает сам ключ', () => {
    expect(translate('no.such.key')).toBe('no.such.key')
  })

  it('интерполяция токенов {n} / {v}', () => {
    setLocale('en')
    expect(translate('topbar.events', { n: 7 })).toBe('7 events')
    expect(translate('header.zoom', { v: 4 })).toBe('zoom 4')
    setLocale('ru')
    expect(translate('topbar.events', { n: 7 })).toBe('7 событий')
    expect(translate('panel.startZoom', { v: 2 })).toBe('Стартовый зум: 2 px/мин')
  })

  it('отсутствующий параметр интерполяции заменяется на пустую строку', () => {
    expect(translate('topbar.events')).toContain('{n}')
    expect(translate('topbar.events', {})).toBe(' events')
  })

  it('синхронизирует document.documentElement.lang при смене языка', () => {
    setLocale('ru')
    expect(document.documentElement.lang).toBe('ru')
    setLocale('de')
    expect(document.documentElement.lang).toBe('de')
    // неизвестный код не должен менять lang
    setLocale('xx')
    expect(document.documentElement.lang).toBe('de')
  })
})

describe('playground i18n — dayjs-локаль', () => {
  beforeEach(() => {
    setLocale('en')
    // изоляция от глобального состояния dayjs, которое меняют другие тесты/модули
    dayjs.locale('en')
  })

  it('dayjsLocaleFor: hy → hy-am, остальные без изменений', () => {
    expect(dayjsLocaleFor('hy')).toBe('hy-am')
    expect(dayjsLocaleFor('ru')).toBe('ru')
    expect(dayjsLocaleFor('en')).toBe('en')
    expect(dayjsLocaleFor('de')).toBe('de')
    expect(dayjsLocaleFor('fr')).toBe('fr')
  })

  it('timelineDayjsLocale реактивно наследует глобальный язык', () => {
    setLocale('ru')
    expect(timelineDayjsLocale.value).toBe('ru')
    setLocale('hy')
    expect(timelineDayjsLocale.value).toBe('hy-am')
  })

  it('локаль hy зарегистрирована под коротким кодом и даёт армянские месяцы', () => {
    // i18n регистрирует алиас 'hy' = 'hy-am'; Timeline может вызвать dayjs.locale('hy')
    const jan = new Date(2026, 0, 15)
    const d = dayjs(jan).locale('hy')
    expect(d.format('MMM')).toBe(dayjs(jan).locale('hy-am').format('MMM'))
    expect(d.format('MMM')).toContain('հնվ')
  })

  it('смена языка реально локализует даты (ru/de/fr)', () => {
    const jan = new Date(2026, 0, 15)
    // dayjs-локаль 'ru' даёт именительную форму в standalone-режиме ('январь')
    expect(dayjs(jan).locale('ru').format('MMMM')).toBe('январь')
    expect(dayjs(jan).locale('de').format('MMMM')).toBe('Januar')
    expect(dayjs(jan).locale('fr').format('MMMM')).toBe('janvier')
    // и сокращённую русскую форму для MMM (используется в линейке времени)
    expect(dayjs(jan).locale('ru').format('MMM')).toBe('янв.')
  })

  it('Timeline-путь: dayjs.locale(code) глобально переключает вывод дат', () => {
    const jan = new Date(2026, 0, 15)
    try {
      dayjs.locale(dayjsLocaleFor('ru'))
      expect(dayjs(jan).format('MMM YYYY')).toBe('янв. 2026')
      dayjs.locale(dayjsLocaleFor('hy'))
      expect(dayjs(jan).format('MMM YYYY')).toBe('հնվ 2026')
      dayjs.locale(dayjsLocaleFor('de'))
      expect(dayjs(jan).format('MMMM')).toBe('Januar')
    } finally {
      dayjs.locale('en')
    }
    expect(dayjs(jan).format('MMM YYYY')).toBe('Jan 2026')
  })
})

describe('playground i18n — useI18n composable', () => {
  beforeEach(() => setLocale('en'))

  it('t() читает текущий язык реактивно', () => {
    const { t, locale } = useI18n()
    expect(locale.value).toBe('en')
    expect(t('panel.reset')).toBe('Reset')
    setLocale('ru')
    expect(locale.value).toBe('ru')
    expect(t('panel.reset')).toBe('Сбросить')
  })

  it('setLocale из composables тот же, что модульный', () => {
    const { setLocale: s } = useI18n()
    expect(s).toBe(setLocale)
  })
})

describe('playground i18n — реактивный UI на смену языка', () => {
  const Probe = defineComponent({
    setup() {
      const { t, locale } = useI18n()
      const label = computed(() => t('panel.allowOverlap'))
      return { t, locale, label }
    },
    template: `<div><span class="lbl">{{ label }}</span><span class="loc">{{ locale }}</span></div>`,
  })

  beforeEach(() => setLocale('en'))

  it('компонент перерисовывается при смене глобального языка', async () => {
    const w = mount(Probe)
    expect(w.find('.lbl').text()).toBe('Allow overlap (global)')
    setLocale('ru')
    await nextTick()
    expect(w.find('.lbl').text()).toBe('Разрешить наложения (глобально)')
    expect(w.find('.loc').text()).toBe('ru')
    setLocale('fr')
    await nextTick()
    expect(w.find('.lbl').text()).toBe('Autoriser le chevauchement (global)')
    w.unmount()
  })
})
