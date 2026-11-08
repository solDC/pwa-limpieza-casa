import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, createUser, deleteUsers } from './helpers/database'

// US-27 · Mis tareas por defecto (#36)
// y las reglas de seguridad (RLS) de tasks y task_parts.

const defaultTasks = [
  { name: 'Superficies', frequency: 'weekend_weekly', interval_days: null, biweekly_start_on: null },
  { name: 'Baño', frequency: 'interval', interval_days: 3, biweekly_start_on: null },
  {
    name: 'Aspirar cosas de Cati',
    frequency: 'weekend_biweekly',
    interval_days: null,
    biweekly_start_on: '2026-12-05',
  },
  { name: 'Cristales y espejos', frequency: 'interval', interval_days: 30, biweekly_start_on: null },
  { name: 'Cepillar suelo', frequency: 'one_off', interval_days: null, biweekly_start_on: null },
  { name: 'Limpiar juntas', frequency: 'one_off', interval_days: null, biweekly_start_on: null },
]

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

async function householdOf(userId: string): Promise<string> {
  const { rows } = await db.query(
    'select household_id from public.household_members where user_id = $1',
    [userId],
  )
  return rows[0].household_id
}

async function tasksOf(householdId: string) {
  const { rows } = await db.query(
    `select name, frequency, interval_days, to_char(biweekly_start_on, 'YYYY-MM-DD') as biweekly_start_on
     from public.tasks where household_id = $1 order by position`,
    [householdId],
  )
  return rows
}

async function backfill(): Promise<void> {
  await db.query('select public.create_default_tasks_for_existing_households()')
}

describe('US-27 · al crearse el hogar se crean mis tareas por defecto', () => {
  it('el hogar nuevo tiene exactamente las 6 tareas, en orden y con su frecuencia', async () => {
    expect(await tasksOf(await householdOf(ana))).toEqual(defaultTasks)
  })

  it('Superficies tiene sus 3 partes con su peso, que suman 100', async () => {
    const { rows } = await db.query(
      `select p.name, p.weight
       from public.task_parts p
       join public.tasks t on t.id = p.task_id
       where t.household_id = $1 and t.name = 'Superficies'
       order by p.position`,
      [await householdOf(ana)],
    )
    expect(rows).toEqual([
      { name: 'Cocina', weight: 50 },
      { name: 'Salón', weight: 25 },
      { name: 'Dormitorio', weight: 25 },
    ])
  })

  it('solo Superficies tiene partes', async () => {
    const { rows } = await db.query(
      `select distinct t.name from public.task_parts p join public.tasks t on t.id = p.task_id
       where t.household_id = $1`,
      [await householdOf(ana)],
    )
    expect(rows).toEqual([{ name: 'Superficies' }])
  })

  it('se crean con la fecha de hoy en Madrid y sin cancelar', async () => {
    const { rows } = await db.query(
      `select count(*)::int as wrong from public.tasks
       where household_id = $1
         and (created_on <> (now() at time zone 'Europe/Madrid')::date or cancelled_on is not null)`,
      [await householdOf(ana)],
    )
    expect(rows[0].wrong).toBe(0)
  })
})

describe('US-27 · los hogares que ya existían también las reciben, una sola vez', () => {
  it('un hogar sin tareas las recibe al rellenar', async () => {
    const household = await householdOf(bruno)
    await db.query('delete from public.tasks where household_id = $1', [household])
    expect(await tasksOf(household)).toEqual([])

    await backfill()

    expect(await tasksOf(household)).toEqual(defaultTasks)
  })

  it('un hogar que ya tiene tareas no recibe una segunda copia', async () => {
    await backfill()
    expect(await tasksOf(await householdOf(ana))).toHaveLength(6)
  })

  it('si cancelo una, no vuelve a aparecer otra igual', async () => {
    const household = await householdOf(ana)
    await db.query(
      `update public.tasks set cancelled_on = created_on where household_id = $1 and name = 'Baño'`,
      [household],
    )

    await backfill()

    const { rows } = await db.query(
      `select count(*)::int as total, count(*) filter (where cancelled_on is null)::int as active
       from public.tasks where household_id = $1`,
      [household],
    )
    expect(rows[0]).toEqual({ total: 6, active: 5 })
  })
})

describe('US-27 · solo veo las tareas de mi hogar (RLS)', () => {
  it('un usuario solo ve las tareas y partes de su hogar', async () => {
    const counts = await asUser(db, ana, async (query) => {
      const tasks = await query('select distinct household_id from public.tasks')
      const parts = await query('select distinct household_id from public.task_parts')
      return { tasks: tasks.rows, parts: parts.rows }
    })
    const household = await householdOf(ana)
    expect(counts).toEqual({
      tasks: [{ household_id: household }],
      parts: [{ household_id: household }],
    })
  })

  it('un usuario no puede crear, cambiar ni borrar tareas ni partes desde la app', async () => {
    const household = await householdOf(ana)
    for (const sql of [
      `insert into public.tasks (household_id, name, frequency) values ('${household}', 'X', 'one_off')`,
      `update public.tasks set name = 'X'`,
      `delete from public.tasks`,
      `update public.task_parts set weight = 1`,
      `delete from public.task_parts`,
    ]) {
      await expect(asUser(db, ana, (query) => query(sql))).rejects.toThrow(/permission denied/)
    }
  })

  it('un usuario no puede crear tareas por defecto por su cuenta', async () => {
    const household = await householdOf(ana)
    await expect(
      asUser(db, ana, (query) => query('select public.create_default_tasks($1)', [household])),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(db, ana, (query) => query('select public.create_default_tasks_for_existing_households()')),
    ).rejects.toThrow(/permission denied/)
  })

  it('sin sesión no se puede leer nada', async () => {
    await expect(asUser(db, null, (query) => query('select * from public.tasks'))).rejects.toThrow(
      /permission denied/,
    )
    await expect(
      asUser(db, null, (query) => query('select * from public.task_parts')),
    ).rejects.toThrow(/permission denied/)
  })
})
