// Tareas del hogar y sus frecuencias. TypeScript puro: sin React, Supabase ni navegador.
// Los conceptos están en «Conceptos» de docs/user-stories.md.

/** Día local sin hora, en formato 'YYYY-MM-DD'. */
export type LocalDate = string

export type Frequency =
  /** Cada sábado y domingo. */
  | { kind: 'weekendWeekly' }
  /** Un fin de semana sí y otro no, desde el sábado `startOn`. */
  | { kind: 'weekendBiweekly'; startOn: LocalDate }
  /** `days` días después del día en que se terminó la última vez. */
  | { kind: 'interval'; days: number }
  /** Una sola vez. */
  | { kind: 'oneOff' }

export type TaskPart = {
  id: string
  name: string
  /** Cuánto cuenta en el progreso de la tarea, en %. Los de una tarea suman 100. */
  weight: number
}

export type Task = {
  id: string
  name: string
  frequency: Frequency
  parts: TaskPart[]
  createdOn: LocalDate
  cancelledOn: LocalDate | null
}

/** Texto de la frecuencia para la interfaz. */
export function describeFrequency(frequency: Frequency): string {
  switch (frequency.kind) {
    case 'weekendWeekly':
      return 'Semanal, en fin de semana'
    case 'weekendBiweekly':
      return 'Fin de semana cada 15 días'
    case 'interval':
      return frequency.days === 1
        ? 'Cada día desde la última vez'
        : `Cada ${frequency.days} días desde la última vez`
    case 'oneOff':
      return 'Puntual'
  }
}
