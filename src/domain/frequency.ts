// US-28 · Frecuencias: cuándo toca cada tarea. TypeScript puro.
// Las reglas están en «Conceptos» de docs/user-stories.md.

import { addDays, daysBetween, dayOfWeek, formatDayMonth, formatShortDate } from './dates'
import type { Language } from './language'
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
      const saturday = saturdayOnOrBefore(today)
      return notBefore(weekendRound(saturday, 7, lastCompletedOn), firstWeekend(task))
    }
    case 'weekendBiweekly': {
      if (today < frequency.startOn) {
        return notBefore(weekendRound(frequency.startOn, 14, lastCompletedOn), firstWeekend(task))
      }
      const weeksSinceStart = Math.floor(daysBetween(frequency.startOn, today) / 7)
      const saturday = addDays(frequency.startOn, Math.floor(weeksSinceStart / 2) * 14)
      // En la semana que no toca, ya se ve el finde siguiente.
      const current = weeksSinceStart % 2 === 0 ? saturday : addDays(saturday, 14)
      return notBefore(weekendRound(current, 14, lastCompletedOn), firstWeekend(task))
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

function saturdayOnOrBefore(day: LocalDate): LocalDate {
  return addDays(day, -((dayOfWeek(day) + 1) % 7))
}

/**
 * US-48 · El sábado de la primera vuelta de una tarea de fin de semana: el primer finde de
 * su calendario cuyo sábado o domingo es el día en que se creó o después. Así, una tarea
 * creada entre semana no empieza con retraso por un finde que ya había pasado.
 */
function firstWeekend(task: Pick<Task, 'frequency' | 'createdOn'>): LocalDate {
  // El último sábado que aún vale: el de la víspera, si se crea en domingo.
  const earliest = addDays(task.createdOn, -1)
  if (task.frequency.kind === 'weekendBiweekly') {
    const { startOn } = task.frequency
    if (earliest <= startOn) return startOn
    return addDays(startOn, Math.ceil(daysBetween(startOn, earliest) / 14) * 14)
  }
  const saturday = saturdayOnOrBefore(task.createdOn)
  return saturday >= earliest ? saturday : addDays(saturday, 7)
}

/** La vuelta, o la que empieza el sábado `first` si es anterior a ese día. */
function notBefore(round: Round, first: LocalDate): Round {
  if (round.startsOn !== null && round.startsOn >= first) return round
  return { startsOn: first, dueBy: addDays(first, WEEKEND_ROUND_DAYS - 1) }
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
export function describeDue(
  frequency: Frequency,
  round: Round,
  today: LocalDate,
  language: Language,
): string {
  const text = DUE_TEXTS[language]
  if (round.startsOn === null) return text.noDate
  const due = dueStatus(frequency, round, today)
  const weekend = isWeekend(frequency)
  if (due.status === 'overdue') {
    const date = weekend
      ? text.theWeekendOf(formatDayMonth(round.startsOn, language))
      : formatShortDate(round.startsOn, language)
    return text.overdue(due.days, date, weekend)
  }
  if (weekend) return text.due(text.weekendOf(formatDayMonth(round.startsOn, language)))
  const days = daysBetween(today, round.startsOn)
  if (days === 0) return text.due(text.today)
  if (days === 1) return text.due(text.tomorrow)
  return text.due(formatShortDate(round.startsOn, language))
}

// En inglés: «Due: weekend of 14 Nov», «Due: today», «Due: Wed 18 Nov»,
// «Overdue 3 days (was due Mon 9 Nov)», «Overdue 1 day (was due the weekend of 14 Nov)».
const DUE_TEXTS = {
  es: {
    noDate: 'Sin fecha',
    today: 'hoy',
    tomorrow: 'mañana',
    weekendOf: (date: string) => `finde del ${date}`,
    theWeekendOf: (date: string) => `finde del ${date}`,
    due: (when: string) => `Toca: ${when}`,
    overdue: (days: number, date: string, _weekend: boolean) =>
      `Retrasada ${days === 1 ? '1 día' : `${days} días`} (tocaba el ${date})`,
  },
  en: {
    noDate: 'No date',
    today: 'today',
    tomorrow: 'tomorrow',
    weekendOf: (date: string) => `weekend of ${date}`,
    theWeekendOf: (date: string) => `the weekend of ${date}`,
    due: (when: string) => `Due: ${when}`,
    overdue: (days: number, date: string, _weekend: boolean) =>
      `Overdue ${days === 1 ? '1 day' : `${days} days`} (was due ${date})`,
  },
} satisfies Record<Language, unknown>
