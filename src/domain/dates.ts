// Días locales sin hora ('YYYY-MM-DD'). TypeScript puro.
// Los cálculos se hacen con «días desde 1970» en UTC, sin horas: así no les afectan
// las zonas horarias ni el cambio de hora.

import type { LocalDate } from './task'

const MS_PER_DAY = 86_400_000

function toDayNumber(date: LocalDate): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

function fromDayNumber(dayNumber: number): LocalDate {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10)
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(toDayNumber(date) + days)
}

/** Días que van de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toDayNumber(to) - toDayNumber(from)
}

/** 0 = domingo, 1 = lunes… 6 = sábado. */
export function dayOfWeek(date: LocalDate): number {
  // El 1 de enero de 1970 (día 0) fue jueves.
  return (((toDayNumber(date) + 4) % 7) + 7) % 7
}

/** Qué día es en esa zona horaria en ese momento. El momento llega como parámetro. */
export function localDateIn(timeZone: string, now: Date): LocalDate {
  // 'en-CA' da el formato AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** «14 nov» */
export function formatDayMonth(date: LocalDate): string {
  const [, month, day] = date.split('-').map(Number)
  return `${day} ${MONTHS[month - 1]}`
}

/** «mié 18 nov» */
export function formatShortDate(date: LocalDate): string {
  return `${WEEKDAYS[dayOfWeek(date)]} ${formatDayMonth(date)}`
}
