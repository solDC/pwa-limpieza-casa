// US-33 · Añadir una tarea: qué hace falta para guardarla. TypeScript puro.
// US-34 · Elegir el peso de las partes.
// US-38 y US-50 · El día en que toca: la fecha de una puntual o la primera vez de una de cada N días.
// US-54 · Sin dos tareas con el mismo nombre, al crearlas y al renombrarlas.
// US-51 · Las partes y sus pesos, también al cambiarlas en una tarea que ya existe.

import { addDays } from './dates'
import { thisOrNextWeekend } from './frequency'
import type { Language } from './language'
import type { Frequency, LocalDate, Task } from './task'

/** Como mucho, para que cada parte cuente algo (los pesos son % enteros). */
export const MAX_PARTS = 20

/** Como en la base de datos (tasks y task_parts). */
const MAX_NAME_LENGTH = 80
const MAX_INTERVAL_DAYS = 365

/**
 * Las partes del formulario, tal cual se han escrito: las de una tarea nueva (US-33 y US-34)
 * y las de una que ya existe (US-51).
 */
export type PartsDraft = {
  partNames: string[]
  /** El peso de cada parte, en %: lo escrito en su campo. */
  partWeights: string[]
  /**
   * Si se ha cambiado algún peso a mano. Mientras no, al añadir o quitar partes los pesos
   * se vuelven a repartir a partes iguales; después, ya no, para no perder lo puesto.
   */
  weightsEdited: boolean
}

/** Qué falta en las partes, campo a campo (en su orden). */
export type PartsErrors = {
  parts?: (string | undefined)[]
  partWeights?: (string | undefined)[]
  weightsTotal?: string
}

/**
 * La frecuencia elegida en un formulario, tal cual: al crear una tarea (US-33) o al
 * cambiársela (US-53).
 */
export type FrequencyDraft = {
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
}

/** Qué falta en la frecuencia, campo a campo. */
export type FrequencyErrors = {
  frequency?: string
  intervalDays?: string
  firstDueOn?: string
  biweeklyStartOn?: string
  dueOn?: string
}

/** Lo que se ha escrito en el formulario, tal cual. */
export type NewTaskDraft = PartsDraft & FrequencyDraft & { name: string }

/** La tarea lista para guardar. */
export type NewTask = {
  name: string
  frequency: Frequency
  parts: { name: string; weight: number }[]
}

