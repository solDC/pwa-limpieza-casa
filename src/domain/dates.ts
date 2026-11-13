// Días locales sin hora ('YYYY-MM-DD'). TypeScript puro.
// Los cálculos se hacen con «días desde 1970» en UTC, sin horas: así no les afectan
// las zonas horarias ni el cambio de hora.

import type { Language } from './language'
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
  // Se monta con las partes (año, mes, día) y no con el texto formateado de un idioma,
  // que puede cambiar según el navegador.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

// Escritos aquí y no con Intl: así no dependen del navegador ni del dispositivo.
const WEEKDAYS: Record<Language, string[]> = {
  es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}
const MONTHS: Record<Language, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

/** «14 nov» o «14 Nov» */
export function formatDayMonth(date: LocalDate, language: Language = 'es'): string {
  const [, month, day] = date.split('-').map(Number)
  return `${day} ${MONTHS[language][month - 1]}`
}

/** «mié 18 nov» o «Wed 18 Nov» */
export function formatShortDate(date: LocalDate, language: Language = 'es'): string {
  return `${WEEKDAYS[language][dayOfWeek(date)]} ${formatDayMonth(date, language)}`
}
