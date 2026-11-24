import { describe, expect, it } from 'vitest'
import {
  changeFrequencyWeekends,
  frequencyDraftOf,
  validateFrequencyChange,
  withFrequencyChanged,
} from '../../../src/domain/change-frequency'
import { currentRound } from '../../../src/domain/frequency'
import type { Frequency, Task } from '../../../src/domain/task'

// US-53 · Cambiar cada cuánto toca una tarea (#93).
// Noviembre de 2026: el sábado 21, el domingo 22, el lunes 23.

const task = (frequency: Frequency, changes: Partial<Task> = {}): Task => ({
  id: 'task',
  householdId: 'home',
  name: 'Baño',
  defaultKey: null,
  frequency,
  parts: [],
  createdOn: '2026-11-01',
  frequencySince: '2026-11-01',
  cancelledOn: null,
  lastCompletedOn: null,
  partCompletions: [],
  ...changes,
})

const weekly: Frequency = { kind: 'weekendWeekly', startOn: null }
const every3: Frequency = { kind: 'interval', days: 3, nextDueOn: null }
const today = '2026-11-23'

describe('el formulario empieza con la frecuencia que tiene', () => {
  it('cada una con lo suyo', () => {
    expect(frequencyDraftOf(task(every3))).toMatchObject({ frequencyKind: 'interval', intervalDays: '3' })
    expect(frequencyDraftOf(task(weekly))).toMatchObject({ frequencyKind: 'weekendWeekly', intervalDays: '' })
    expect(
      frequencyDraftOf(task({ kind: 'weekendBiweekly', startOn: '2026-11-07' })),
    ).toMatchObject({ frequencyKind: 'weekendBiweekly', biweeklyStartOn: null })
    expect(frequencyDraftOf(task({ kind: 'oneOff', dueOn: '2026-12-01' }))).toMatchObject({
      frequencyKind: 'oneOff',
      dueOn: null,
    })
  })
})

describe('qué se guarda', () => {
  it('otra frecuencia, con lo que pide', () => {
    const draft = { ...frequencyDraftOf(task(every3)), frequencyKind: 'weekendWeekly' as const }
    expect(validateFrequencyChange(task(every3), draft, 'es', today)).toEqual({
      status: 'valid',
      frequency: { kind: 'weekendWeekly', startOn: null },
    })
  })

  it('solo el número de días', () => {
    const draft = { ...frequencyDraftOf(task(every3)), intervalDays: '5' }
    expect(validateFrequencyChange(task(every3), draft, 'es', today)).toEqual({
      status: 'valid',
      frequency: { kind: 'interval', days: 5, nextDueOn: null },
    })
  })

  it('a cada N días, sin fecha: la pone la base de datos', () => {
    const draft = { ...frequencyDraftOf(task(weekly)), frequencyKind: 'interval' as const, intervalDays: '7' }
    expect(validateFrequencyChange(task(weekly), draft, 'es', today)).toEqual({
      status: 'valid',
      frequency: { kind: 'interval', days: 7, nextDueOn: null },
    })
  })

  it('a puntual, con fecha opcional (hoy o un día futuro)', () => {
    const draft = { ...frequencyDraftOf(task(weekly)), frequencyKind: 'oneOff' as const, dueOn: '2026-11-22' }
    expect(validateFrequencyChange(task(weekly), draft, 'es', today)).toEqual({
      status: 'invalid',
      errors: { dueOn: 'Elige hoy o un día futuro.' },
    })
  })

  it('si falta lo que pide, lo dice, en el idioma elegido', () => {
    const draft = { ...frequencyDraftOf(task(weekly)), frequencyKind: 'interval' as const, intervalDays: '0' }
    expect(validateFrequencyChange(task(weekly), draft, 'en', today)).toEqual({
      status: 'invalid',
      errors: { intervalDays: 'Enter how many days: from 1 to 365.' },
    })
  })

  it('si no cambia nada, no hay nada que guardar', () => {
    for (const frequency of [weekly, every3, { kind: 'oneOff', dueOn: null } as Frequency]) {
      expect(validateFrequencyChange(task(frequency), frequencyDraftOf(task(frequency)), 'es', today)).toEqual({
        status: 'unchanged',
      })
    }
    const biweekly = task({ kind: 'weekendBiweekly', startOn: '2026-11-07' })
    expect(validateFrequencyChange(biweekly, frequencyDraftOf(biweekly), 'es', today)).toEqual({ status: 'unchanged' })
    // Los días, aunque se escriban de otra forma.
    expect(validateFrequencyChange(task(every3), { ...frequencyDraftOf(task(every3)), intervalDays: ' 3 ' }, 'es', today))
      .toEqual({ status: 'unchanged' })
  })

  it('una de cada 15 días con otro primer finde sí es un cambio (otro calendario)', () => {
    const biweekly = task({ kind: 'weekendBiweekly', startOn: '2026-11-07' })
    const draft = { ...frequencyDraftOf(biweekly), biweeklyStartOn: '2026-11-28' }
    expect(validateFrequencyChange(biweekly, draft, 'es', today)).toEqual({
      status: 'valid',
      frequency: { kind: 'weekendBiweekly', startOn: '2026-11-28' },
    })
  })
})

