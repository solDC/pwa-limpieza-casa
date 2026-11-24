// Tareas del hogar y sus frecuencias. TypeScript puro: sin React, Supabase ni navegador.
// Los conceptos están en «Conceptos» de docs/user-stories.md.

import type { Language } from './language'

/** Día local sin hora, en formato 'YYYY-MM-DD'. */
export type LocalDate = string

export type Frequency =
  /**
   * Cada sábado y domingo; si se ha movido a otro finde (`startOn`, el sábado, US-42), desde
   * ese finde.
   */
  | { kind: 'weekendWeekly'; startOn: LocalDate | null }
  /** Un fin de semana sí y otro no, desde el sábado `startOn`. */
  | { kind: 'weekendBiweekly'; startOn: LocalDate }
  /**
   * `days` días después del día en que se terminó la última vez o, si se ha elegido otro día
   * para la próxima vez (`nextDueOn`, US-41), ese día.
   */
  | { kind: 'interval'; days: number; nextDueOn: LocalDate | null }
  /** Una sola vez; si tiene fecha (`dueOn`, US-38), toca ese día. */
  | { kind: 'oneOff'; dueOn: LocalDate | null }

export type TaskPart = {
  id: string
  name: string
  /** Si es una parte de las tareas por defecto, cuál: así se ve en el idioma elegido. */
  defaultKey: string | null
  /** Cuánto cuenta en el progreso de la tarea, en %. Los de una tarea suman 100. */
  weight: number
}

/** Una parte hecha, y en qué vuelta: desde cuándo tocaba (`null` en las puntuales). */
export type PartCompletion = {
  partId: string
  startsOn: LocalDate | null
}

export type Task = {
  id: string
  householdId: string
  name: string
  /** Si es una de las tareas por defecto, cuál (US-52). `null` en las que añade el usuario. */
  defaultKey: string | null
  frequency: Frequency
  parts: TaskPart[]
  createdOn: LocalDate
  /**
   * Desde qué día cuenta la frecuencia que tiene ahora: el día en que se cambió (US-53) o,
   * si nunca se ha cambiado, el día en que se creó.
   */
  frequencySince: LocalDate
  cancelledOn: LocalDate | null
  /** Día en que se terminó la última vuelta (`null` si nunca). */
  lastCompletedOn: LocalDate | null
  /** Las últimas partes hechas (US-39): las de la vuelta en curso están siempre. */
  partCompletions: PartCompletion[]
}

/** Texto de la frecuencia para la interfaz. */
export function describeFrequency(frequency: Frequency, language: Language): string {
  const text = FREQUENCY_TEXTS[language]
  switch (frequency.kind) {
    case 'weekendWeekly':
      return text.weekendWeekly
    case 'weekendBiweekly':
      return text.weekendBiweekly
    case 'interval':
      return frequency.days === 1 ? text.everyDay : text.everyDays(frequency.days)
    case 'oneOff':
      return text.oneOff
  }
}

const FREQUENCY_TEXTS = {
  es: {
    weekendWeekly: 'Semanal, en fin de semana',
    weekendBiweekly: 'Fin de semana cada 15 días',
    everyDay: 'Cada día desde la última vez',
    everyDays: (days: number) => `Cada ${days} días desde la última vez`,
    oneOff: 'Puntual',
  },
  en: {
    weekendWeekly: 'Weekly, at the weekend',
    weekendBiweekly: 'Every other weekend',
    everyDay: 'Every day since the last time',
    everyDays: (days: number) => `Every ${days} days since the last time`,
    oneOff: 'One-off',
  },
} satisfies Record<Language, unknown>

/**
 * US-52 · Los nombres en inglés de las tareas por defecto y de sus partes, por su clave
 * (la columna `default_key`). En castellano se usa el nombre guardado.
 */
const DEFAULT_NAMES_IN_ENGLISH: Record<string, string> = {
  surfaces: 'Surfaces',
  kitchen: 'Kitchen',
  living_room: 'Living room',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  vacuum_cati: 'Vacuum Cati’s things',
  windows_mirrors: 'Windows and mirrors',
  scrub_floor: 'Scrub the floor',
  clean_grout: 'Clean the grout',
}

/**
 * El nombre de una tarea para mostrarlo: las de por defecto, en el idioma elegido; las que
 * añade el usuario, o las que renombra (US-54), como las escribió.
 */
export function taskDisplayName(task: Pick<Task, 'name' | 'defaultKey'>, language: Language): string {
  if (language === 'en' && task.defaultKey) {
    return DEFAULT_NAMES_IN_ENGLISH[task.defaultKey] ?? task.name
  }
  return task.name
}

/** Lo mismo, para una parte. */
export function partDisplayName(
  part: Pick<TaskPart, 'name' | 'defaultKey'>,
  language: Language,
): string {
  return taskDisplayName(part, language)
}