/** Qué falta, campo a campo (las partes, en su orden). */
export type NewTaskErrors = PartsErrors & FrequencyErrors & { name?: string }

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
export function addPart<T extends PartsDraft>(draft: T): T {
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
export function removePart<T extends PartsDraft>(draft: T, index: number): T {
  const partNames = draft.partNames.filter((_, i) => i !== index)
  const weightsEdited = draft.weightsEdited && partNames.length > 0
  const partWeights = weightsEdited
    ? draft.partWeights.filter((_, i) => i !== index)
    : equalWeights(partNames.length).map(String)
  return { ...draft, partNames, partWeights, weightsEdited }
}

export function renamePart<T extends PartsDraft>(draft: T, index: number, name: string): T {
  return { ...draft, partNames: draft.partNames.map((partName, i) => (i === index ? name : partName)) }
}

/** Cambia el peso de una parte: desde entonces, los pesos ya no se reparten solos. */
export function setPartWeight<T extends PartsDraft>(draft: T, index: number, weight: string): T {
  return {
    ...draft,
    partWeights: draft.partWeights.map((current, i) => (i === index ? weight : current)),
    weightsEdited: true,
  }
}

/** Lo que suman los pesos escritos, para verlo mientras se escriben (lo que no vale, 0). */
export function weightsTotal(draft: PartsDraft): number {
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
  const first = thisOrNextWeekend(today)
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
    duplicateTaskName: 'Ya tienes una tarea con ese nombre.',
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
    duplicateTaskName: 'You already have a task with that name.',
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
 * Si dos nombres de tarea son el mismo: sin espacios al principio y al final y sin distinguir
 * mayúsculas («baño » es «Baño»), como lo compara la base de datos (US-54).
 */
export function sameTaskName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Lo que hace falta de las demás tareas para saber si un nombre ya está en uso. */
export type NamedTask = Pick<Task, 'name' | 'frequency' | 'lastCompletedOn'>

/**
 * Si una tarea (no cancelada) bloquea su nombre: todas menos las puntuales ya hechas, que
 * ya no salen en la lista y lo bloquearían para siempre. Como en la base de datos.
 */
export function blocksItsName(task: Pick<Task, 'frequency' | 'lastCompletedOn'>): boolean {
  return !(task.frequency.kind === 'oneOff' && task.lastCompletedOn !== null)
}

/**
 * El aviso del nombre de una tarea, o `undefined` si vale: no vacío, como mucho 80
 * caracteres y distinto del de las demás tareas del hogar (`otherTasks`, sin la que se
 * renombra; las canceladas no llegan). Se compara con el nombre guardado, no con el
 * traducido (US-54). Sirve al crearla (US-33) y al renombrarla (US-54).
 */
export function taskNameError(
  name: string,
  otherTasks: NamedTask[],
  language: Language,
): string | undefined {
  const text = VALIDATION_TEXTS[language]
  const problem = nameProblem(name.trim(), text.taskNameRequired, text.nameTooLong)
  if (problem) return problem
  const inUse = otherTasks.some((other) => blocksItsName(other) && sameTaskName(other.name, name))
  return inUse ? text.duplicateTaskName : undefined
}

/** El aviso del nombre de una parte, o `undefined` si vale. Las partes pueden repetirse. */
export function partNameError(name: string, language: Language): string | undefined {
  const text = VALIDATION_TEXTS[language]
  return nameProblem(name.trim(), text.partNameRequired, text.nameTooLong)
}

/**
 * Comprueba la frecuencia elegida (US-33 y US-53): lo que pide cada una, con los avisos en el
 * idioma `language`. Con `firstDueOn`, las de cada N días llevan el día en que tocan la
 * primera vez (US-50, al crearla); sin él, no (al cambiarla, ese día lo pone la base de datos).
 * Devuelve la frecuencia lista para guardar, o `null` si falta algo (y qué, en `errors`).
 */
export function validateFrequency(
  draft: FrequencyDraft,
  language: Language,
  today: LocalDate,
  options: { firstDueOn: boolean },
): { frequency: Frequency | null; errors: FrequencyErrors } {
  const text = VALIDATION_TEXTS[language]
  const errors: FrequencyErrors = {}
  let frequency: Frequency | null = null
  switch (draft.frequencyKind) {
    case null:
      errors.frequency = text.frequencyRequired
      break
    case 'weekendWeekly':
      frequency = { kind: 'weekendWeekly', startOn: null }
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
      const firstDueOn = options.firstDueOn ? (draft.firstDueOn ?? today) : today
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

  return { frequency: Object.keys(errors).length > 0 ? null : frequency, errors }
}

/**
 * Comprueba el formulario. Los avisos de lo que falta salen en el idioma `language`;
 * `today` es para la fecha de las puntuales y la primera vez de las de cada N días;
 * `otherTasks`, las tareas del hogar, para no repetir un nombre.
 */
export function validateNewTask(
  draft: NewTaskDraft,
  language: Language,
  today: LocalDate,
  otherTasks: NamedTask[],
): { ok: true; task: NewTask } | { ok: false; errors: NewTaskErrors } {
  const errors: NewTaskErrors = {}

  const name = draft.name.trim()
  const nameError = taskNameError(name, otherTasks, language)
  if (nameError) errors.name = nameError

  const checked = validateFrequency(draft, language, today, { firstDueOn: true })
  Object.assign(errors, checked.errors)
  const { frequency } = checked

  const parts = validateParts(draft, language)
  Object.assign(errors, parts.errors)

  if (Object.keys(errors).length > 0 || frequency === null || parts.parts === null) {
    return { ok: false, errors }
  }

  return { ok: true, task: { name, frequency, parts: parts.parts } }
}

/**
 * Comprueba las partes del formulario (US-34 y US-51): cada una con nombre y un peso de 1 a
 * 100, y los pesos suman 100 % (si hay partes). Devuelve las partes listas para guardar, sin
 * espacios de más, o `null` si falta algo (y qué, en `errors`).
 */
export function validateParts(
  draft: PartsDraft,
  language: Language,
): { parts: { name: string; weight: number }[] | null; errors: PartsErrors } {
  const text = VALIDATION_TEXTS[language]
  const errors: PartsErrors = {}

  const partNames = draft.partNames.map((partName) => partName.trim())
  const partErrors = partNames.map((partName) => partNameError(partName, language))
  if (partErrors.some(Boolean)) errors.parts = partErrors

  const weights = partNames.map((_, index) => parseWeight(draft.partWeights[index] ?? ''))
  const weightErrors = weights.map((weight) => (weight === null ? text.weight : undefined))
  if (weightErrors.some(Boolean)) {
    errors.partWeights = weightErrors
  } else {
    // Solo si todos los pesos valen: si no, la suma no dice nada útil.
    const total = weightsTotal(draft)
    if (partNames.length > 0 && total !== 100) {
      errors.weightsTotal = text.weightsTotal(total)
    }
  }

  if (Object.keys(errors).length > 0) return { parts: null, errors }
  return {
    parts: partNames.map((partName, index) => ({ name: partName, weight: weights[index]! })),
    errors,
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
