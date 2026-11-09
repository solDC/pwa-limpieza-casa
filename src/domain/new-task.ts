// US-33 · Añadir una tarea: qué hace falta para guardarla. TypeScript puro.

import { addDays, dayOfWeek } from './dates'
import type { Frequency, LocalDate } from './task'

/** Como mucho, para que cada parte cuente algo (los pesos son % enteros). */
export const MAX_PARTS = 20

/** Como en la base de datos (tasks y task_parts). */
const MAX_NAME_LENGTH = 80
const MAX_INTERVAL_DAYS = 365

/** Lo que se ha escrito en el formulario, tal cual. */
export type NewTaskDraft = {
  name: string
  frequencyKind: Frequency['kind'] | null
  /** Solo en «cada N días»: lo escrito en el campo. */
  intervalDays: string
  /** Solo en «fin de semana cada 15 días»: el sábado del primer finde. */
  biweeklyStartOn: LocalDate | null
  partNames: string[]
}

/** La tarea lista para guardar. */
export type NewTask = {
  name: string
  frequency: Frequency
  parts: { name: string; weight: number }[]
}

/** Qué falta, campo a campo (las partes, en su orden). */
export type NewTaskErrors = {
  name?: string
  frequency?: string
  intervalDays?: string
  biweeklyStartOn?: string
  parts?: (string | undefined)[]
}

export function emptyDraft(): NewTaskDraft {
  return { name: '', frequencyKind: null, intervalDays: '', biweeklyStartOn: null, partNames: [] }
}

/**
 * Los pesos de `count` partes que cuentan lo mismo, en % enteros que suman 100: si no se
 * reparte justo, las primeras llevan un punto más (3 partes: 34, 33 y 33).
 */
export function equalWeights(count: number): number[] {
  const base = Math.floor(100 / count)
  const extra = 100 - base * count
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0))
}

/**
 * Los sábados de los dos próximos fines de semana, para elegir el primero de una tarea de
 * «cada 15 días». En sábado o domingo, el primero es ese mismo finde.
 */
export function nextWeekends(today: LocalDate): [LocalDate, LocalDate] {
  const day = dayOfWeek(today) // 0 = domingo … 6 = sábado
  const first = day === 0 ? addDays(today, -1) : addDays(today, 6 - day)
  return [first, addDays(first, 7)]
}

export function validateNewTask(
  draft: NewTaskDraft,
): { ok: true; task: NewTask } | { ok: false; errors: NewTaskErrors } {
  const errors: NewTaskErrors = {}

  const name = draft.name.trim()
  const nameError = nameProblem(name, 'Escribe el nombre de la tarea.')
  if (nameError) errors.name = nameError

  let frequency: Frequency | null = null
  switch (draft.frequencyKind) {
    case null:
      errors.frequency = 'Elige cada cuánto toca.'
      break
    case 'weekendWeekly':
      frequency = { kind: 'weekendWeekly' }
      break
    case 'weekendBiweekly':
      if (draft.biweeklyStartOn) {
        frequency = { kind: 'weekendBiweekly', startOn: draft.biweeklyStartOn }
      } else {
        errors.biweeklyStartOn = 'Elige el primer fin de semana.'
      }
      break
    case 'interval': {
      const text = draft.intervalDays.trim()
      const days = Number(text)
      if (/^\d+$/.test(text) && days >= 1 && days <= MAX_INTERVAL_DAYS) {
        frequency = { kind: 'interval', days }
      } else {
        errors.intervalDays = `Escribe cada cuántos días: de 1 a ${MAX_INTERVAL_DAYS}.`
      }
      break
    }
    case 'oneOff':
      frequency = { kind: 'oneOff' }
      break
  }

  const partNames = draft.partNames.map((partName) => partName.trim())
  const partErrors = partNames.map((partName) =>
    nameProblem(partName, 'Escribe el nombre de la parte o quítala.'),
  )
  if (partErrors.some(Boolean)) errors.parts = partErrors

  if (Object.keys(errors).length > 0 || frequency === null) return { ok: false, errors }

  const weights = equalWeights(partNames.length)
  return {
    ok: true,
    task: {
      name,
      frequency,
      parts: partNames.map((partName, index) => ({ name: partName, weight: weights[index] })),
    },
  }
}

function nameProblem(name: string, ifEmpty: string): string | undefined {
  if (name === '') return ifEmpty
  // Cuenta caracteres como la base de datos (un emoji es uno, no dos).
  if ([...name].length > MAX_NAME_LENGTH) {
    return `El nombre puede tener como mucho ${MAX_NAME_LENGTH} caracteres.`
  }
  return undefined
}
