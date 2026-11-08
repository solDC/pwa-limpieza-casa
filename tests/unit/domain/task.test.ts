import { describe, expect, it } from 'vitest'
import { describeFrequency } from '../../../src/domain/task'

describe('describeFrequency', () => {
  it('semanal, en fin de semana', () => {
    expect(describeFrequency({ kind: 'weekendWeekly' })).toBe('Semanal, en fin de semana')
  })

  it('fin de semana cada 15 días', () => {
    expect(describeFrequency({ kind: 'weekendBiweekly', startOn: '2026-12-05' })).toBe(
      'Fin de semana cada 15 días',
    )
  })

  it('cada N días desde la última vez', () => {
    expect(describeFrequency({ kind: 'interval', days: 3 })).toBe('Cada 3 días desde la última vez')
    expect(describeFrequency({ kind: 'interval', days: 30 })).toBe(
      'Cada 30 días desde la última vez',
    )
  })

  it('cada día, en singular', () => {
    expect(describeFrequency({ kind: 'interval', days: 1 })).toBe('Cada día desde la última vez')
  })

  it('puntual', () => {
    expect(describeFrequency({ kind: 'oneOff' })).toBe('Puntual')
  })
})
