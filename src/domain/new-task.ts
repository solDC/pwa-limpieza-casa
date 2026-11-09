// US-33 · Añadir una tarea: qué hace falta para guardarla. TypeScript puro.
// US-34 · Elegir el peso de las partes.

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
  /** El peso de cada parte, en %: lo escrito en su campo. */
  partWeights: string[]
  /**
   * Si se ha cambiado algún peso a mano. Mientras no, al añadir o quitar partes los pesos
   * se vuelven a repartir a partes iguales; después, ya no, para no perder lo puesto.
   */
  weightsEdited: boolean
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
  partWeights?: (string | undefined)[]
  weightsTotal?: string
}

export function emptyDraft(): NewTaskDraft {
  return {
    name: '',
    frequencyKind: null,
    intervalDays: '',
    biweeklyStartOn: null,
    partNames: [],
    partWeights: [],
    weightsEdited: false,
  }
}

/** Añade una parte sin nombre. Si no se ha cambiado ningún peso, se reparten de nuevo. */
export function addPart(draft: NewTaskDraft): NewTaskDraft {
  const partNames = [...draft.partNames, '']
  const partWeights = draft.weightsEdited
    ? [...draft.partWeights, '0']
    : equalWeights(partNames.length).map(String)
  return { ...draft, partNames, partWeights }
}

/** Quita una parte. Si no se ha cambiado ningún peso, se reparten de nuevo. */
export function removePart(draft: NewTaskDraft, index: number): NewTaskDraft {
  const partNames = draft.partNames.filter((_, i) => i !== index)
  const partWeights = draft.weightsEdited
    ? draft.partWeights.filter((_, i) => i !== index)
    : equalWeights(partNames.length).map(String)
  return { ...draft, partNames, partWeights }
}

export function renamePart(draft: NewTaskDraft, index: number, name: string): NewTaskDraft {
  return { ...draft, partNames: draft.partNames.map((partName, i) => (i === index ? name : partName)) }
}

/** Cambia el peso de una parte: desde entonces, los pesos ya no se reparten solos. */
export function setPartWeight(draft: NewTaskDraft, index: number, weight: string): NewTaskDraft {
  return {
    ...draft,
    partWeights: draft.partWeights.map((current, i) => (i === index ? weight : current)),
    weightsEdited: true,
  }
}

/** Lo que suman los pesos escritos, para verlo mientras se escriben (lo que no vale, 0). */
export function weightsTotal(draft: NewTaskDraft): number {
  return draft.partWeights.reduce((total, weight) => total + (parseWeight(weight) ?? 0), 0)
}

/** Un peso válido: un número entero de 1 a 100. Si no, `null`. */
function parseWeight(text: string): number | null {
  const trimmed = text.trim()
  const weight = Number(trimmed)
  return /^\d+$/.test(trimmed) && weight >= 1 && weight <= 100 ? weight : null
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

  const weights = partNames.map((_, index) => parseWeight(draft.partWeights[index] ?? ''))
  const weightErrors = weights.map((weight) =>
    weight === null ? 'Escribe un peso de 1 a 100.' : undefined,
  )
  if (weightErrors.some(Boolean)) {
    errors.partWeights = weightErrors
  } else {
    // Solo si todos los pesos valen: si no, la suma no dice nada útil.
    const total = weightsTotal(draft)
    if (partNames.length > 0 && total !== 100) {
      errors.weightsTotal = `Los pesos tienen que sumar 100 % (ahora suman ${total} %).`
    }
  }

  if (Object.keys(errors).length > 0 || frequency === null) return { ok: false, errors }

  return {
    ok: true,
    task: {
      name,
      frequency,
      parts: partNames.map((partName, index) => ({ name: partName, weight: weights[index]! })),
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
