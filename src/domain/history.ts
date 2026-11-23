// US-31 · El histórico: cómo acabó cada vuelta de las tareas. TypeScript puro.
// Las vueltas completadas y las partes hechas se guardan; las no completadas se calculan con
// el calendario que tiene ahora cada tarea (`pastWeekendRounds()`), sin guardar nada.

import { addDays, formatDayMonth, formatLongDate } from './dates'
import { pastWeekendRounds } from './frequency'
import type { Language } from './language'
import type { LocalDate, Task } from './task'

/** Una vuelta terminada (una fila de `task_rounds`). */
export type CompletedRound = {
  taskId: string
  /** Desde cuándo tocaba (`null` en las puntuales). */
  startsOn: LocalDate | null
  completedOn: LocalDate
}

/** Una parte hecha (una fila de `task_part_completions`), con el peso que tenía ese día. */
export type DonePart = {
  taskId: string
  startsOn: LocalDate | null
  /** Hasta cuándo había plazo (`null` en las de cada N días y las puntuales). */
  dueBy: LocalDate | null
  weight: number
}

/** Cómo acabó una vuelta. Las parciales y las no completadas, con su finde (el sábado). */
export type RoundOutcome =
  | { status: 'completed' }
  | { status: 'partial'; percent: number; weekend: LocalDate }
  | { status: 'notCompleted'; weekend: LocalDate }

export type HistoryTask = Pick<Task, 'id' | 'name' | 'defaultKey' | 'frequency' | 'createdOn'>

export type HistoryEntry = { task: HistoryTask; outcome: RoundOutcome }

/** Lo de un día: las completadas ese día y las de fin de semana cuyo plazo acabó ese día. */
export type HistoryDay = { day: LocalDate; entries: HistoryEntry[] }

/** Cuántos días se ven cada vez: las últimas 4 semanas, y «Ver más» carga 4 más. */
export const HISTORY_PAGE_DAYS = 28

/** Los días de la página `page` del histórico (0, la primera): de `from` a `to`, los dos incluidos. */
export function historyPage(today: LocalDate, page: number): { from: LocalDate; to: LocalDate } {
  const to = addDays(today, -page * HISTORY_PAGE_DAYS)
  return { from: addDays(to, -(HISTORY_PAGE_DAYS - 1)), to }
}

/**
 * Si puede haber algo antes de `from`: alguna tarea se creó antes. No hay vueltas anteriores a
 * la tarea (US-48), así que, si no, no hace falta «Ver más».
 */
export function hasOlderHistory(tasks: Pick<Task, 'createdOn'>[], from: LocalDate): boolean {
  return tasks.some((task) => task.createdOn < from)
}

// En un mismo día, primero las completadas, luego las parciales y luego las no completadas.
const STATUS_ORDER: Record<RoundOutcome['status'], number> = {
  completed: 0,
  partial: 1,
  notCompleted: 2,
}

/**
 * El histórico de los días de `from` a `to`, de lo más reciente a lo más antiguo; dentro de
 * cada día, por estado y en el orden de las tareas (`tasks`). Solo de esas tareas: las que no
 * están (canceladas) no salen.
 * - **Completadas:** cada vuelta terminada, el día en que se terminó.
 * - **Parciales:** cada vuelta de fin de semana con alguna parte hecha que no se terminó, el
 *   día en que acabó su plazo (el viernes), con la suma de los pesos que tenían sus partes.
 * - **No completadas:** cada vuelta de fin de semana sin nada hecho, el día en que acabó su
 *   plazo, según el calendario que tiene ahora la tarea.
 * Las vueltas de fin de semana salen cuando su plazo ya ha pasado (antes de `today`), como en
 * la lista: hasta entonces, siguen ahí. `rounds` y `parts` tienen que incluir las de las vueltas
 * cuyo plazo acaba entre `from` y `to` (las de la semana anterior a `from`, en adelante).
 */
