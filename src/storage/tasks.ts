import { AppError } from '../domain/errors'
import type { Round } from '../domain/frequency'
import { MAX_PARTS, type NewTask } from '../domain/new-task'
import type { Frequency, LocalDate, Task } from '../domain/task'
import { getSupabase } from './supabase-client'

// Tareas del hogar (US-27 y US-33) y sus vueltas terminadas (US-30).
// Las reglas RLS hacen que cada usuario solo vea y apunte las de su hogar.

type TaskRow = {
  id: string
  household_id: string
  name: string
  default_key: string | null
  frequency: 'weekend_weekly' | 'weekend_biweekly' | 'interval' | 'one_off'
  interval_days: number | null
  biweekly_start_on: string | null
  created_on: string
  cancelled_on: string | null
  task_parts: { id: string; name: string; default_key: string | null; weight: number; position: number }[]
  // Solo la última vuelta terminada.
  task_rounds: { completed_on: string }[]
  // Las últimas partes hechas: como mucho, tantas como partes puede tener una tarea.
  task_part_completions: { part_id: string; starts_on: string | null }[]
}

/** Tareas no canceladas del hogar, en orden y con sus partes. */
export async function listTasks(): Promise<Task[]> {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select(
      'id, household_id, name, default_key, frequency, interval_days, biweekly_start_on, created_on, cancelled_on, task_parts (id, name, default_key, weight, position), task_rounds (completed_on), task_part_completions (part_id, starts_on)',
    )
    .is('cancelled_on', null)
    .order('position')
    .order('position', { referencedTable: 'task_parts' })
    .order('completed_on', { referencedTable: 'task_rounds', ascending: false })
    .limit(1, { referencedTable: 'task_rounds' })
    // Las partes hechas de la vuelta en curso son siempre las más recientes de la tarea.
    .order('created_at', { referencedTable: 'task_part_completions', ascending: false })
    .limit(MAX_PARTS, { referencedTable: 'task_part_completions' })
  if (error) throw new AppError('tasksLoad')
  return (data as TaskRow[]).map(toTask)
}

/** La tarea ya estaba marcada como hecha (por ejemplo, desde otro dispositivo). */
export class AlreadyDoneError extends AppError {
  constructor() {
    super('alreadyDone')
    this.name = 'AlreadyDoneError'
  }
}

/**
 * Marca como hecha la vuelta de una tarea (US-30). La base de datos apunta el día:
 * hoy en Madrid. Devuelve ese día.
 * Si ya estaba hecha, lanza `AlreadyDoneError`, para que la pantalla se ponga al día.
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
  // Códigos de error de PostgreSQL de las reglas de task_rounds.
  // 23505: ya hay una vuelta igual, o una del mismo día.
  if (error?.code === '23505') throw new AlreadyDoneError()
  // 23514: la vuelta no incluye el día de hoy, porque la fecha del dispositivo va mal.
  if (error?.code === '23514') throw new AppError('deviceDate')
  if (error) throw new AppError('saveFailed')
  return (data as { completed_on: string }).completed_on
}

/**
 * Marca como hechas esas partes en la vuelta de una tarea (US-39), todas o ninguna. La base
 * de datos apunta el día (hoy en Madrid) y el peso de cada parte y, si ya están todas, la
 * vuelta como terminada. Devuelve ese día.
 * Si alguna ya estaba hecha, lanza `AlreadyDoneError`, para que la pantalla se ponga al día.
 */
export async function completeParts(task: Task, round: Round, partIds: string[]): Promise<LocalDate> {
  const { data, error } = await getSupabase()
    .from('task_part_completions')
    .insert(
      partIds.map((partId) => ({
        household_id: task.householdId,
        task_id: task.id,
        part_id: partId,
        starts_on: round.startsOn,
        due_by: round.dueBy,
      })),
    )
    .select('completed_on')
  // Los mismos códigos que en `completeTask`: 23505, la parte ya estaba hecha en esta vuelta
  // (o la tarea ya se ha terminado hoy); 23514, la fecha del dispositivo va mal.
  if (error?.code === '23505') throw new AlreadyDoneError()
  if (error?.code === '23514') throw new AppError('deviceDate')
  if (error || !data?.length) throw new AppError('saveFailed')
  return (data as { completed_on: string }[])[0].completed_on
}

/**
 * Añade una tarea al hogar (US-33), con sus partes, de una vez: si falla, no se guarda
 * nada. La base de datos pone el día de creación (hoy en Madrid) y la pone al final.
 */
export async function createTask(householdId: string, task: NewTask): Promise<void> {
  const { frequency } = task
  const { error } = await getSupabase().rpc('create_task', {
    target_household_id: householdId,
    task_name: task.name,
    task_frequency: toFrequencyColumn(frequency),
    task_interval_days: frequency.kind === 'interval' ? frequency.days : null,
    task_biweekly_start_on: frequency.kind === 'weekendBiweekly' ? frequency.startOn : null,
    part_names: task.parts.map((part) => part.name),
    part_weights: task.parts.map((part) => part.weight),
  })
  if (error) throw new AppError('taskSaveFailed')
}

function toFrequencyColumn(frequency: Frequency): TaskRow['frequency'] {
  switch (frequency.kind) {
    case 'weekendWeekly':
      return 'weekend_weekly'
    case 'weekendBiweekly':
      return 'weekend_biweekly'
    case 'interval':
      return 'interval'
    case 'oneOff':
      return 'one_off'
  }
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    defaultKey: row.default_key,
    frequency: toFrequency(row),
    parts: row.task_parts.map((part) => ({
      id: part.id,
      name: part.name,
      defaultKey: part.default_key,
      weight: part.weight,
    })),
    createdOn: row.created_on,
    cancelledOn: row.cancelled_on,
    lastCompletedOn: row.task_rounds[0]?.completed_on ?? null,
    partCompletions: row.task_part_completions.map((completion) => ({
      partId: completion.part_id,
      startsOn: completion.starts_on,
    })),
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
