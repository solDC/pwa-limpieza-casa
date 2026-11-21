import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, createUser, deleteUsers } from './helpers/database'

// US-41 · Cambiar cuándo toca la próxima vez (#59): la columna tasks.next_due_on, la función
// set_task_next_due_on y que se vacíe sola al terminar la vuelta, con sus reglas de seguridad.

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

/** Un día respecto a hoy en Madrid, como 'YYYY-MM-DD'. */
async function madridDay(days: number): Promise<string> {
  const { rows } = await db.query(
    `select to_char((now() at time zone 'Europe/Madrid')::date + $1::int, 'YYYY-MM-DD') as day`,
    [days],
  )
  return rows[0].day
}

/** Crea una tarea como la app, de cada 7 días (o de otra frecuencia), con partes si se piden. */
async function createTask(
  query: Query,
  { frequency = 'interval', parts = [] as string[] } = {},
): Promise<string> {
  const weights = parts.map(() => 100 / parts.length)
  const { rows } = await query(
    `select public.create_task($1, 'Cristales', $2, $3, $4, $5, $6) as id`,
    [
      anaHousehold,
      frequency,
      frequency === 'interval' ? 7 : null,
      frequency === 'weekend_biweekly' ? '2026-11-07' : null,
      parts,
      weights,
    ],
  )
  return rows[0].id
}

async function nextDueOnOf(query: Query, taskId: string): Promise<string | null> {
  const { rows } = await query(
    `select to_char(next_due_on, 'YYYY-MM-DD') as next_due_on from public.tasks where id = $1`,
    [taskId],
  )
  return rows[0].next_due_on
}

const setNextDueOn = (query: Query, taskId: string, day: string | null) =>
  query('select public.set_task_next_due_on($1, $2)', [taskId, day])

describe('US-41 · cambiar cuándo toca la próxima vez', () => {
  it('una tarea nueva no tiene ningún día elegido', async () => {
    const saved = await asUser(db, ana, async (query) => nextDueOnOf(query, await createTask(query)))
    expect(saved).toBeNull()
  })

  it('se puede elegir hoy o un día futuro, y volver a cambiarlo', async () => {
    const today = await madridDay(0)
    const tomorrow = await madridDay(1)
    const nextMonth = await madridDay(30)
    const steps = await asUser(db, ana, async (query) => {
      const id = await createTask(query)
      const seen: (string | null)[] = []
      for (const day of [tomorrow, nextMonth, today]) {
        await setNextDueOn(query, id, day)
        seen.push(await nextDueOnOf(query, id))
      }
      return seen
    })
    expect(steps).toEqual([tomorrow, nextMonth, today])
  })

  it('no se puede elegir un día pasado', async () => {
    const yesterday = await madridDay(-1)
    await expect(
      asUser(db, ana, async (query) => setNextDueOn(query, await createTask(query), yesterday)),
    ).rejects.toThrow(/hoy o un día futuro/)
  })

  it('si ya se ha hecho hoy, no se puede elegir hoy (no se puede volver a marcar hasta mañana)', async () => {
    const today = await madridDay(0)
    const tomorrow = await madridDay(1)
    const result = await asUser(db, ana, async (query) => {
      const id = await createTask(query)
      await query('insert into public.task_rounds (household_id, task_id, starts_on) values ($1, $2, $3)', [
        anaHousehold,
        id,
        today,
      ])
      // Mañana sí.
      await setNextDueOn(query, id, tomorrow)
      const saved = await nextDueOnOf(query, id)
      // Hoy no (después del error, la transacción ya no admite nada más).
      const error = await setNextDueOn(query, id, today).catch((e: { code: string; message: string }) => e)
      return { error, saved }
    })
    expect(result.error).toMatchObject({ code: '23505', message: expect.stringMatching(/Ya está hecha hoy/) })
    expect(result.saved).toBe(tomorrow)
  })

  it('no se puede dejar sin día', async () => {
    await expect(
      asUser(db, ana, async (query) => setNextDueOn(query, await createTask(query), null)),
    ).rejects.toThrow(/Falta el día/)
  })

  it('solo en las tareas de cada N días', async () => {
    const tomorrow = await madridDay(1)
    for (const frequency of ['one_off', 'weekend_weekly', 'weekend_biweekly']) {
      await expect(
        asUser(db, ana, async (query) => setNextDueOn(query, await createTask(query, { frequency }), tomorrow)),
      ).rejects.toThrow(/cada N días/)
    }
  })

  it('no en una tarea cancelada', async () => {
    const tomorrow = await madridDay(1)
    await expect(
      asUser(db, ana, async (query) => {
        const id = await createTask(query)
        await query('reset role')
        await query(`update public.tasks set cancelled_on = (now() at time zone 'Europe/Madrid')::date where id = $1`, [id])
        await query('set local role authenticated')
        await setNextDueOn(query, id, tomorrow)
      }),
    ).rejects.toThrow(/cada N días/)
  })

  it('la columna solo admite un día en las de cada N días', async () => {
    const tomorrow = await madridDay(1)
    await expect(
      asUser(db, ana, async (query) => {
        const id = await createTask(query, { frequency: 'one_off' })
        await query('reset role')
        await query('update public.tasks set next_due_on = $2 where id = $1', [id, tomorrow])
      }),
    ).rejects.toThrow(/tasks_next_due_on_check/)
  })
})

