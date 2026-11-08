import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, createUser, deleteUsers } from './helpers/database'

// US-30 · Marcar una tarea como hecha (#39)
// y las reglas de seguridad (RLS) de task_rounds.

let db: pg.Client
let ana: string
let bruno: string

beforeAll(async () => {
  db = connect()
  await db.connect()
  ana = await createUser(db)
  bruno = await createUser(db)
})

afterAll(async () => {
  await deleteUsers(db, [ana, bruno])
  await db.end()
})

/** El hogar del usuario y el id de una de sus tareas, por nombre. */
async function taskOf(userId: string, name: string): Promise<{ household: string; task: string }> {
  const { rows } = await db.query(
    `select t.household_id as household, t.id as task
     from public.tasks t
     join public.household_members m on m.household_id = t.household_id
     where m.user_id = $1 and t.name = $2`,
    [userId, name],
  )
  return rows[0]
}

const insertRound = `insert into public.task_rounds (household_id, task_id, starts_on, due_by)
  values ($1, $2, $3, $4) returning to_char(completed_on, 'YYYY-MM-DD') as completed_on`

describe('US-30 · marcar una tarea como hecha', () => {
  it('apunto la vuelta de una tarea de mi hogar, con el día de hoy en Madrid', async () => {
    const { household, task } = await taskOf(ana, 'Cristales y espejos')
    const result = await asUser(db, ana, async (query) => {
      const inserted = await query(insertRound, [household, task, '2026-11-08', null])
      const today = await query(
        `select to_char((now() at time zone 'Europe/Madrid')::date, 'YYYY-MM-DD') as today`,
      )
      return { completedOn: inserted.rows[0].completed_on, today: today.rows[0].today }
    })
    expect(result.completedOn).toBe(result.today)
  })

  it('la app no puede elegir el día en que se hizo', async () => {
    const { household, task } = await taskOf(ana, 'Baño')
    await expect(
      asUser(db, ana, (query) =>
        query(
          `insert into public.task_rounds (household_id, task_id, starts_on, completed_on)
           values ($1, $2, '2026-11-08', '2026-11-01')`,
          [household, task],
        ),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('la misma vuelta no se apunta dos veces', async () => {
    const { household, task } = await taskOf(ana, 'Baño')
    await expect(
      asUser(db, ana, async (query) => {
        await query(insertRound, [household, task, '2026-11-08', null])
        await query(insertRound, [household, task, '2026-11-08', null])
      }),
    ).rejects.toThrow(/task_rounds_task_id_starts_on_key/)
  })

  // Regresión: con dos «Hecha» el mismo día se guardaba la vuelta siguiente sin que cambiara
  // la última, y la tarea quedaba bloqueada.
  it('una tarea no se marca dos veces el mismo día', async () => {
    const { household, task } = await taskOf(ana, 'Baño')
    await expect(
      asUser(db, ana, async (query) => {
        await query(insertRound, [household, task, '2026-11-08', null])
        await query(insertRound, [household, task, '2026-11-11', null])
      }),
    ).rejects.toThrow(/task_rounds_task_id_completed_on_key/)
  })

  // Si el reloj del móvil va mal, la vuelta que manda puede no ser la de hoy.
  it('en las de fin de semana, el día de hoy tiene que estar dentro de la vuelta', async () => {
    const { household, task } = await taskOf(ana, 'Superficies')
    await expect(
      asUser(db, ana, (query) => query(insertRound, [household, task, '2026-01-03', '2026-01-09'])),
    ).rejects.toThrow(/task_rounds_completed_on_check/)
  })

  it('en las de fin de semana, se apunta la vuelta en la que está hoy', async () => {
    const { household, task } = await taskOf(ana, 'Superficies')
    // La vuelta de hoy en Madrid: desde el último sábado hasta el viernes siguiente.
    const { rows } = await db.query(
      `select to_char(d - ((extract(dow from d)::int + 1) % 7), 'YYYY-MM-DD') as starts_on,
              to_char(d - ((extract(dow from d)::int + 1) % 7) + 6, 'YYYY-MM-DD') as due_by,
              to_char(d, 'YYYY-MM-DD') as today
       from (select (now() at time zone 'Europe/Madrid')::date as d) as madrid`,
    )
    const [{ starts_on: startsOn, due_by: dueBy, today }] = rows
    const inserted = await asUser(db, ana, (query) =>
      query(insertRound, [household, task, startsOn, dueBy]),
    )
    expect(inserted.rows[0].completed_on).toBe(today)
  })

  it('una puntual solo se hace una vez', async () => {
    const { household, task } = await taskOf(ana, 'Cepillar suelo')
    await expect(
      asUser(db, ana, async (query) => {
        await query(insertRound, [household, task, null, null])
        await query(insertRound, [household, task, null, null])
      }),
    ).rejects.toThrow(/task_rounds_task_id_starts_on_key/)
  })

})

describe('US-30 · solo veo y apunto vueltas de mi hogar (RLS)', () => {
  it('un usuario solo ve las vueltas de su hogar', async () => {
    const anaTask = await taskOf(ana, 'Baño')
    const brunoTask = await taskOf(bruno, 'Baño')
    await db.query(insertRound, [anaTask.household, anaTask.task, '2026-11-01', null])
    await db.query(insertRound, [brunoTask.household, brunoTask.task, '2026-11-01', null])

    const seen = await asUser(db, ana, (query) =>
      query('select distinct household_id from public.task_rounds'),
    )
    expect(seen.rows).toEqual([{ household_id: anaTask.household }])
  })

  it('no puedo apuntar una vuelta en el hogar de otro', async () => {
    const { household, task } = await taskOf(bruno, 'Cristales y espejos')
    await expect(
      asUser(db, ana, (query) => query(insertRound, [household, task, '2026-11-14', null])),
    ).rejects.toThrow(/row-level security/)
  })

  it('no puedo apuntar en mi hogar una vuelta de una tarea de otro hogar', async () => {
    const mine = await taskOf(ana, 'Cristales y espejos')
    const theirs = await taskOf(bruno, 'Cristales y espejos')
    await expect(
      asUser(db, ana, (query) =>
        query(insertRound, [mine.household, theirs.task, '2026-11-14', null]),
      ),
    ).rejects.toThrow(/task_rounds_task_fkey/)
  })

  it('no puedo cambiar ni borrar vueltas desde la app', async () => {
    for (const sql of [
      `update public.task_rounds set starts_on = '2026-01-01'`,
      `delete from public.task_rounds`,
    ]) {
      await expect(asUser(db, ana, (query) => query(sql))).rejects.toThrow(/permission denied/)
    }
  })

  it('sin sesión no se puede leer ni apuntar nada', async () => {
    const { household, task } = await taskOf(ana, 'Baño')
    await expect(
      asUser(db, null, (query) => query('select * from public.task_rounds')),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(db, null, (query) => query(insertRound, [household, task, '2026-12-01', null])),
    ).rejects.toThrow(/permission denied/)
  })
})