describe('los findes que se ofrecen para empezar una de cada 15 días', () => {
  it('los dos próximos, como al crearla', () => {
    const round = currentRound(task(every3), today)!
    expect(changeFrequencyWeekends(task(every3), round, today)).toEqual(['2026-11-28', '2026-12-05'])
  })

  it('en fin de semana, si la vuelta de este finde está a medias, desde el siguiente', () => {
    const halfDone = task(weekly, {
      parts: [
        { id: 'a', name: 'A', defaultKey: null, weight: 50 },
        { id: 'b', name: 'B', defaultKey: null, weight: 50 },
      ],
      partCompletions: [{ partId: 'a', startsOn: '2026-11-21' }],
    })
    const round = currentRound(halfDone, '2026-11-22')!
    expect(changeFrequencyWeekends(halfDone, round, '2026-11-22')).toEqual(['2026-11-28', '2026-12-05'])
    const untouched = task(weekly)
    expect(changeFrequencyWeekends(untouched, currentRound(untouched, '2026-11-22')!, '2026-11-22')).toEqual([
      '2026-11-21',
      '2026-11-28',
    ])
  })
})

describe('la tarea, ya cambiada', () => {
  it('con la frecuencia nueva, desde el día que dice la base de datos', () => {
    const changed = withFrequencyChanged(task(weekly), { kind: 'interval', days: 7, nextDueOn: null }, today, '2026-11-23')
    expect(changed.frequency).toEqual({ kind: 'interval', days: 7, nextDueOn: '2026-11-23' })
    expect(changed.frequencySince).toBe(today)
  })

  it('una de cada N días nunca hecha toca desde el día del cambio, sin retraso', () => {
    const changed = withFrequencyChanged(task(weekly), { kind: 'interval', days: 7, nextDueOn: null }, today, null)
    expect(currentRound(changed, today)).toEqual({ startsOn: today, dueBy: null })
  })

  it('una de fin de semana cambiada entre semana empieza el finde siguiente, sin retraso', () => {
    const changed = withFrequencyChanged(task(every3), weekly, today, null)
    expect(currentRound(changed, today)).toEqual({ startsOn: '2026-11-28', dueBy: '2026-12-04' })
  })

  it('una puntual hecha con la frecuencia de antes no cuenta como hecha', () => {
    const done = task(every3, { lastCompletedOn: '2026-11-20' })
    const changed = withFrequencyChanged(done, { kind: 'oneOff', dueOn: null }, today, null)
    expect(currentRound(changed, today)).toEqual({ startsOn: null, dueBy: null })
  })
})
