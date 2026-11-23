import { addDays } from '../domain/dates'
import { AppError } from '../domain/errors'
import type { CompletedRound, DonePart } from '../domain/history'
import type { LocalDate } from '../domain/task'
import { getSupabase } from './supabase-client'

// US-31 · Lo guardado de las vueltas, para el histórico: las vueltas terminadas
// (`task_rounds`) y las partes hechas (`task_part_completions`). Las reglas RLS hacen que
// cada usuario solo vea las de su hogar.

/**
 * Lo que hace falta para el histórico de los días de `from` a `to`: las vueltas terminadas
 * esos días o la semana anterior (las de fin de semana cuyo plazo acaba esos días pueden
 * haberse terminado hasta 6 días antes) y las partes hechas de las vueltas de fin de semana
 * cuyo plazo acaba esos días, con el día en que se quitó la parte (US-51), si se quitó.
 */
export async function listHistory(
  from: LocalDate,
  to: LocalDate,
): Promise<{ rounds: CompletedRound[]; parts: DonePart[] }> {
  const supabase = getSupabase()
  const [rounds, parts] = await Promise.all([
    supabase
      .from('task_rounds')
      .select('task_id, starts_on, completed_on')
      .gte('completed_on', addDays(from, -6))
      .lte('completed_on', to),
    supabase
      .from('task_part_completions')
      .select('task_id, starts_on, due_by, weight, task_parts!task_part_completions_part_fkey (archived_on)')
      .gte('due_by', from)
      .lte('due_by', to),
  ])
  if (rounds.error || parts.error) throw new AppError('historyLoad')
  return {
    rounds: (rounds.data as { task_id: string; starts_on: string | null; completed_on: string }[]).map((row) => ({
      taskId: row.task_id,
      startsOn: row.starts_on,
      completedOn: row.completed_on,
    })),
    parts: (
      parts.data as unknown as {
        task_id: string
        starts_on: string | null
        due_by: string | null
        weight: number
        task_parts: { archived_on: string | null }
      }[]
    ).map((row) => ({
      taskId: row.task_id,
      startsOn: row.starts_on,
      dueBy: row.due_by,
      weight: row.weight,
      removedOn: row.task_parts.archived_on,
    })),
  }
}
