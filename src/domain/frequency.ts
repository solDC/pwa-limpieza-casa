// US-28 · Frecuencias: cuándo toca cada tarea. TypeScript puro.
// Las reglas están en «Conceptos» de docs/user-stories.md.

import { addDays, daysBetween, dayOfWeek, formatDayMonth, formatShortDate } from './dates'
import type { Frequency, LocalDate, Task } from './task'

/**
 * Una vuelta: desde cuándo toca (`null`: sin fecha, como una puntual) y hasta qué día
 * hay plazo (`null`: sin plazo).
 */
export type Round = {
  startsOn: LocalDate | null
  dueBy: LocalDate | null
}

/** Las tareas de fin de semana tocan el sábado y se pueden hacer hasta el viernes siguiente. */
const WEEKEND_ROUND_DAYS = 7

/** Si es de fin de semana (semanal o cada 15 días). */
export function isWeekend(frequency: Frequency): boolean {
  return frequency.kind === 'weekendWeekly' || frequency.kind === 'weekendBiweekly'
}

/**
 * La vuelta actual de una tarea o, si ya se hizo, la siguiente, según el día en que se
 * terminó la última vuelta (`lastCompletedOn`, `null` si nunca).
 * Devuelve `null` si ya no vuelve a tocar (una puntual ya hecha).
 */
export function currentRound(
  task: Pick<Task, 'frequency' | 'createdOn' | 'lastCompletedOn'>,
  today: LocalDate,
): Round | null {
  const { frequency, lastCompletedOn } = task
  switch (frequency.kind) {
    case 'weekendWeekly': {
      const saturday = addDays(today, -((dayOfWeek(today) + 1) % 7))
      return weekendRound(saturday, 7, lastCompletedOn)
    }
    case 'weekendBiweekly': {
      if (today < frequency.startOn) return weekendRound(frequency.startOn, 14, lastCompletedOn)
      const weeksSinceStart = Math.floor(daysBetween(frequency.startOn, today) / 7)
      const saturday = addDays(frequency.startOn, Math.floor(weeksSinceStart / 2) * 14)
      // En la semana que no toca, ya se ve el finde siguiente.
      const current = weeksSinceStart % 2 === 0 ? saturday : addDays(saturday, 14)
      return weekendRound(current, 14, lastCompletedOn)
    }
    case 'interval':
      return {
        startsOn: lastCompletedOn ? addDays(lastCompletedOn, frequency.days) : task.createdOn,
        dueBy: null,
      }
    case 'oneOff':
      // Va sin fecha: pendiente hasta que se hace, sin retraso. Poder ponerle una es la US-38.
      return lastCompletedOn ? null : { startsOn: null, dueBy: null }
  }
}

/** La vuelta que empieza ese sábado o, si ya se hizo dentro de ella, la siguiente. */
function weekendRound(saturday: LocalDate, every: number, lastCompletedOn: LocalDate | null): Round {
  const dueBy = addDays(saturday, WEEKEND_ROUND_DAYS - 1)
  const doneInThisRound =
    lastCompletedOn !== null && lastCompletedOn >= saturday && lastCompletedOn <= dueBy
  const startsOn = doneInThisRound ? addDays(saturday, every) : saturday
  return { startsOn, dueBy: addDays(startsOn, WEEKEND_ROUND_DAYS - 1) }
}

/**
 * Si se puede marcar como hecha la vuelta que se muestra (US-30).
 * Las de fin de semana, solo durante su vuelta (del sábado al viernes): si ya se hizo,
 * se muestra el finde siguiente, que aún no ha empezado. Las de «cada N días» y las
 * puntuales, también antes de que toquen (la siguiente se cuenta desde el día en que se
 * hacen), pero no dos veces el mismo día.
 */
export function canMarkDone(
  task: Pick<Task, 'frequency' | 'lastCompletedOn'>,
  round: Round,
  today: LocalDate,
): boolean {
  if (isWeekend(task.frequency)) return round.startsOn !== null && round.startsOn <= today
  return task.lastCompletedOn !== today
}

/**
 * Cómo está una vuelta hoy (US-29): retrasada (con cuántos días), toca hoy, pendiente sin
 * fecha (las puntuales, que nunca van con retraso) o toca más adelante.
 */
export type Due =
  | { status: 'overdue'; days: number }
  | { status: 'today' }
  | { status: 'pending' }
  | { status: 'upcoming' }

/**
 * Las de fin de semana tocan el sábado y el domingo; de lunes a viernes van con retraso,
 * contando desde el lunes (el lunes, 1 día). Las de cada N días, desde el día siguiente al
 * que tocaban.
 */
export function dueStatus(frequency: Frequency, round: Round, today: LocalDate): Due {
  if (round.startsOn === null) return { status: 'pending' }
  if (round.startsOn > today) return { status: 'upcoming' }
  // El último día que toca sin retraso: el domingo en las de fin de semana.
  const lastDay = isWeekend(frequency) ? addDays(round.startsOn, 1) : round.startsOn
  const days = daysBetween(lastDay, today)
  return days > 0 ? { status: 'overdue', days } : { status: 'today' }
}

/**
 * Cuándo toca, en texto: «Toca: finde del 14 nov», «Toca: hoy», «Toca: mañana»,
 * «Toca: mié 18 nov», «Retrasada 3 días (tocaba el lun 9 nov)» o «Sin fecha».
 */
export function describeDue(frequency: Frequency, round: Round, today: LocalDate): string {
  if (round.startsOn === null) return 'Sin fecha'
  const due = dueStatus(frequency, round, today)
  if (due.status === 'overdue') {
    const days = due.days === 1 ? '1 día' : `${due.days} días`
    return `Retrasada ${days} (tocaba el ${describeDate(frequency, round.startsOn, today)})`
  }
  return `Toca: ${describeDate(frequency, round.startsOn, today)}`
}

function describeDate(frequency: Frequency, startsOn: LocalDate, today: LocalDate): string {
  if (isWeekend(frequency)) return `finde del ${formatDayMonth(startsOn)}`
  const days = daysBetween(today, startsOn)
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  return formatShortDate(startsOn)
}
