// US-54 · Cambiar el nombre de una tarea y de sus partes: qué hace falta para guardarlo y
// cómo queda la tarea. TypeScript puro.

import type { Language } from './language'
import { partNameError, taskNameError } from './new-task'
import { partDisplayName, taskDisplayName, type Task } from './task'

/** Lo que se ha escrito en el formulario, tal cual: el nombre y el de cada parte, en orden. */
export type RenameDraft = {
  name: string
  partNames: string[]
}

/** Qué falta, campo a campo (las partes, en su orden). */
export type RenameErrors = {
  name?: string
  parts?: (string | undefined)[]
}

/** Lo que hay que guardar: solo lo renombrado (`name: null`, la tarea no cambia). */
export type TaskRename = {
  name: string | null
  parts: { id: string; name: string }[]
}

/** El formulario al abrirlo: los nombres como se ven, en el idioma elegido. */
export function renameDraft(task: Pick<Task, 'name' | 'defaultKey' | 'parts'>, language: Language): RenameDraft {
  return {
    name: taskDisplayName(task, language),
    partNames: task.parts.map((part) => partDisplayName(part, language)),
  }
}

/**
 * Comprueba el formulario y dice qué se ha renombrado. Solo cuenta como renombrado lo que
 * no se ve igual que antes (sin espacios al principio y al final): así, una tarea por
 * defecto que se guarda sin cambiar se sigue traduciendo. Solo se comprueba lo renombrado:
 * si ya había dos tareas iguales (de antes de la US-54), se puede renombrar otra cosa.
 * `otherTasks`, las demás tareas del hogar, para no repetir un nombre.
 */
export function validateRename(
  task: Pick<Task, 'id' | 'name' | 'defaultKey' | 'parts'>,
  draft: RenameDraft,
  otherTasks: Pick<Task, 'id' | 'name'>[],
  language: Language,
): { ok: true; rename: TaskRename } | { ok: false; errors: RenameErrors } {
  const before = renameDraft(task, language)
  const errors: RenameErrors = {}

  const name = draft.name.trim()
  const nameChanged = name !== before.name
  if (nameChanged) {
    const others = otherTasks.filter((other) => other.id !== task.id)
    const nameError = taskNameError(name, others, language)
    if (nameError) errors.name = nameError
  }

  const parts: TaskRename['parts'] = []
  const partErrors = task.parts.map((part, index) => {
    const partName = (draft.partNames[index] ?? '').trim()
    if (partName === before.partNames[index]) return undefined
    parts.push({ id: part.id, name: partName })
    return partNameError(partName, language)
  })
  if (partErrors.some(Boolean)) errors.parts = partErrors

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, rename: { name: nameChanged ? name : null, parts } }
}

/** Si no hay nada que guardar. */
export function isEmptyRename(rename: TaskRename): boolean {
  return rename.name === null && rename.parts.length === 0
}

/**
 * La tarea después de renombrarla (ya guardado). Lo renombrado deja de ser de las tareas
 * por defecto (sin clave): se ve como se escribió, en cualquier idioma, como hace la base de
 * datos. El progreso no cambia: las partes son las mismas.
 */
export function withRenamed<T extends Pick<Task, 'name' | 'defaultKey' | 'parts'>>(task: T, rename: TaskRename): T {
  const renamedParts = new Map(rename.parts.map((part) => [part.id, part.name]))
  return {
    ...task,
    ...(rename.name !== null && { name: rename.name, defaultKey: null }),
    parts: task.parts.map((part) => {
      const partName = renamedParts.get(part.id)
      return partName === undefined ? part : { ...part, name: partName, defaultKey: null }
    }),
  }
}
