// US-51 · Cambiar las partes de una tarea que ya existe: sus nombres y sus pesos, añadir
// partes y quitarlas. Qué hace falta para guardarlo y cómo queda la tarea. TypeScript puro.

import type { Language } from './language'
import { addPart, equalWeights, removePart, validateParts, type PartsDraft, type PartsErrors } from './new-task'
import { withRoundDone } from './progress'
import { partDisplayName, type LocalDate, type Task } from './task'

/** El formulario: las partes como se ven y, en `partIds`, cuál es cada una (`null`, una nueva). */
export type EditPartsDraft = PartsDraft & {
  partIds: (string | null)[]
}

/**
 * Lo que hay que guardar: las que siguen, con su peso y, si se han renombrado, su nombre
 * nuevo (`name: null`, sin renombrar), y las nuevas. Las demás se quitan.
 */
export type PartsChange = {
  kept: { id: string; weight: number; name: string | null }[]
  added: { name: string; weight: number }[]
}

/**
 * El formulario al abrirlo, con las partes de la tarea. Si sus pesos están repartidos a
 * partes iguales, al añadir o quitar partes se vuelven a repartir solos, como al crearla;
 * si no, se conservan. Una tarea sin partes empieza con una nueva, sin nombre y al 100 %
 * («Añadir partes»): así se empieza a escribir sin pulsar antes «Añadir parte».
 */
export function editPartsDraft(task: Pick<Task, 'parts'>, language: Language): EditPartsDraft {
  const weights = task.parts.map((part) => part.weight)
  const equal = equalWeights(weights.length)
  if (task.parts.length === 0) {
    return addEditedPart({ partIds: [], partNames: [], partWeights: [], weightsEdited: false })
  }
  return {
    partIds: task.parts.map((part) => part.id),
    partNames: task.parts.map((part) => partDisplayName(part, language)),
    partWeights: weights.map(String),
    weightsEdited: weights.some((weight, index) => weight !== equal[index]),
  }
}

/** Añade una parte nueva, sin nombre, al final. */
export function addEditedPart(draft: EditPartsDraft): EditPartsDraft {
  return { ...addPart(draft), partIds: [...draft.partIds, null] }
}

/** Quita una parte (al guardar, si ya existía, se archiva). */
export function removeEditedPart(draft: EditPartsDraft, index: number): EditPartsDraft {
  return { ...removePart(draft, index), partIds: draft.partIds.filter((_, i) => i !== index) }
}

/**
 * Comprueba el formulario, con las mismas reglas que al crear la tarea (US-34), y dice qué
 * hay que guardar. Una parte que ya existe solo cuenta como renombrada si no se ve igual que
 * antes en el idioma elegido (sin espacios al principio y al final), como en «Cambiar
 * nombre» (US-54): así, una parte por defecto que no se toca se sigue traduciendo.
 */
export function validatePartsChange(
  task: Pick<Task, 'parts'>,
  draft: EditPartsDraft,
  language: Language,
): { ok: true; change: PartsChange } | { ok: false; errors: PartsErrors } {
  const { parts, errors } = validateParts(draft, language)
  if (parts === null) return { ok: false, errors }
  const change: PartsChange = { kept: [], added: [] }
  parts.forEach((part, index) => {
    const id = draft.partIds[index]
    const existing = id ? task.parts.find((candidate) => candidate.id === id) : undefined
    if (id && existing) {
      const renamed = part.name !== partDisplayName(existing, language)
      change.kept.push({ id, weight: part.weight, name: renamed ? part.name : null })
    } else change.added.push(part)
  })
  return { ok: true, change }
}

/** Si no hay nada que guardar: las mismas partes, con los mismos nombres y pesos, y sin nuevas. */
export function isEmptyPartsChange(task: Pick<Task, 'parts'>, change: PartsChange): boolean {
  return (
    change.added.length === 0 &&
    change.kept.length === task.parts.length &&
    change.kept.every(
      (kept, index) =>
        kept.id === task.parts[index]!.id && kept.weight === task.parts[index]!.weight && kept.name === null,
    )
  )
}

/**
 * La tarea después de cambiar sus partes (ya guardado): las que siguen, con su peso nuevo (y
 * las renombradas, con su nombre, sin clave: dejan de traducirse, como hace la base de
 * datos), y las nuevas al final, con los ids que ha dado la base de datos (`newPartIds`, en su orden).
 * Las partes hechas de la vuelta en curso siguen hechas. Si con el cambio la vuelta ha
 * quedado completada (`completedOn`, el día que ha apuntado la base de datos), la próxima vez
 * se cuenta desde ese día, como al marcar la última parte.
 */
export function withPartsChanged(
  task: Task,
  change: PartsChange,
  newPartIds: string[],
  completedOn: LocalDate | null,
): Task {
  const kept = new Map(change.kept.map((part) => [part.id, part]))
  const parts = [
    ...task.parts.flatMap((part) => {
      const edited = kept.get(part.id)
      if (!edited) return []
      const renamed = edited.name === null ? {} : { name: edited.name, defaultKey: null }
      return [{ ...part, weight: edited.weight, ...renamed }]
    }),
    ...change.added.map((part, index) => ({
      id: newPartIds[index]!,
      name: part.name,
      defaultKey: null,
      weight: part.weight,
    })),
  ]
  const changed = { ...task, parts }
  return completedOn === null ? changed : withRoundDone(changed, completedOn)
}
