import { AppError } from '../domain/errors'
import type { Round } from '../domain/frequency'
import { MAX_PARTS, type NewTask } from '../domain/new-task'
import type { PartsChange } from '../domain/edit-parts'
import type { TaskRename } from '../domain/rename-task'
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
  // Solo en las semanales: el sábado desde el que tocan, si se han movido (US-42).
  weekly_start_on: string | null
  // Solo en las puntuales, y opcional (US-38).
  due_on: string | null
  // Solo en las de cada N días: el día elegido para la próxima vez, si se ha cambiado (US-41).
  next_due_on: string | null
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
      'id, household_id, name, default_key, frequency, interval_days, biweekly_start_on, weekly_start_on, due_on, next_due_on, created_on, cancelled_on, task_parts (id, name, default_key, weight, position), task_rounds (completed_on), task_part_completions (part_id, starts_on)',
    )
    .is('cancelled_on', null)
    // Las partes quitadas (archivadas, US-51) ya no son de la tarea.
    .is('task_parts.archived_on', null)
    .order('position')
    .order('position', { referencedTable: 'task_parts' })
    .order('completed_on', { referencedTable: 'task_rounds', ascending: false })
    .limit(1, { referencedTable: 'task_rounds' })
    // Las partes hechas de la vuelta en curso son siempre las más recientes de la tarea. Puede
    // haber más que partes, si se han quitado algunas ya hechas en la vuelta (US-51): con el
    // doble de margen se ven siempre las de las partes que quedan.
    .order('created_at', { referencedTable: 'task_part_completions', ascending: false })
    .limit(MAX_PARTS * 2, { referencedTable: 'task_part_completions' })
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
    // El día en que toca: la fecha de una puntual (US-38) o la primera vez de una de cada N
    // días (US-50). Es el mismo argumento.
    task_due_on: dueOnOf(frequency),
  })
  // 23514 con fecha: ya ha pasado para la base de datos (hoy en Madrid), porque la fecha del
  // dispositivo va mal (US-38 y US-50). Sin fecha, 23514 es otra regla de la tabla (el
  // formulario ya la comprueba): un fallo general, no uno de la fecha.
  const hasDueOn = dueOnOf(frequency) !== null
  if (error?.code === '23514' && hasDueOn) throw new AppError('deviceDate')
  // 23505: ya hay otra tarea con ese nombre (US-54). El formulario ya lo comprueba con la
  // lista; llega aquí si se ha añadido en otro dispositivo.
  if (error?.code === '23505') throw new AppError('duplicateTaskName')
  if (error) throw new AppError('taskSaveFailed')
}

/**
 * US-54 · Cambia el nombre de una tarea (`rename.name`, si no es `null`) y el de algunas de
 * sus partes. Lo renombrado deja de traducirse: la base de datos le quita la clave.
 */
export async function renameTask(taskId: string, rename: TaskRename): Promise<void> {
  const { error } = await getSupabase().rpc('rename_task', {
    target_task_id: taskId,
    new_name: rename.name,
    part_ids: rename.parts.map((part) => part.id),
    part_names: rename.parts.map((part) => part.name),
  })
  // 23505: ya hay otra tarea con ese nombre (añadida o renombrada en otro dispositivo).
  if (error?.code === '23505') throw new AppError('duplicateTaskName')
  if (error) throw new AppError('saveFailed')
}

/** Las partes de la tarea han cambiado en otro dispositivo (US-51): hay que volver a cargarla. */
export class StalePartsError extends AppError {
  constructor() {
    super('staleParts')
    this.name = 'StalePartsError'
  }
}

/**
 * US-51 · Cambia las partes de una tarea de una vez: los pesos de las que siguen, las nuevas
 * al final y las demás se quitan (se archivan). `round` es la vuelta que se muestra: si con
 * el cambio ya están hechas todas las que quedan, la base de datos la da por terminada.
 * Devuelve los ids de las partes nuevas, en su orden, y el día en que se ha terminado la
 * vuelta (`null` si no).
 */