export function historyDays(
  tasks: HistoryTask[],
  rounds: CompletedRound[],
  parts: DonePart[],
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
): HistoryDay[] {
  const byId = new Map(tasks.map((task, position) => [task.id, { task, position }]))
  const inRange = (day: LocalDate) => day >= from && day <= to
  const key = (taskId: string, startsOn: LocalDate | null) => `${taskId}|${startsOn}`
  const completed = new Set(rounds.map((round) => key(round.taskId, round.startsOn)))

  const items: { day: LocalDate; position: number; entry: HistoryEntry }[] = []
  function add(taskId: string, day: LocalDate, outcome: RoundOutcome) {
    const found = byId.get(taskId)
    if (found) items.push({ day, position: found.position, entry: { task: found.task, outcome } })
  }

  for (const round of rounds) {
    if (inRange(round.completedOn)) add(round.taskId, round.completedOn, { status: 'completed' })
  }

  // Las vueltas con alguna parte hecha. Las que no tienen plazo siguen en la lista hasta que
  // se terminan: solo llegan al histórico como completadas.
  const withParts = new Set<string>()
  const partial = new Map<string, { taskId: string; weekend: LocalDate; dueBy: LocalDate; percent: number }>()
  for (const part of parts) {
    withParts.add(key(part.taskId, part.startsOn))
    if (part.startsOn === null || part.dueBy === null) continue
    if (part.dueBy >= today || !inRange(part.dueBy)) continue
    const roundKey = key(part.taskId, part.startsOn)
    if (completed.has(roundKey)) continue
    const round = partial.get(roundKey) ?? {
      taskId: part.taskId,
      weekend: part.startsOn,
      dueBy: part.dueBy,
      percent: 0,
    }
    partial.set(roundKey, { ...round, percent: round.percent + part.weight })
  }
  for (const round of partial.values()) {
    add(round.taskId, round.dueBy, { status: 'partial', percent: round.percent, weekend: round.weekend })
  }

  for (const task of tasks) {
    for (const round of pastWeekendRounds(task, from, to, today)) {
      const roundKey = key(task.id, round.startsOn)
      if (completed.has(roundKey) || withParts.has(roundKey)) continue
      // `pastWeekendRounds()` solo da vueltas con fecha y plazo.
      add(task.id, round.dueBy as LocalDate, { status: 'notCompleted', weekend: round.startsOn as LocalDate })
    }
  }

  items.sort(
    (a, b) =>
      (a.day < b.day ? 1 : a.day > b.day ? -1 : 0) ||
      STATUS_ORDER[a.entry.outcome.status] - STATUS_ORDER[b.entry.outcome.status] ||
      a.position - b.position,
  )
  const days: HistoryDay[] = []
  for (const item of items) {
    const last = days[days.length - 1]
    if (last?.day === item.day) last.entries.push(item.entry)
    else days.push({ day: item.day, entries: [item.entry] })
  }
  return days
}

/** El título de un día: «Hoy», «Ayer» o «Sábado 21 de noviembre». */
export function describeHistoryDay(day: LocalDate, today: LocalDate, language: Language): string {
  const text = HISTORY_TEXTS[language]
  if (day === today) return text.today
  if (day === addDays(today, -1)) return text.yesterday
  const date = formatLongDate(day, language)
  return date.charAt(0).toUpperCase() + date.slice(1)
}

/** «Completada», «Parcial (60 %)» o «No completada». */
export function describeOutcome(outcome: RoundOutcome, language: Language): string {
  const text = HISTORY_TEXTS[language]
  switch (outcome.status) {
    case 'completed':
      return text.completed
    case 'partial':
      return text.partial(outcome.percent)
    case 'notCompleted':
      return text.notCompleted
  }
}

/** El finde de una vuelta por su sábado: «Finde del 14-15 nov», «Finde del 31 oct-1 nov». */
export function describeWeekendDays(saturday: LocalDate, language: Language): string {
  const sunday = addDays(saturday, 1)
  const sameMonth = saturday.slice(0, 7) === sunday.slice(0, 7)
  const first = sameMonth ? String(Number(saturday.slice(8))) : formatDayMonth(saturday, language)
  return HISTORY_TEXTS[language].weekend(`${first}-${formatDayMonth(sunday, language)}`)
}

const HISTORY_TEXTS = {
  es: {
    today: 'Hoy',
    yesterday: 'Ayer',
    completed: 'Completada',
    partial: (percent: number) => `Parcial (${percent} %)`,
    notCompleted: 'No completada',
    weekend: (days: string) => `Finde del ${days}`,
  },
  en: {
    today: 'Today',
    yesterday: 'Yesterday',
    completed: 'Completed',
    partial: (percent: number) => `Partial (${percent}%)`,
    notCompleted: 'Not completed',
    weekend: (days: string) => `Weekend of ${days}`,
  },
} satisfies Record<Language, unknown>
