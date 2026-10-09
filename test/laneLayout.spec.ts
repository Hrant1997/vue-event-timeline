import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { computeLaneLayout, laneGeometry } from '../src/utils/laneLayout'

const ev = (id: string | number, start: string, end: string) => ({
  id,
  start: dayjs(start),
  end: dayjs(end)
})

describe('T-29: computeLaneLayout — кластеры пересечений', () => {
  it('пустой список → пустая карта', () => {
    expect(computeLaneLayout([]).size).toBe(0)
  })

  it('одиночное событие — одна дорожка на всю высоту строки', () => {
    const m = computeLaneLayout([ev('a', '2026-10-09T09:00', '2026-10-09T10:00')])
    expect(m.get('a')).toEqual({ lane: 0, lanes: 1 })
    // геометрия: lanes=1 → слой занимает всю строку целиком
    expect(laneGeometry(0, 1, 40)).toEqual({ top: 0, height: 40 })
  })

  it('непересекающиеся события — по одному слою (lanes=1, lane=0)', () => {
    const m = computeLaneLayout([
      ev('a', '2026-10-09T09:00', '2026-10-09T10:00'),
      ev('b', '2026-10-09T10:00', '2026-10-09T11:00')
    ])
    // касание границами (end === start) пересечением НЕ считается
    expect(m.get('a')).toEqual({ lane: 0, lanes: 1 })
    expect(m.get('b')).toEqual({ lane: 0, lanes: 1 })
  })

  it('два пересекающихся — разные lane, общий lanes=2', () => {
    const m = computeLaneLayout([
      ev('a', '2026-10-09T09:00', '2026-10-09T10:30'),
      ev('b', '2026-10-09T10:00', '2026-10-09T11:00')
    ])
    expect(m.get('a')).toEqual({ lane: 0, lanes: 2 })
    expect(m.get('b')).toEqual({ lane: 1, lanes: 2 })
  })

  it('жадный reuse: непересекающиеся внутри одного кластера делят lane 0', () => {
    // a и c не пересекаются, но обе пересекают b → один кластер из 2 дорожек
    const m = computeLaneLayout([
      ev('a', '2026-10-09T09:00', '2026-10-09T10:00'),
      ev('b', '2026-10-09T09:30', '2026-10-09T11:30'),
      ev('c', '2026-10-09T11:00', '2026-10-09T12:00')
    ])
    expect(m.get('a')).toEqual({ lane: 0, lanes: 2 })
    expect(m.get('b')).toEqual({ lane: 1, lanes: 2 })
    expect(m.get('c')).toEqual({ lane: 0, lanes: 2 }) // вернулась на освободившуюся дорожку
  })

  it('транзитивный кластер: цепочка перекрытий остаётся одним кластером', () => {
    // a∩b, b∩c, но a∩c = ∅ — всё равно один кластер (через b)
    const m = computeLaneLayout([
      ev('a', '2026-10-09T09:00', '2026-10-09T10:00'),
      ev('b', '2026-10-09T09:45', '2026-10-09T10:45'),
      ev('c', '2026-10-09T10:30', '2026-10-09T11:30')
    ])
    expect(m.get('a')!.lanes).toBe(2)
    expect(m.get('b')!.lanes).toBe(2)
    expect(m.get('c')!.lane).toBe(0) // a к этому времени уже завершилась
    expect(m.get('c')!.lanes).toBe(2)
  })

  it('несколько независимых кластеров считаются изолированно', () => {
    const m = computeLaneLayout([
      ev('a', '2026-10-09T09:00', '2026-10-09T10:00'),
      ev('b', '2026-10-09T09:30', '2026-10-09T10:30'),
      ev('c', '2026-10-09T14:00', '2026-10-09T15:00'),
      ev('d', '2026-10-09T14:30', '2026-10-09T15:30'),
      ev('e', '2026-10-09T14:45', '2026-10-09T15:45')
    ])
    expect(m.get('a')).toEqual({ lane: 0, lanes: 2 })
    expect(m.get('b')).toEqual({ lane: 1, lanes: 2 })
    expect(m.get('c')).toEqual({ lane: 0, lanes: 3 })
    expect(m.get('d')).toEqual({ lane: 1, lanes: 3 })
    expect(m.get('e')).toEqual({ lane: 2, lanes: 3 })
  })

  it('полное вложение: длинное базовое событие остаётся на lane 0', () => {
    const m = computeLaneLayout([
      ev('long', '2026-10-09T09:00', '2026-10-09T17:00'),
      ev('s1', '2026-10-09T09:30', '2026-10-09T10:00'),
      ev('s2', '2026-10-09T10:30', '2026-10-09T11:00')
    ])
    expect(m.get('long')).toEqual({ lane: 0, lanes: 2 })
    expect(m.get('s1')).toEqual({ lane: 1, lanes: 2 })
    expect(m.get('s2')).toEqual({ lane: 1, lanes: 2 }) // s1 завершилась — дорожка свободна
  })

  it('вход без сортировки обрабатывается корректно', () => {
    const m = computeLaneLayout([
      ev('b', '2026-10-09T10:00', '2026-10-09T11:00'),
      ev('a', '2026-10-09T09:00', '2026-10-09T10:30')
    ])
    expect(m.get('a')).toEqual({ lane: 0, lanes: 2 })
    expect(m.get('b')).toEqual({ lane: 1, lanes: 2 })
  })

  it('вырожденное событие (end < start) не ломает раскладку', () => {
    // bad схлопывается в точку 09:00; ok начинается позже clusterEnd → новый кластер,
    // каждое событие на своей lane 0 своего кластера (lanes по 1)
    const m = computeLaneLayout([
      ev('bad', '2026-10-09T09:00', '2026-10-09T08:00'),
      ev('ok', '2026-10-09T09:30', '2026-10-09T10:00')
    ])
    expect(m.get('bad')).toEqual({ lane: 0, lanes: 1 })
    expect(m.get('ok')).toEqual({ lane: 0, lanes: 1 })
  })

  it('вырожденное событие внутри чужого интервала получает отдельную дорожку', () => {
    // bad — точка 09:30 внутри a..b; должна появиться третья дорожка
    const m = computeLaneLayout([
      ev('a', '2026-10-09T09:00', '2026-10-09T10:00'),
      ev('b', '2026-10-09T09:15', '2026-10-09T10:15'),
      ev('bad', '2026-10-09T09:30', '2026-10-09T09:00')
    ])
    expect(m.get('a')).toEqual({ lane: 0, lanes: 3 })
    expect(m.get('b')).toEqual({ lane: 1, lanes: 3 })
    expect(m.get('bad')).toEqual({ lane: 2, lanes: 3 })
  })
})