describe('US-41 · al terminar la vuelta', () => {
  it('al marcar la tarea como hecha, se olvida el día elegido', async () => {
    const tomorrow = await madridDay(1)
    const today = await madridDay(0)
    const saved = await asUser(db, ana, async (query) => {
      const id = await createTask(query)
      await setNextDueOn(query, id, tomorrow)
      await query('insert into public.task_rounds (household_id, task_id, starts_on) values ($1, $2, $3)', [
        anaHousehold,
        id,
        today,
      ])
      return nextDueOnOf(query, id)
    })
    expect(saved).toBeNull()
  })

  it('al marcar todas sus partes, también', async () => {
    const tomorrow = await madridDay(1)
    const today = await madridDay(0)
    const steps = await asUser(db, ana, async (query) => {
      const id = await createTask(query, { parts: ['Dentro', 'Fuera'] })
      await setNextDueOn(query, id, tomorrow)
      const { rows: parts } = await query('select id from public.task_parts where task_id = $1 order by position', [id])
      const markPart = (partId: string) =>
        query(
          'insert into public.task_part_completions (household_id, task_id, part_id, starts_on) values ($1, $2, $3, $4)',
          [anaHousehold, id, partId, today],
        )
      // Con una parte hecha, la vuelta sigue en curso y el día elegido se mantiene.
      await markPart(parts[0].id)
      const afterOne = await nextDueOnOf(query, id)
      await markPart(parts[1].id)
      return [afterOne, await nextDueOnOf(query, id)]
    })
    expect(steps).toEqual([tomorrow, null])
  })
})

describe('US-41 · seguridad', () => {
  it('nadie puede cambiar el día de una tarea de otro hogar', async () => {
    const tomorrow = await madridDay(1)
    await expect(
      asUser(db, bruno, async (query) => {
        // Una tarea del hogar de Ana, creada como administrador (asUser no guarda nada al acabar).
        await query('reset role')
        const { rows } = await query(
          `insert into public.tasks (household_id, name, frequency, interval_days)
           values ($1, 'Cristales', 'interval', 7) returning id`,
          [anaHousehold],
        )
        await query('set local role authenticated')
        await setNextDueOn(query, rows[0].id, tomorrow)
      }),
    ).rejects.toThrow(/No existe esa tarea en tu hogar/)
  })

  it('la app no puede escribir el día directamente en la tabla', async () => {
    const tomorrow = await madridDay(1)
    await expect(
      asUser(db, ana, async (query) => {
        const id = await createTask(query)
        await query('update public.tasks set next_due_on = $2 where id = $1', [id, tomorrow])
      }),
    ).rejects.toThrow(/permission denied/)
  })

  it('sin sesión no se puede cambiar el día', async () => {
    const tomorrow = await madridDay(1)
    await expect(
      asUser(db, null, (query) =>
        setNextDueOn(query, '00000000-0000-0000-0000-000000000000', tomorrow),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('la función que vacía el día al terminar la vuelta no la puede llamar la app', async () => {
    const { rows } = await db.query(
      `select role, has_function_privilege(role, 'public.clear_next_due_on_when_round_done()', 'execute') as allowed
       from unnest(array['anon', 'authenticated']) as role`,
    )
    expect(rows).toEqual([
      { role: 'anon', allowed: false },
      { role: 'authenticated', allowed: false },
    ])
  })
})
