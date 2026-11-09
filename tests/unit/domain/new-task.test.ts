import { describe, expect, it } from 'vitest'
import {
  emptyDraft,
  equalWeights,
  MAX_PARTS,
  nextWeekends,
  validateNewTask,
  type NewTaskDraft,
} from '../../../src/domain/new-task'

// US-33 · Añadir una tarea (#42)

describe('equalWeights: las partes cuentan lo mismo y suman 100', () => {
  it('sin partes, ningún peso', () => {
    expect(equalWeights(0)).toEqual([])
  })

  it('si el 100 se reparte justo, todas igual', () => {
    expect(equalWeights(1)).toEqual([100])
    expect(equalWeights(2)).toEqual([50, 50])
    expect(equalWeights(4)).toEqual([25, 25, 25, 25])
  })

  it('si no, las primeras llevan un punto más, lo justo para sumar 100', () => {
    expect(equalWeights(3)).toEqual([34, 33, 33])
    expect(equalWeights(6)).toEqual([17, 17, 17, 17, 16, 16])
  })

  it('siempre suman 100, también con el máximo de partes', () => {
    for (let count = 1; count <= MAX_PARTS; count++) {
      const weights = equalWeights(count)
      expect(weights).toHaveLength(count)
      expect(weights.reduce((sum, weight) => sum + weight, 0)).toBe(100)
      expect(Math.max(...weights) - Math.min(...weights)).toBeLessThanOrEqual(1)
    }
  })
})

describe('nextWeekends: los dos fines de semana que se pueden elegir para empezar', () => {
  it('de lunes a viernes, los dos sábados siguientes', () => {
    expect(nextWeekends('2026-11-09')).toEqual(['2026-11-14', '2026-11-21']) // lunes
    expect(nextWeekends('2026-11-13')).toEqual(['2026-11-14', '2026-11-21']) // viernes
  })

  it('en sábado o domingo, el primero es ese mismo finde', () => {
    expect(nextWeekends('2026-11-14')).toEqual(['2026-11-14', '2026-11-21']) // sábado
    expect(nextWeekends('2026-11-15')).toEqual(['2026-11-14', '2026-11-21']) // domingo
  })

  it('cruza el cambio de año', () => {
    expect(nextWeekends('2026-12-28')).toEqual(['2027-01-02', '2027-01-09'])
  })
})

describe('validateNewTask: qué hace falta para guardar una tarea', () => {
  const draft = (changes: Partial<NewTaskDraft>): NewTaskDraft => ({
    ...emptyDraft(),
    name: 'Regar las plantas',
    frequencyKind: 'interval',
    intervalDays: '7',
    ...changes,
  })

  it('con nombre y frecuencia, vale, sin espacios de más', () => {
    expect(validateNewTask(draft({ name: '  Regar las plantas ' }))).toEqual({
      ok: true,
      task: {
        name: 'Regar las plantas',
        frequency: { kind: 'interval', days: 7 },
        parts: [],
      },
    })
  })

  it('sin nombre no vale', () => {
    expect(validateNewTask(draft({ name: '   ' }))).toEqual({
      ok: false,
      errors: { name: 'Escribe el nombre de la tarea.' },
    })
  })

  it('con un nombre de más de 80 caracteres no vale', () => {
    expect(validateNewTask(draft({ name: 'a'.repeat(80) })).ok).toBe(true)
    expect(validateNewTask(draft({ name: 'a'.repeat(81) }))).toEqual({
      ok: false,
      errors: { name: 'El nombre puede tener como mucho 80 caracteres.' },
    })
  })

  it('sin frecuencia no vale', () => {
    expect(validateNewTask(draft({ frequencyKind: null }))).toEqual({
      ok: false,
      errors: { frequency: 'Elige cada cuánto toca.' },
    })
  })

  it('las cuatro frecuencias', () => {
    const frequencyOf = (changes: Partial<NewTaskDraft>) => {
      const result = validateNewTask(draft(changes))
      return result.ok ? result.task.frequency : result.errors
    }
    expect(frequencyOf({ frequencyKind: 'weekendWeekly' })).toEqual({ kind: 'weekendWeekly' })
    expect(
      frequencyOf({ frequencyKind: 'weekendBiweekly', biweeklyStartOn: '2026-11-14' }),
    ).toEqual({ kind: 'weekendBiweekly', startOn: '2026-11-14' })
    expect(frequencyOf({ frequencyKind: 'interval', intervalDays: '30' })).toEqual({
      kind: 'interval',
      days: 30,
    })
    expect(frequencyOf({ frequencyKind: 'oneOff' })).toEqual({ kind: 'oneOff' })
  })

  it('«cada N días» necesita un número de días entero, de 1 a 365', () => {
    const error = { ok: false, errors: { intervalDays: 'Escribe cada cuántos días: de 1 a 365.' } }
    for (const intervalDays of ['', '0', '366', '2.5', 'tres', '-3']) {
      expect(validateNewTask(draft({ intervalDays }))).toEqual(error)
    }
    expect(validateNewTask(draft({ intervalDays: ' 365 ' })).ok).toBe(true)
  })

  it('«cada 15 días» necesita su primer fin de semana', () => {
    expect(validateNewTask(draft({ frequencyKind: 'weekendBiweekly' }))).toEqual({
      ok: false,
      errors: { biweeklyStartOn: 'Elige el primer fin de semana.' },
    })
  })

  it('las partes son opcionales; si las hay, cuentan lo mismo', () => {
    expect(validateNewTask(draft({ partNames: [' Cocina ', 'Baño', 'Salón'] }))).toMatchObject({
      ok: true,
      task: {
        parts: [
          { name: 'Cocina', weight: 34 },
          { name: 'Baño', weight: 33 },
          { name: 'Salón', weight: 33 },
        ],
      },
    })
  })

  it('una parte sin nombre no vale: dice cuál', () => {
    expect(validateNewTask(draft({ partNames: ['Cocina', '  ', 'Salón'] }))).toEqual({
      ok: false,
      errors: { parts: [undefined, 'Escribe el nombre de la parte o quítala.', undefined] },
    })
  })

  it('una parte de más de 80 caracteres no vale', () => {
    expect(validateNewTask(draft({ partNames: ['a'.repeat(81)] }))).toEqual({
      ok: false,
      errors: { parts: ['El nombre puede tener como mucho 80 caracteres.'] },
    })
  })

  it('dice todo lo que falta a la vez', () => {
    expect(validateNewTask(draft({ name: '', frequencyKind: null, partNames: [''] }))).toEqual({
      ok: false,
      errors: {
        name: 'Escribe el nombre de la tarea.',
        frequency: 'Elige cada cuánto toca.',
        parts: ['Escribe el nombre de la parte o quítala.'],
      },
    })
  })
})

describe('validateNewTask: cuenta los caracteres como la base de datos', () => {
  it('un emoji cuenta como un carácter', () => {
    const result = validateNewTask({
      ...emptyDraft(),
      name: '🧽'.repeat(80),
      frequencyKind: 'oneOff',
    })
    expect(result.ok).toBe(true)
  })
})
