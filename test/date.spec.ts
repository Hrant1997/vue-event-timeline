// Жёсткие unit-тесты на src/utils/date.ts (T-12, T-26, T-27, T-33)
import { describe, it, expect, beforeEach } from 'vitest'
import dayjs from 'dayjs'
import {
  setLibraryTimezone,
  getLibraryTimezone,
  toTimelineDate,
  timelineToPickerDate,
  pickerToTimelineDate,
  normalizeEventChanges,
} from '../src/utils/date'

beforeEach(() => {
  setLibraryTimezone(null) // сброс пояса — детерминированные тесты
})

describe('setLibraryTimezone / getLibraryTimezone', () => {
  it('устанавливает IANA-пояс', () => {
    setLibraryTimezone('Europe/Amsterdam')
    expect(getLibraryTimezone()).toBe('Europe/Amsterdam')
  })

  it('null / пустая строка / пробелы = сброс на системный пояс', () => {
    setLibraryTimezone('Asia/Yerevan')
    setLibraryTimezone(null)
    expect(getLibraryTimezone()).toBeNull()

    setLibraryTimezone('Asia/Yerevan')
    setLibraryTimezone('')
    expect(getLibraryTimezone()).toBeNull()

    setLibraryTimezone('Asia/Yerevan')
    setLibraryTimezone('   ')
    expect(getLibraryTimezone()).toBeNull()
  })
})

describe('toTimelineDate (единая точка входа дат)', () => {
  it('без пояса: number-ms даёт тот же абсолютный момент', () => {
    const ms = dayjs('2026-10-09T12:34:56').valueOf()
    expect(toTimelineDate(ms).valueOf()).toBe(ms)
  })

  it('без пояса: string/Date/dayjs парсятся корректно', () => {
    expect(toTimelineDate('2026-10-09T12:34:56').format('YYYY-MM-DD HH:mm:ss')).toBe('2026-10-09 12:34:56')
    expect(toTimelineDate(new Date(2026, 9, 9, 12, 34, 56)).second()).toBe(56)
    const d = dayjs('2026-10-09T12:34:56')
    expect(toTimelineDate(d).valueOf()).toBe(d.valueOf())
  })

  it('null/undefined = текущее время (не валидируется как invalid)', () => {
    expect(toTimelineDate().isValid()).toBe(true)
    expect(toTimelineDate(null).isValid()).toBe(true)
    expect(toTimelineDate(undefined).isValid()).toBe(true)
  })

  it('с options.timezone: сохраняет АБСОЛЮТНЫЙ момент и меняет wall-clock (T-27)', () => {
    const ms = dayjs.utc('2026-10-09T10:00:00').valueOf()
    setLibraryTimezone('Europe/Amsterdam') // UTC+2 летом
    const d = toTimelineDate(ms)
    expect(d.valueOf()).toBe(ms) // момент не изменился
    expect(d.format('HH:mm')).toBe('12:00') // отображаемое время — по поясу таймлайна
    expect(d.utcOffset()).toBe(120)
  })

  it('startOf("day") в поясе библиотеки = полночь этого пояса (корень бага T-27)', () => {
    setLibraryTimezone('Australia/Sydney')
    // NB: в Sydney DST начинается 4 октября 2026 → 9 октября смещение +11 (AEDT)
    const ms = dayjs.utc('2026-10-08T20:00:00').valueOf() // = 2026-10-09 07:00 AEDT
    const day = toTimelineDate(ms).startOf('day')
    expect(day.format('YYYY-MM-DD HH:mm')).toBe('2026-10-09 00:00')
    // полночь Сиднея = 2026-10-08T13:00Z (смещение +11)
    expect(day.valueOf()).toBe(dayjs.utc('2026-10-08T13:00:00').valueOf())
  })
})

