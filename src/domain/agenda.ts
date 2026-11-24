// US-29 · Qué toca: en qué orden salen las tareas en «Tus tareas». TypeScript puro.

import { currentRound, dueDate, dueStatus, type Due, type Round } from './frequency'
import type { LocalDate, Task } from './task'

export type AgendaItem<T> = { task: T; round: Round; due: Due }

type ItemWithFrequency = AgendaItem<Pick<Task, 'frequency'>>

// Primero lo retrasado, luego lo de hoy, luego las puntuales sin fecha y al final lo que toca más adelante.
const ORDER: Record<Due['status'], number> = { overdue: 0, today: 1, pending: 2, upcoming: 3 }

/**
 * Las tareas que siguen tocando (sin las puntuales ya hechas), cada una con su vuelta y su
 * estado de hoy, por orden: las retrasadas (más retraso arriba), las de hoy, las puntuales sin fecha y
 * las de más adelante (por fecha). Con el mismo estado, se queda el orden de la lista.
 */
export function agenda<T extends Pick<Task, 'frequency' | 'frequencySince' | 'lastCompletedOn'>>(
  tasks: T[],
  today: LocalDate,
): AgendaItem<T>[] {
  const items: AgendaItem<T>[] = []
  for (const task of tasks) {
    const round = currentRound(task, today)
    if (round) items.push({ task, round, due: dueStatus(task.frequency, round, today) })
  }
  // sort() mantiene el orden original cuando dos elementos empatan.
  return items.sort((a, b) => ORDER[a.due.status] - ORDER[b.due.status] || tiebreak(a, b))
}

function tiebreak(a: ItemWithFrequency, b: ItemWithFrequency): number {
  if (a.due.status === 'overdue' && b.due.status === 'overdue') return b.due.days - a.due.days
  if (a.due.status === 'upcoming' && b.due.status === 'upcoming') {
    // Las dos tienen fecha: las de más adelante siempre la tienen (también las puntuales
    // con fecha, US-38).
    const dateOf = (item: ItemWithFrequency) => dueDate(item.task.frequency, item.round) ?? ''
    return dateOf(a).localeCompare(dateOf(b))
  }
  return 0
}
