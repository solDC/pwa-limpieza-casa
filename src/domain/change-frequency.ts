// US-53 · Cambiar cada cuánto toca una tarea. TypeScript puro.

import { addDays } from './dates'
import type { Round } from './frequency'
import type { Language } from './language'
import { nextWeekends, validateFrequency, type FrequencyDraft, type FrequencyErrors } from './new-task'
import { roundProgress } from './progress'
import type { Frequency, LocalDate, Task } from './task'

/**
 * El formulario, con la frecuencia que tiene la tarea: su tipo y, en las de cada N días, sus
 * días. El primer finde de una de cada 15 días y la fecha de una puntual empiezan sin elegir:
 * elegirlos es cambiarlos (la fecha de una puntual se cambia con «Cambiar fecha», US-38).
 */
export function frequencyDraftOf(task: Pick<Task, 'frequency'>): FrequencyDraft {
  const { frequency } = task
  return {
    frequencyKind: frequency.kind,
    intervalDays: frequency.kind === 'interval' ? String(frequency.days) : '',
    firstDueOn: null,
    biweeklyStartOn: null,
    dueOn: null,
  }
}

/**
 * Los dos findes que se ofrecen para empezar una de cada 15 días: los dos próximos, como al
 * crearla (US-33). Si la vuelta en curso es de este finde y está a medias, desde el siguiente:
 * la vuelta nueva no puede ser la misma, o se quedaría con sus partes hechas.
 */
export function changeFrequencyWeekends(
  task: Pick<Task, 'parts' | 'partCompletions'>,
  round: Round | null,
  today: LocalDate,
): [LocalDate, LocalDate] {
  const options = nextWeekends(today)
  const halfDone =
    round !== null && round.startsOn !== null && roundProgress(task, round).parts.some((part) => part.done)
  if (halfDone && options.includes(round.startsOn as LocalDate)) {
    return nextWeekends(addDays(round.startsOn as LocalDate, 2))
  }
  return options
}

/**
 * Comprueba el formulario: la frecuencia elegida, con lo que pide cada una (como al crear la
 * tarea, pero sin el día de la primera vez en las de cada N días: lo pone la base de datos).
 * `unchanged` si es la que ya tiene (el mismo tipo y los mismos días, o sin elegir otro
 * primer finde): no hay nada que guardar.
 */
export function validateFrequencyChange(
  task: Pick<Task, 'frequency'>,
  draft: FrequencyDraft,
  language: Language,
  today: LocalDate,
):
  | { status: 'valid'; frequency: Frequency }
  | { status: 'unchanged' }
  | { status: 'invalid'; errors: FrequencyErrors } {
  if (isUnchanged(task.frequency, draft)) return { status: 'unchanged' }
  const { frequency, errors } = validateFrequency(draft, language, today, { firstDueOn: false })
  if (frequency === null) return { status: 'invalid', errors }
  return { status: 'valid', frequency }
}

function isUnchanged(current: Frequency, draft: FrequencyDraft): boolean {
  if (draft.frequencyKind !== current.kind) return false
  switch (current.kind) {
    case 'weekendWeekly':
    case 'oneOff':
      return true
    case 'weekendBiweekly':
      return draft.biweeklyStartOn === null || draft.biweeklyStartOn === current.startOn
    case 'interval':
      return draft.intervalDays.trim() === String(current.days)
  }
}

/**
 * La tarea con la frecuencia nueva, como la ha guardado la base de datos: desde el día
 * `frequencySince` y, en las de cada N días, con el día en que toca si ya había pasado
 * (`nextDueOn`). Las partes hechas se quedan en su vuelta: la nueva es otra.
 */
export function withFrequencyChanged<T extends Pick<Task, 'frequency' | 'frequencySince'>>(
  task: T,
  frequency: Frequency,
  frequencySince: LocalDate,
  nextDueOn: LocalDate | null,
): T {
  return {
    ...task,
    frequency: frequency.kind === 'interval' ? { ...frequency, nextDueOn } : frequency,
    frequencySince,
  }
}