export async function setTaskParts(
  taskId: string,
  round: Round,
  change: PartsChange,
): Promise<{ newPartIds: string[]; completedOn: LocalDate | null }> {
  const { data, error } = await getSupabase().rpc('set_task_parts', {
    target_task_id: taskId,
    kept_part_ids: change.kept.map((part) => part.id),
    kept_weights: change.kept.map((part) => part.weight),
    new_part_names: change.added.map((part) => part.name),
    new_part_weights: change.added.map((part) => part.weight),
    round_starts_on: round.startsOn,
    round_due_by: round.dueBy,
  })
  // Los códigos de set_task_parts: 22023, alguna parte ya no es de la tarea (se ha cambiado
  // en otro dispositivo); 23505, la tarea ya se ha terminado hoy (en otro dispositivo).
  if (error?.code === '22023') throw new StalePartsError()
  if (error?.code === '23505') throw new AlreadyDoneError()
  if (error || !data) throw new AppError('saveFailed')
  const result = data as { new_part_ids: string[]; completed_on: string | null }
  return { newPartIds: result.new_part_ids, completedOn: result.completed_on }
}

/**
 * US-38 · Pone la fecha de una tarea puntual, la cambia o, con `null`, la quita.
 * Si ya estaba hecha (por ejemplo, desde otro dispositivo), lanza `AlreadyDoneError`, para
 * que la pantalla se ponga al día.
 */
export async function setTaskDueOn(taskId: string, dueOn: LocalDate | null): Promise<void> {
  const { error } = await getSupabase().rpc('set_task_due_on', {
    target_task_id: taskId,
    new_due_on: dueOn,
  })
  // Los códigos de set_task_due_on: 23505, ya está hecha; 23514, la fecha ya ha pasado
  // para la base de datos (hoy en Madrid), porque la fecha del dispositivo va mal.
  if (error?.code === '23505') throw new AlreadyDoneError()
  if (error?.code === '23514') throw new AppError('deviceDate')
  if (error) throw new AppError('saveFailed')
}

/**
 * US-41 · Cambia el día en que toca la próxima vez una tarea de cada N días. Al terminar la
 * vuelta, la base de datos lo olvida y la siguiente se cuenta desde el día en que se hizo.
 * Si ya se ha hecho hoy en otro dispositivo y se elige hoy, lanza `AlreadyDoneError`, para
 * que la pantalla se ponga al día.
 */
export async function setTaskNextDueOn(taskId: string, nextDueOn: LocalDate): Promise<void> {
  const { error } = await getSupabase().rpc('set_task_next_due_on', {
    target_task_id: taskId,
    new_next_due_on: nextDueOn,
  })
  // Los códigos de set_task_next_due_on: 23505, ya se ha hecho hoy (en otro dispositivo,
  // porque el formulario no deja elegir hoy si se ha hecho en este) y se ha elegido hoy;
  // 23514, el día ya ha pasado para la base de datos (hoy en Madrid), porque la fecha del
  // dispositivo va mal.
  if (error?.code === '23505') throw new AlreadyDoneError()
  if (error?.code === '23514') throw new AppError('deviceDate')
  if (error) throw new AppError('saveFailed')
}

/**
 * US-42 · Mueve una tarea de fin de semana al finde que empieza ese sábado. En las semanales
 * solo se mueve la vuelta; en las de cada 15 días, todo el calendario.
 */
export async function moveWeekendTask(taskId: string, saturday: LocalDate): Promise<void> {
  const { error } = await getSupabase().rpc('move_weekend_task', {
    target_task_id: taskId,
    new_saturday: saturday,
  })
  // 23514: el finde ya ha pasado para la base de datos (hoy en Madrid), porque la fecha del
  // dispositivo va mal.
  if (error?.code === '23514') throw new AppError('deviceDate')
  if (error) throw new AppError('saveFailed')
}

/** El día en que toca al crear la tarea, si se ha elegido (`null` si no). */
function dueOnOf(frequency: Frequency): LocalDate | null {
  if (frequency.kind === 'oneOff') return frequency.dueOn
  if (frequency.kind === 'interval') return frequency.nextDueOn
  return null
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
      return { kind: 'weekendWeekly', startOn: row.weekly_start_on }
    case 'weekend_biweekly':
      return { kind: 'weekendBiweekly', startOn: required(row.biweekly_start_on, row) }
    case 'interval':
      return { kind: 'interval', days: required(row.interval_days, row), nextDueOn: row.next_due_on }
    case 'one_off':
      return { kind: 'oneOff', dueOn: row.due_on }
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
