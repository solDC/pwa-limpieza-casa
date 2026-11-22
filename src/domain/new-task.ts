// US-33 · Añadir una tarea: qué hace falta para guardarla. TypeScript puro.
// US-34 · Elegir el peso de las partes.
// US-38 y US-50 · El día en que toca: la fecha de una puntual o la primera vez de una de cada N días.

import { addDays, dayOfWeek } from './dates'
import type { Language } from './language'
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
  /**
   * Solo en «cada N días» (US-50): el día en que toca la primera vez. `null`, sin cambiar
   * (hoy); '', el campo vacío.
   */
  firstDueOn: LocalDate | null
  /** Solo en «fin de semana cada 15 días»: el sábado del primer finde. */
  biweeklyStartOn: LocalDate | null
  /** Solo en las puntuales, y opcional (US-38): el día en que tocan. */
  dueOn: LocalDate | null
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
  firstDueOn?: string
  biweeklyStartOn?: string
  dueOn?: string
  parts?: (string | undefined)[]
  partWeights?: (string | undefined)[]
  weightsTotal?: string
}

export function emptyDraft(): NewTaskDraft {
  return {
    name: '',
    frequencyKind: null,
    intervalDays: '',
    firstDueOn: null,
    biweeklyStartOn: null,
    dueOn: null,
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

/**
 * Quita una parte. Si no se ha cambiado ningún peso, se reparten de nuevo. Sin partes, ya
 * no queda ningún peso que conservar: vuelven a repartirse solos.
 */
export function removePart(draft: NewTaskDraft, index: number): NewTaskDraft {
  const partNames = draft.partNames.filter((_, i) => i !== index)
  const weightsEdited = draft.weightsEdited && partNames.length > 0
  const partWeights = weightsEdited
    ? draft.partWeights.filter((_, i) => i !== index)
    : equalWeights(partNames.length).map(String)
  return { ...draft, partNames, partWeights, weightsEdited }
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

/** Un peso válido: un número entero de 1 a 100, con o sin «%» detrás. Si no, `null`. */
function parseWeight(text: string): number | null {
  const trimmed = text.trim().replace(/\s*%$/, '')
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

const VALIDATION_TEXTS = {
  es: {
    taskNameRequired: 'Escribe el nombre de la tarea.',
    frequencyRequired: 'Elige cada cuánto toca.',
    firstWeekendRequired: 'Elige el primer fin de semana.',
    intervalDays: (max: number) => `Escribe cada cuántos días: de 1 a ${max}.`,
    partNameRequired: 'Escribe el nombre de la parte o quítala.',
    weight: 'Escribe un peso de 1 a 100.',
    weightsTotal: (total: number) => `Los pesos tienen que sumar 100 % (ahora suman ${total} %).`,
    nameTooLong: (max: number) => `El nombre puede tener como mucho ${max} caracteres.`,
    dueOnNotPast: 'Elige hoy o un día futuro.',
    nextDueOnDoneToday: 'Ya está hecha hoy: elige mañana o un día futuro.',
  },
  en: {
    taskNameRequired: 'Enter the name of the task.',
    frequencyRequired: 'Choose how often it is due.',
    firstWeekendRequired: 'Choose the first weekend.',
    intervalDays: (max: number) => `Enter how many days: from 1 to ${max}.`,
    partNameRequired: 'Enter the name of the part or remove it.',
    weight: 'Enter a weight from 1 to 100.',
    weightsTotal: (total: number) =>
      `The weights must add up to 100 % (now they add up to ${total} %).`,
    nameTooLong: (max: number) => `The name can have at most ${max} characters.`,
    dueOnNotPast: 'Choose today or a later day.',
    nextDueOnDoneToday: 'Already done today: choose tomorrow or a later day.',
  },
} satisfies Record<Language, unknown>

/**
 * US-38 · Qué tiene de malo la fecha de una puntual, en el idioma `language`: solo vale
 * hoy o un día futuro. Sin fecha (`null`), nada. Sirve también al cambiarla después.
 */
export function dueOnError(
  dueOn: LocalDate | null,
  today: LocalDate,
  language: Language,
): string | undefined {
  if (dueOn === null) return undefined
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(dueOn) && dueOn >= today
  return valid ? undefined : VALIDATION_TEXTS[language].dueOnNotPast
}

/**
 * US-41 · El primer día que se puede elegir para la próxima vez en una de cada N días: hoy
 * o, si ya se ha hecho hoy, mañana (no se puede marcar dos veces el mismo día).
 */
export function earliestNextDueOn(today: LocalDate, lastCompletedOn: LocalDate | null): LocalDate {
  return lastCompletedOn === today ? addDays(today, 1) : today
}

/**
 * US-41 · El aviso del día elegido para la próxima vez en una de cada N días, o `undefined`
 * si vale. Siempre hace falta uno ('' es sin día), desde `earliestNextDueOn()`.
 */
export function nextDueOnError(
  nextDueOn: LocalDate,
  today: LocalDate,
  lastCompletedOn: LocalDate | null,
  language: Language,
): string | undefined {
  // Si ya se ha hecho hoy, el primer día que vale es mañana: con cualquier día anterior, o
  // sin día, se dice eso.
  if (lastCompletedOn === today) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(nextDueOn) && nextDueOn > today
    return valid ? undefined : VALIDATION_TEXTS[language].nextDueOnDoneToday
  }
  return dueOnError(nextDueOn, today, language)
}

/**
 * Comprueba el formulario. Los avisos de lo que falta salen en el idioma `language`;
 * `today` es para la fecha de las puntuales y la primera vez de las de cada N días.
 */
export function validateNewTask(
  draft: NewTaskDraft,
  language: Language,
  today: LocalDate,
): { ok: true; task: NewTask } | { ok: false; errors: NewTaskErrors } {
  const text = VALIDATION_TEXTS[language]
  const errors: NewTaskErrors = {}

  const name = draft.name.trim()
  const nameError = nameProblem(name, text.taskNameRequired, text.nameTooLong)
  if (nameError) errors.name = nameError

  let frequency: Frequency | null = null
  switch (draft.frequencyKind) {
    case null:
      errors.frequency = text.frequencyRequired
      break
    case 'weekendWeekly':
      frequency = { kind: 'weekendWeekly' }
      break
    case 'weekendBiweekly':
      if (draft.biweeklyStartOn) {
        frequency = { kind: 'weekendBiweekly', startOn: draft.biweeklyStartOn }
      } else {
        errors.biweeklyStartOn = text.firstWeekendRequired
      }
      break
    case 'interval': {
      const written = draft.intervalDays.trim()
      const days = Number(written)
      const validDays = /^\d+$/.test(written) && days >= 1 && days <= MAX_INTERVAL_DAYS
      if (!validDays) errors.intervalDays = text.intervalDays(MAX_INTERVAL_DAYS)
      // US-50 · Sin cambiar, toca hoy. Hoy es lo mismo que no elegir ningún día: una tarea
      // nueva de cada N días toca desde el día en que se crea.
      const firstDueOn = draft.firstDueOn ?? today
      const firstDueOnProblem = dueOnError(firstDueOn, today, language)
      if (firstDueOnProblem) errors.firstDueOn = firstDueOnProblem
      if (validDays && !firstDueOnProblem) {
        frequency = { kind: 'interval', days, nextDueOn: firstDueOn === today ? null : firstDueOn }
      }
      break
    }
    case 'oneOff': {
      const dueOnProblem = dueOnError(draft.dueOn, today, language)
      if (dueOnProblem) errors.dueOn = dueOnProblem
      else frequency = { kind: 'oneOff', dueOn: draft.dueOn }
      break
    }
  }

  const partNames = draft.partNames.map((partName) => partName.trim())
  const partErrors = partNames.map((partName) =>
    nameProblem(partName, text.partNameRequired, text.nameTooLong),
  )
  if (partErrors.some(Boolean)) errors.parts = partErrors

  const weights = partNames.map((_, index) => parseWeight(draft.partWeights[index] ?? ''))
  const weightErrors = weights.map((weight) =>
    weight === null ? text.weight : undefined,
  )
  if (weightErrors.some(Boolean)) {
    errors.partWeights = weightErrors
  } else {
    // Solo si todos los pesos valen: si no, la suma no dice nada útil.
    const total = weightsTotal(draft)
    if (partNames.length > 0 && total !== 100) {
      errors.weightsTotal = text.weightsTotal(total)
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

function nameProblem(
  name: string,
  ifEmpty: string,
  ifTooLong: (max: number) => string,
): string | undefined {
  if (name === '') return ifEmpty
  // Cuenta caracteres como la base de datos (un emoji es uno, no dos).
  if ([...name].length > MAX_NAME_LENGTH) return ifTooLong(MAX_NAME_LENGTH)
  return undefined
}
