import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, createUser, deleteUsers } from './helpers/database'

// US-42 · Mover una tarea de fin de semana a otro finde (#60): la columna
// tasks.weekly_start_on y la función move_weekend_task, con sus reglas de seguridad.

let db: pg.Client
let ana: string
let bruno: string
let anaHousehold: string

beforeAll(async () => {
  db = connect()
  await db.connect()
  ana = await createUser(db)
  bruno = await createUser(db)
  anaHousehold = await householdOf(ana)
})

afterAll(async () => {
  await deleteUsers(db, [ana, bruno])
  await db.end()
})

async function householdOf(userId: string): Promise<string> {
  const { rows } = await db.query(
    'select household_id from public.household_members where user_id = $1',
    [userId],
  )
  return rows[0].household_id
}

type Query = (sql: string, params?: unknown[]) => Promise<pg.QueryResult>

/**
 * El sábado del finde que toca mover a partir de hoy en Madrid: el de hoy si es sábado o
 * domingo y, si no, el siguiente; con `weeks`, tantas semanas después.
 */
async function saturday(weeks = 0): Promise<string> {
  const { rows } = await db.query(
    `select to_char(d - ((extract(isodow from d)::int + 1) % 7) + 7 * (case when extract(isodow from d) in (6, 7) then 0 else 1 end) + 7 * $1::int, 'YYYY-MM-DD') as day
     from (select (now() at time zone 'Europe/Madrid')::date as d) as today`,
    [weeks],
  )
  return rows[0].day
}

/** El id de una de las tareas por defecto del hogar de Ana. */
async function taskId(query: Query, name: string): Promise<string> {
  const { rows } = await query('select id from public.tasks where household_id = $1 and name = $2', [
    anaHousehold,
    name,
  ])
  return rows[0].id
}

async function startsOf(query: Query, id: string) {
  const { rows } = await query(
    `select to_char(weekly_start_on, 'YYYY-MM-DD') as weekly, to_char(biweekly_start_on, 'YYYY-MM-DD') as biweekly
     from public.tasks where id = $1`,
    [id],
  )
  return rows[0]
}

const move = (query: Query, id: string, day: string) =>
  query('select public.move_weekend_task($1, $2)', [id, day])

describe('US-42 · mover una tarea de fin de semana', () => {
  it('una semanal guarda el finde desde el que vuelve a tocar', async () => {
    const nextWeek = await saturday(1)
    const saved = await asUser(db, ana, async (query) => {
      const id = await taskId(query, 'Superficies')
      const before = await startsOf(query, id)
      await move(query, id, nextWeek)
      return [before, await startsOf(query, id)]
    })
    expect(saved).toEqual([
      { weekly: null, biweekly: null },
      { weekly: nextWeek, biweekly: null },
    ])
  })

  it('en una de cada 15 días se mueve todo el calendario', async () => {
    const inThreeWeeks = await saturday(3)
    const saved = await asUser(db, ana, async (query) => {
      const id = await taskId(query, 'Aspirar cosas de Cati')
      await move(query, id, inThreeWeeks)
      return startsOf(query, id)
    })
    expect(saved).toEqual({ weekly: null, biweekly: inThreeWeeks })
  })

  it('se puede mover al finde actual (o al siguiente, entre semana)', async () => {
    const current = await saturday(0)
    const saved = await asUser(db, ana, async (query) => {
      const id = await taskId(query, 'Superficies')
      await move(query, id, current)
      return startsOf(query, id)
    })
    expect(saved.weekly).toBe(current)
  })

  it('no a un finde que ya ha pasado', async () => {
    const lastWeek = await saturday(-1)
    await expect(
      asUser(db, ana, async (query) => move(query, await taskId(query, 'Superficies'), lastWeek)),
    ).rejects.toThrow(/finde actual o uno posterior/)
  })

  it('solo a un sábado', async () => {
    const { rows } = await db.query(`select to_char($1::date + 1, 'YYYY-MM-DD') as day`, [await saturday(1)])
    await expect(
      asUser(db, ana, async (query) => move(query, await taskId(query, 'Superficies'), rows[0].day)),
    ).rejects.toThrow(/sábado/)
  })

  it('solo las de fin de semana', async () => {
    const nextWeek = await saturday(1)
    for (const name of ['Baño', 'Cepillar suelo']) {
      await expect(
        asUser(db, ana, async (query) => move(query, await taskId(query, name), nextWeek)),
      ).rejects.toThrow(/de fin de semana/)
    }
  })

  it('no una cancelada', async () => {
    const nextWeek = await saturday(1)
    await expect(
      asUser(db, ana, async (query) => {
        const id = await taskId(query, 'Superficies')
        await query('reset role')
        await query(`update public.tasks set cancelled_on = (now() at time zone 'Europe/Madrid')::date where id = $1`, [id])
        await query('set local role authenticated')
        await move(query, id, nextWeek)
      }),
    ).rejects.toThrow(/de fin de semana/)
  })

  it('la columna solo admite un sábado y solo en las semanales', async () => {
    const nextWeek = await saturday(1)
    await expect(
      asUser(db, ana, async (query) => {
        const id = await taskId(query, 'Baño')
        await query('reset role')
        await query('update public.tasks set weekly_start_on = $2 where id = $1', [id, nextWeek])
      }),
    ).rejects.toThrow(/tasks_weekly_start_on_check/)
    await expect(
      asUser(db, ana, async (query) => {
        const id = await taskId(query, 'Superficies')
        await query('reset role')
        await query(`update public.tasks set weekly_start_on = $2::date + 1 where id = $1`, [id, nextWeek])
      }),
    ).rejects.toThrow(/tasks_weekly_start_on_saturday_check/)
  })
})

describe('US-42 · seguridad', () => {
  it('nadie puede mover una tarea de otro hogar', async () => {
    const nextWeek = await saturday(1)
    await expect(
      asUser(db, bruno, async (query) => {
        await query('reset role')
        const { rows } = await query(
          `select id from public.tasks where household_id = $1 and name = 'Superficies'`,
          [anaHousehold],
        )
        await query('set local role authenticated')
        await move(query, rows[0].id, nextWeek)
      }),
    ).rejects.toThrow(/No existe esa tarea en tu hogar/)
  })

  it('la app no puede escribir los findes directamente en la tabla', async () => {
    const nextWeek = await saturday(1)
    for (const column of ['weekly_start_on', 'biweekly_start_on']) {
      await expect(
        asUser(db, ana, async (query) => {
          const id = await taskId(query, column === 'weekly_start_on' ? 'Superficies' : 'Aspirar cosas de Cati')
          await query(`update public.tasks set ${column} = $2 where id = $1`, [id, nextWeek])
        }),
      ).rejects.toThrow(/permission denied/)
    }
  })

  it('sin sesión no se puede mover', async () => {
    const nextWeek = await saturday(1)
    await expect(
      asUser(db, null, (query) => move(query, '00000000-0000-0000-0000-000000000000', nextWeek)),
    ).rejects.toThrow(/permission denied/)
  })
})