describe('T-29: laneGeometry', () => {
  it('одна дорожка (lanes=1) — слой занимает всю высоту строки', () => {
    const g = laneGeometry(0, 1, 40)
    expect(g).toEqual({ top: 0, height: 40 })
  })

  it('два слоя в строке 40px — 20px каждый, без зазоров', () => {
    expect(laneGeometry(0, 2, 40)).toEqual({ top: 0, height: 20 })
    expect(laneGeometry(1, 2, 40)).toEqual({ top: 20, height: 20 })
  })

  it('три слоя в строке 40px — срабатывает minLaneHeight (16 > floor(40/3)=13)', () => {
    // защита читаемости: слои не тоньше 16px, даже если формально влезают меньше
    expect(laneGeometry(0, 3, 40)).toEqual({ top: 0, height: 16 })
    expect(laneGeometry(2, 3, 40)).toEqual({ top: 32, height: 16 })
  })

  it('ровное деление без min-ограничения: 6 слоёв по 80px → 16px', () => {
    expect(laneGeometry(0, 5, 80)).toEqual({ top: 0, height: 16 })
    expect(laneGeometry(4, 5, 80)).toEqual({ top: 64, height: 16 })
  })

  it('minLaneHeight защищает читаемость: слои не тоньше порога', () => {
    // rowHeight 40, lanes 5 → floor(40/5)=8 < 16 → высота 16, ряд прокручивается визуально
    const g = laneGeometry(0, 5, 40)
    expect(g.height).toBe(16)
    expect(g.top).toBe(0)
    const last = laneGeometry(4, 5, 40)
    expect(last.top).toBe(64) // выход за пределы строки — ожидаемо при экстремальном overlap
  })

  it('rowHeight масштабирует слои (T-30 совместимо)', () => {
    expect(laneGeometry(1, 2, 80)).toEqual({ top: 40, height: 40 })
  })
})
