import type { Round } from '../domain/frequency'
import type { Frequency, LocalDate, Task } from '../domain/task'
import { getSupabase } from './supabase-client'

// Tareas del hogar (US-27) y sus vueltas terminadas (US-30).
// Las reglas RLS hacen que cada usuario solo vea y apunte las de su hogar.

type TaskRow = {
  id: string
  household_id: string
  name: string
  frequency: 'weekend_weekly' | 'weekend_biweekly' | 'interval' | 'one_off'
  interval_days: number | null
  biweekly_start_on: string | null
  created_on: string
  cancelled_on: string | null
  task_parts: { id: string; name: string; weight: number; position: number }[]
  // Solo la última vuelta terminada.
  task_rounds: { completed_on: string }[]
}

/** Tareas no canceladas del hogar, en orden y con sus partes. */
export async function listTasks(): Promise<Task[]> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select(
      'id, household_id, name, frequency, interval_days, biweekly_start_on, created_on, cancelled_on, task_parts (id, name, weight, position), task_rounds (completed_on)',
    )
    .is('cancelled_on', null)
    .order('position')
    .order('position', { referencedTable: 'task_parts' })
    .order('completed_on', { referencedTable: 'task_rounds', ascending: false })
    .limit(1, { referencedTable: 'task_rounds' })
  if (error) throw new Error('No se han podido cargar tus tareas.')
  return (data as TaskRow[]).map(toTask)
}

/**
 * Marca como hecha la vuelta de una tarea (US-30). La base de datos apunta el día:
 * hoy en Madrid. Devuelve ese día.
 */
export async function completeTask(task: Task, round: Round): Promise<LocalDate> {
  const { data, error } = await getSupabase()
    .from('task_rounds')
    .insert({
      household_id: task.householdId,
      task_id: task.id,
      starts_on: round.startsOn,
      due_by: round.dueBy,
    })
    .select('completed_on')
    .single()
  if (error) throw new Error('No se ha podido guardar. Revisa la conexión e inténtalo de nuevo.')
  return (data as { completed_on: string }).completed_on
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    frequency: toFrequency(row),
    parts: row.task_parts.map(({ id, name, weight }) => ({ id, name, weight })),
    createdOn: row.created_on,
    cancelledOn: row.cancelled_on,
    lastCompletedOn: row.task_rounds[0]?.completed_on ?? null,
  }
}

function toFrequency(row: TaskRow): Frequency {
  switch (row.frequency) {
    case 'weekend_weekly':
      return { kind: 'weekendWeekly' }
    case 'weekend_biweekly':
      return { kind: 'weekendBiweekly', startOn: required(row.biweekly_start_on, row) }
    case 'interval':
      return { kind: 'interval', days: required(row.interval_days, row) }
    case 'one_off':
      return { kind: 'oneOff' }
  }
}

// Programación defensiva: las reglas (check) de la tabla tasks impiden que falte este dato,
// así que no debería pasar nunca. Si pasara, mejor avisar que inventarse una frecuencia.
function required<T>(value: T | null, row: TaskRow): T {
  if (value === null) {
    throw new Error(`La tarea «${row.name}» tiene una frecuencia incompleta.`)
  }
  return value
}