describe('timelineToPickerDate (dayjs -> Date для UI-picker)', () => {
  it('null/undefined -> null', () => {
    expect(timelineToPickerDate(null)).toBeNull()
    expect(timelineToPickerDate(undefined)).toBeNull()
    // NB: invalid dayjs НЕ обрабатывается — возвращает Invalid Date (зафиксированное поведение)
    expect((timelineToPickerDate(dayjs(null)) as Date).toString()).toBe('Invalid Date')
  })

  it('wall-clock поля Date = отображаемое время таймлайна (в т.ч. с поясом)', () => {
    const ms = dayjs.utc('2026-10-09T10:00:00').valueOf()
    setLibraryTimezone('Europe/Amsterdam')
    const d = toTimelineDate(ms)
    // NB: Amsterdam в октябре 2026 = CEST UTC+2 → отображается 12:00
    expect(d.format('HH:mm')).toBe('12:00')
    const p = timelineToPickerDate(d)!
    // picker показывает ровно то, что видно на линейке — независимо от пояса системы
    expect(p.getFullYear()).toBe(2026)
    expect(p.getMonth()).toBe(9)
    expect(p.getDate()).toBe(9)
    expect(p.getHours()).toBe(12)
    expect(p.getMinutes()).toBe(0)
  })
})

describe('pickerToTimelineDate (Date -> dayjs в поясе библиотеки)', () => {
  it('null/undefined -> null', () => {
    expect(pickerToTimelineDate(null)).toBeNull()
    expect(pickerToTimelineDate(undefined)).toBeNull()
  })

  it('принимает dayjs напрямую (защита от случайной передачи)', () => {
    const d = dayjs('2026-10-09T12:00:00')
    expect(pickerToTimelineDate(d)?.valueOf()).toBe(d.valueOf())
    setLibraryTimezone('Asia/Yerevan')
    // NB: dayjs .tz() без keepLocalTime сохраняет АБСОЛЮТНЫЙ момент, меняя wall-clock
    // (wall-clock-сохранение при передаче Date — через ISO-ветку с keepLocalTime)
    const r = pickerToTimelineDate(d)!
    expect(r.valueOf()).toBe(d.valueOf()) // момент сохранён
    expect(r.format('HH:mm')).not.toBe(d.format('HH:mm')) // отображение — по поясу таймлайна
  })

  it('round-trip timelineToPickerDate <-> pickerToTimelineDate идеален при любом поясе (секунды+мс)', () => {
    for (const tz of [null, 'UTC', 'Europe/Amsterdam', 'Asia/Yerevan', 'America/New_York', 'Pacific/Chatham'] as const) {
      setLibraryTimezone((tz ?? null) as string | null)
      // фиксируем ОТОБРАЖАЕМОЕ время как wall-clock — round-trip должен вернуть его 1-в-1
      const original = toTimelineDate(dayjs.tz('2026-10-09T12:34:56.789', tz ?? 'UTC').valueOf())
      expect(original.format('YYYY-MM-DD HH:mm:ss.SSS'), `tz=${tz} wall`).toBe('2026-10-09 12:34:56.789')
      const back = pickerToTimelineDate(timelineToPickerDate(original))!
      expect(back.format('YYYY-MM-DD HH:mm:ss.SSS'), `tz=${tz}`).toBe('2026-10-09 12:34:56.789')
      expect(back.valueOf(), `tz=${tz} момент`).toBe(original.valueOf())
    }
  })

  it('без пояса: wall-clock Date попадает в локальный пояс 1-в-1', () => {
    const d = new Date(2026, 9, 9, 8, 15, 30)
    const r = pickerToTimelineDate(d)!
    expect(r.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-10-09 08:15:30')
  })
})

describe('normalizeEventChanges (T-26)', () => {
  const ev = { start: dayjs('2026-10-09T10:00:00'), end: dayjs('2026-10-09T11:00:00') }

  it('частичные changes дополняются из события', () => {
    const onlyEnd = normalizeEventChanges(ev, { end: dayjs('2026-10-09T12:00:00') })
    expect(onlyEnd.start.isSame(ev.start)).toBe(true)
    expect(onlyEnd.end.format('HH:mm')).toBe('12:00')

    const onlyStart = normalizeEventChanges(ev, { start: dayjs('2026-10-09T09:00:00') })
    expect(onlyStart.start.format('HH:mm')).toBe('09:00')
    expect(onlyStart.end.isSame(ev.end)).toBe(true)
  })

  it('пустые changes возвращают исходный диапазон', () => {
    const r = normalizeEventChanges(ev, {})
    expect(r.start.isSame(ev.start)).toBe(true)
    expect(r.end.isSame(ev.end)).toBe(true)
  })
})
