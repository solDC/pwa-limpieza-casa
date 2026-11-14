// US-39 · El progreso de una vuelta: qué partes están hechas y cuánto suman. TypeScript puro.

import type { Round } from './frequency'
import type { LocalDate, Task, TaskPart } from './task'

export type RoundProgress = {
  /** La suma de los pesos de las partes hechas en la vuelta, en %. */
  percent: number
  /** Las partes de la tarea, en su orden, y si están hechas en la vuelta. */
  parts: { part: TaskPart; done: boolean }[]
  /** Las que faltan. */
  remaining: TaskPart[]
}

/**
 * Cuánto se lleva de esa vuelta. Cuenta con los pesos que tienen las partes ahora: los que
 * tenían el día en que se hicieron los guarda la base de datos, para las vueltas pasadas.
 */
export function roundProgress(
  task: Pick<Task, 'parts' | 'partCompletions'>,
  round: Round,
): RoundProgress {
  const done = new Set(
    task.partCompletions
      .filter((completion) => completion.startsOn === round.startsOn)
      .map((completion) => completion.partId),
  )
  const parts = task.parts.map((part) => ({ part, done: done.has(part.id) }))
  return {
    percent: parts.reduce((sum, item) => sum + (item.done ? item.part.weight : 0), 0),
    parts,
    remaining: parts.filter((item) => !item.done).map((item) => item.part),
  }
}

/**
 * La tarea después de marcar esas partes en la vuelta, el día `completedOn`. Si ya están
 * todas, la vuelta queda terminada ese día (lo mismo que hace la base de datos).
 */
export function withPartsDone(
  task: Task,
  round: Round,
  partIds: string[],
  completedOn: LocalDate,
): Task {
  const partCompletions = [
    ...task.partCompletions,
    ...partIds.map((partId) => ({ partId, startsOn: round.startsOn })),
  ]
  const allDone = roundProgress({ parts: task.parts, partCompletions }, round).remaining.length === 0
  return {
    ...task,
    partCompletions,
    lastCompletedOn: allDone ? completedOn : task.lastCompletedOn,
  }
}
