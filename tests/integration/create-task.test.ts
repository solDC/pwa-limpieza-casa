import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, createUser, deleteUsers } from './helpers/database'

// US-33 · Añadir una tarea (#42): la función create_task y sus reglas de seguridad.
//
// asUser deshace todo al terminar (rollback), así que la regla de los pesos, que se
// comprueba al final de la transacción, se fuerza con `set constraints all immediate`.

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

type NewTask = {
  household?: string
  name?: string
  frequency?: string
  intervalDays?: number | null
  biweeklyStartOn?: string | null
  parts?: string[]
  weights?: number[]
}

/** Llama a create_task como la app y comprueba las reglas que esperan al final. */
async function createTask(query: Query, task: NewTask = {}): Promise<string> {
  const { rows } = await query(
    'select public.create_task($1, $2, $3, $4, $5, $6, $7) as id',
    [
      task.household ?? anaHousehold,
      task.name ?? 'Regar las plantas',
      'frequency' in task ? task.frequency : 'interval',
      task.intervalDays === undefined ? 7 : task.intervalDays,
      task.biweeklyStartOn ?? null,
      task.parts ?? [],
      task.weights ?? [],
    ],
  )
  await query('set constraints all immediate')
  return rows[0].id
}

describe('US-33 · un miembro puede añadir una tarea a su hogar', () => {
  it('se guarda con su frecuencia, al final de la lista y con el día de hoy en Madrid', async () => {
    const saved = await asUser(db, ana, async (query) => {
      const id = await createTask(query, { name: '  Regar las plantas  ' })
      const { rows } = await query(
        `select name, frequency, interval_days, position,
                created_on = (now() at time zone 'Europe/Madrid')::date as created_today,
                (select max(position) from public.tasks where household_id = $2) as last_position
         from public.tasks where id = $1`,
        [id, anaHousehold],
      )
      return rows[0]
    })
    expect(saved).toMatchObject({
      name: 'Regar las plantas',
      frequency: 'interval',
      interval_days: 7,
      created_today: true,
    })
    expect(saved.position).toBe(saved.last_position)
  })

  it('las cuatro frecuencias', async () => {
    await asUser(db, ana, async (query) => {
      await createTask(query, { frequency: 'weekend_weekly', intervalDays: null })
      await createTask(query, {
        frequency: 'weekend_biweekly',
        intervalDays: null,
        biweeklyStartOn: '2026-11-14',
      })
      await createTask(query, { frequency: 'interval', intervalDays: 30 })
      await createTask(query, { frequency: 'one_off', intervalDays: null })
    })
  })

  it('las partes son opcionales: sin partes no tiene ninguna', async () => {
    const parts = await asUser(db, ana, async (query) => {
      const id = await createTask(query)
      const { rows } = await query('select count(*)::int as count from public.task_parts where task_id = $1', [id])
      return rows[0].count
    })
    expect(parts).toBe(0)
  })

  it('con partes, se guardan en orden con su peso', async () => {
    const parts = await asUser(db, ana, async (query) => {
      const id = await createTask(query, {
        parts: [' Cocina ', 'Baño', 'Salón'],
        weights: [34, 33, 33],
      })
      const { rows } = await query(
        'select name, weight from public.task_parts where task_id = $1 order by position',
        [id],
      )
      return rows
    })
    expect(parts).toEqual([
      { name: 'Cocina', weight: 34 },
      { name: 'Baño', weight: 33 },
      { name: 'Salón', weight: 33 },
    ])
  })
})

