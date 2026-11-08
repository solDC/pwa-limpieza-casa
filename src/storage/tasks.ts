import type { Frequency, Task } from '../domain/task'
import { getSupabase } from './supabase-client'

// Tareas del hogar (US-27). Las reglas RLS hacen que cada usuario solo vea las de su hogar.

type TaskRow = {
  id: string
  name: string
  frequency: 'weekend_weekly' | 'weekend_biweekly' | 'interval' | 'one_off'
  interval_days: number | null
  biweekly_start_on: string | null
  created_on: string
  cancelled_on: string | null
  task_parts: { id: string; name: string; weight: number; position: number }[]
}

/** Tareas no canceladas del hogar, en orden y con sus partes. */
export async function listTasks(): Promise<Task[]> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select(
      'id, name, frequency, interval_days, biweekly_start_on, created_on, cancelled_on, task_parts (id, name, weight, position)',
    )
    .is('cancelled_on', null)
    .order('position')
    .order('position', { referencedTable: 'task_parts' })
  if (error) throw new Error('No se han podido cargar tus tareas.')
  return (data as TaskRow[]).map(toTask)
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    name: row.name,
    frequency: toFrequency(row),
    parts: row.task_parts.map(({ id, name, weight }) => ({ id, name, weight })),
    createdOn: row.created_on,
    cancelledOn: row.cancelled_on,
  }
}

function toFrequency(row: TaskRow): Frequency {
  switch (row.frequency) {
    case 'weekend_weekly':
      return { kind: 'weekendWeekly' }
    case 'weekend_biweekly':
      return { kind: 'weekendBiweekly', startOn: row.biweekly_start_on ?? '' }
    case 'interval':
      return { kind: 'interval', days: row.interval_days ?? 1 }
    case 'one_off':
      return { kind: 'oneOff' }
  }
}
