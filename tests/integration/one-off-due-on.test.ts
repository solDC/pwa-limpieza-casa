import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, createUser, deleteUsers } from './helpers/database'

// US-38 · Poner fecha a una tarea puntual (#54): la columna tasks.due_on, la fecha al
// crearla (create_task) y la función set_task_due_on, con sus reglas de seguridad.

let db: pg.Client
let ana: string
let bruno: string
let anaHousehold: string
let brunoHousehold: string

beforeAll(async () => {
  db = connect()
  await db.connect()
  ana = await createUser(db)
  bruno = await createUser(db)
  anaHousehold = await householdOf(ana)
  brunoHousehold = await householdOf(bruno)
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

// Cada tarea con su nombre: no puede haber dos iguales en un hogar (US-54).
let created = 0

/** Crea una tarea como la app (con la fecha como octavo argumento) y devuelve su id. */
async function createTask(
  query: Query,
  { household = anaHousehold, frequency = 'one_off', dueOn = null as string | null } = {},
): Promise<string> {
  const { rows } = await query(
    `select public.create_task($1, $5, $2, $3, null, '{}', '{}', $4) as id`,
    [household, frequency, frequency === 'interval' ? 7 : null, dueOn, `Limpiar el horno ${++created}`],
  )
  return rows[0].id
}

async function dueOnOf(query: Query, taskId: string): Promise<string | null> {
  const { rows } = await query(
    `select to_char(due_on, 'YYYY-MM-DD') as due_on from public.tasks where id = $1`,
    [taskId],
  )
  return rows[0].due_on
}

describe('US-38 · al crear una tarea puntual', () => {
  it('se guarda con la fecha elegida, que puede ser hoy', async () => {
    const today = await madridDay(0)
    const nextWeek = await madridDay(7)
    const saved = await asUser(db, ana, async (query) => [
      await dueOnOf(query, await createTask(query, { dueOn: today })),
      await dueOnOf(query, await createTask(query, { dueOn: nextWeek })),
    ])
    expect(saved).toEqual([today, nextWeek])
  })

  it('sin fecha, queda sin fecha (y valen las llamadas de antes, sin el argumento)', async () => {
    const saved = await asUser(db, ana, async (query) => {
      const { rows } = await query(
        `select public.create_task($1, 'Limpiar el horno (antes)', 'one_off', null, null, '{}', '{}') as id`,
        [anaHousehold],
      )
      return [await dueOnOf(query, rows[0].id), await dueOnOf(query, await createTask(query))]
    })
    expect(saved).toEqual([null, null])
  })

  it('no se puede crear con una fecha pasada', async () => {
    const yesterday = await madridDay(-1)
    await expect(
      asUser(db, ana, (query) => createTask(query, { dueOn: yesterday })),
    ).rejects.toThrow(/hoy o un día futuro/)
  })

  // En las de cada N días, el mismo argumento es el día en que tocan la primera vez (US-50,
  // tests/integration/interval-next-due-on.test.ts).
  it('solo las puntuales llevan fecha', async () => {
    const tomorrow = await madridDay(1)
    await expect(
      asUser(db, ana, (query) => createTask(query, { frequency: 'weekend_weekly', dueOn: tomorrow })),
    ).rejects.toThrow(/tasks_due_on_check/)
  })
})

describe('US-38 · en una tarea puntual que ya existe', () => {
  it('se puede poner fecha, cambiarla y quitarla', async () => {
    const tomorrow = await madridDay(1)
    const nextMonth = await madridDay(30)
    const today = await madridDay(0)
    const steps = await asUser(db, ana, async (query) => {
      const id = await createTask(query)
      const seen: (string | null)[] = []
      for (const day of [tomorrow, nextMonth, today, null]) {
        await query('select public.set_task_due_on($1, $2)', [id, day])
        seen.push(await dueOnOf(query, id))
      }
      return seen
    })
    expect(steps).toEqual([tomorrow, nextMonth, today, null])
  })

  it('no se puede poner una fecha pasada', async () => {
    const yesterday = await madridDay(-1)
    await expect(
      asUser(db, ana, async (query) => {
        const id = await createTask(query)
        await query('select public.set_task_due_on($1, $2)', [id, yesterday])
      }),
    ).rejects.toThrow(/hoy o un día futuro/)
  })

  it('una puntual ya retrasada se puede pasar a hoy o a un día futuro', async () => {
    const today = await madridDay(0)
    const yesterday = await madridDay(-1)
    const saved = await asUser(db, ana, async (query) => {
      const id = await createTask(query)
      // Una fecha que ya ha pasado solo la puede poner el administrador (como en las pruebas).
      await query('reset role')
      await query('update public.tasks set due_on = $2 where id = $1', [id, yesterday])
      await query('set local role authenticated')
      await query('select public.set_task_due_on($1, $2)', [id, today])
      return dueOnOf(query, id)
    })
    expect(saved).toBe(today)
  })

  it('no se puede poner fecha a una tarea que no es puntual', async () => {
    const tomorrow = await madridDay(1)
    await expect(
      asUser(db, ana, async (query) => {
        const id = await createTask(query, { frequency: 'interval' })
        await query('select public.set_task_due_on($1, $2)', [id, tomorrow])
      }),
    ).rejects.toThrow(/tarea puntual pendiente/)
  })

  it('no se puede poner fecha a una puntual cancelada', async () => {
    const tomorrow = await madridDay(1)
    await expect(
      asUser(db, ana, async (query) => {
        const id = await createTask(query)
        await query('reset role')
        await query(`update public.tasks set cancelled_on = (now() at time zone 'Europe/Madrid')::date where id = $1`, [id])
        await query('set local role authenticated')
        await query('select public.set_task_due_on($1, $2)', [id, tomorrow])
      }),
    ).rejects.toThrow(/tarea puntual pendiente/)
  })

  it('no se puede poner fecha a una puntual ya hecha (por ejemplo, desde otro móvil)', async () => {
    const tomorrow = await madridDay(1)
    const error = await asUser(db, ana, async (query) => {
      const id = await createTask(query)
      await query('insert into public.task_rounds (household_id, task_id) values ($1, $2)', [anaHousehold, id])
      return query('select public.set_task_due_on($1, $2)', [id, tomorrow]).catch((e: { code: string }) => e)
    })
    expect(error).toMatchObject({ code: '23505' })
  })
})

describe('US-38 · seguridad', () => {
  it('nadie puede cambiar la fecha de una tarea de otro hogar', async () => {
    const tomorrow = await madridDay(1)
    await expect(
      asUser(db, bruno, async (query) => {
        await query('reset role')
        const id = await createTaskAsAdmin(query, anaHousehold)
        await query('set local role authenticated')
        await query('select public.set_task_due_on($1, $2)', [id, tomorrow])
      }),
    ).rejects.toThrow(/No existe esa tarea en tu hogar/)
  })

  it('nadie puede crear una tarea con fecha en otro hogar', async () => {
    const tomorrow = await madridDay(1)
    await expect(
      asUser(db, bruno, (query) => createTask(query, { household: anaHousehold, dueOn: tomorrow })),
    ).rejects.toThrow(/No eres miembro/)
    // Y en el suyo, sí.
    const id = await asUser(db, bruno, (query) =>
      createTask(query, { household: brunoHousehold, dueOn: tomorrow }),
    )
    expect(id).toBeTruthy()
  })

  it('la app no puede escribir la fecha directamente en la tabla', async () => {
    const tomorrow = await madridDay(1)
    await expect(
      asUser(db, ana, async (query) => {
        const id = await createTask(query)
        await query('update public.tasks set due_on = $2 where id = $1', [id, tomorrow])
      }),
    ).rejects.toThrow(/permission denied/)
  })

  it('sin sesión no se puede poner fecha', async () => {
    const tomorrow = await madridDay(1)
    await expect(
      asUser(db, null, (query) =>
        query('select public.set_task_due_on($1, $2)', ['00000000-0000-0000-0000-000000000000', tomorrow]),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('la comprobación de la fecha no la puede llamar la app', async () => {
    await expect(
      asUser(db, ana, (query) => query(`select public.check_due_on_not_past(current_date)`)),
    ).rejects.toThrow(/permission denied/)
  })
})

/** Una tarea puntual creada directamente como administrador, sin pasar por create_task. */
async function createTaskAsAdmin(query: Query, household: string): Promise<string> {
  const { rows } = await query(
    `insert into public.tasks (household_id, name, frequency) values ($1, 'Limpiar el horno', 'one_off') returning id`,
    [household],
  )
  return rows[0].id
}