describe('US-33 · no se guarda una tarea que no vale', () => {
  const rejects = (task: NewTask) => asUser(db, ana, (query) => createTask(query, task))

  it('sin nombre', async () => {
    await expect(rejects({ name: '   ' })).rejects.toThrow(/tasks_name_check/)
  })

  it('sin frecuencia, o con una que no es de las cuatro', async () => {
    await expect(rejects({ frequency: null as unknown as string })).rejects.toThrow(/null value/)
    await expect(rejects({ frequency: 'monthly' })).rejects.toThrow(/tasks_frequency_check/)
  })

  it('«cada N días» sin los días', async () => {
    await expect(rejects({ frequency: 'interval', intervalDays: null })).rejects.toThrow(
      /tasks_interval_days_check/,
    )
  })

  it('«cada N días» con más de 365 días', async () => {
    await expect(rejects({ frequency: 'interval', intervalDays: 366 })).rejects.toThrow(
      /tasks_interval_days_max_check/,
    )
  })

  it('con más de 20 partes', async () => {
    const parts = Array.from({ length: 21 }, (_, index) => `Parte ${index + 1}`)
    const weights = [...Array(20).fill(5), 0]
    await expect(rejects({ parts, weights })).rejects.toThrow(/Como mucho 20 partes/)
  })

  it('«cada 15 días» sin el primer finde, o con un primer finde que no empieza en sábado', async () => {
    await expect(rejects({ frequency: 'weekend_biweekly', intervalDays: null })).rejects.toThrow(
      /tasks_biweekly_start_on_check/,
    )
    await expect(
      rejects({ frequency: 'weekend_biweekly', intervalDays: null, biweeklyStartOn: '2026-11-15' }),
    ).rejects.toThrow(/tasks_biweekly_start_on_saturday_check/)
  })

  it('con partes cuyos pesos no suman 100', async () => {
    await expect(rejects({ parts: ['Cocina', 'Baño'], weights: [50, 40] })).rejects.toThrow(
      /tienen que sumar 100/,
    )
  })

  it('con partes sin peso, o sin nombre', async () => {
    await expect(rejects({ parts: ['Cocina', 'Baño'], weights: [100] })).rejects.toThrow(
      /Cada parte necesita su peso/,
    )
    await expect(rejects({ parts: ['Cocina', ' '], weights: [50, 50] })).rejects.toThrow(
      /task_parts_name_check/,
    )
  })
})

describe('US-33 · seguridad: solo en mi hogar', () => {
  it('no puedo crear una tarea en el hogar de otro usuario', async () => {
    await expect(
      asUser(db, ana, (query) => createTask(query, { household: brunoHousehold })),
    ).rejects.toThrow(/No eres miembro de ese hogar/)
  })

  it('sin sesión no se puede crear ninguna tarea', async () => {
    await expect(asUser(db, null, (query) => createTask(query))).rejects.toThrow(
      /permission denied for function create_task/,
    )
  })

  it('la app no puede insertar tareas ni partes directamente, sin la función', async () => {
    await expect(
      asUser(db, ana, (query) =>
        query(
          `insert into public.tasks (household_id, name, frequency) values ($1, 'Directa', 'one_off')`,
          [anaHousehold],
        ),
      ),
    ).rejects.toThrow(/permission denied for table tasks/)
  })
})

describe('US-33 · la regla de los pesos no rompe nada de lo que ya funcionaba', () => {
  // Regresión: Supabase Auth da de alta con su propio usuario de la base de datos
  // (supabase_auth_admin), y el alta crea las tareas por defecto, con partes. La regla
  // de los pesos se comprueba al terminar, con ese usuario, y tiene que poder hacerlo.
  it('darse de alta, como lo hace Supabase Auth, sigue funcionando', async () => {
    // En Supabase local, ese usuario tiene la misma contraseña que el administrador.
    const auth = new pg.Client({
      connectionString:
        process.env.SUPABASE_AUTH_DB_URL ??
        'postgresql://supabase_auth_admin:postgres@127.0.0.1:54322/postgres',
    })
    await auth.connect()
    try {
      await auth.query('begin')
      await auth.query(
        `insert into auth.users (id, email, aud, role)
         values (gen_random_uuid(), 'alta-' || gen_random_uuid() || '@example.test', 'authenticated', 'authenticated')`,
      )
      await expect(auth.query('set constraints all immediate')).resolves.toBeDefined()
    } finally {
      await auth.query('rollback')
      await auth.end()
    }
  })
})
