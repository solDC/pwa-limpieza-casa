// US-28 · Frecuencias: cuándo toca cada tarea. TypeScript puro.
// Las reglas están en «Conceptos» de docs/user-stories.md.

import { addDays, daysBetween, dayOfWeek, formatDayMonth, formatShortDate } from './dates'
import type { Frequency, LocalDate, Task } from './task'

/** Una vuelta: desde cuándo toca y hasta qué día hay plazo (`null`: sin plazo). */
export type Round = {
  startsOn: LocalDate
  dueBy: LocalDate | null
}

/** Las tareas de fin de semana tocan el sábado y se pueden hacer hasta el viernes siguiente. */
const WEEKEND_ROUND_DAYS = 7

/**
 * La vuelta actual de una tarea o, si ya se hizo, la siguiente.
 * `lastCompletedOn` es el día en que se terminó la última vuelta (`null` si nunca).
 * Devuelve `null` si ya no vuelve a tocar (una puntual ya hecha).
 */
export function currentRound(
  task: Pick<Task, 'frequency' | 'createdOn'>,
  lastCompletedOn: LocalDate | null,
  today: LocalDate,
): Round | null {
  const { frequency } = task
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
      return lastCompletedOn ? null : { startsOn: task.createdOn, dueBy: null }
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

/** El texto de «Toca: …»: «finde del 14 nov», «hoy», «mañana», «mié 18 nov» o «desde el lun 9 nov». */
export function describeDue(frequency: Frequency, round: Round, today: LocalDate): string {
  if (frequency.kind === 'weekendWeekly' || frequency.kind === 'weekendBiweekly') {
    return `finde del ${formatDayMonth(round.startsOn)}`
  }
  const days = daysBetween(today, round.startsOn)
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  if (days < 0) return `desde el ${formatShortDate(round.startsOn)}`
  return formatShortDate(round.startsOn)
}
