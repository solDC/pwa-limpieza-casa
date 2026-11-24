import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, createUser, deleteUsers } from './helpers/database'

// US-53 · Cambiar cada cuánto toca una tarea (#93): la columna tasks.frequency_changed_on,
// la tabla task_frequency_periods y la función change_task_frequency, con sus reglas de
// seguridad. Las fechas, relativas a hoy en Madrid (como la base de datos).

let db: pg.Client
let ana: string
let bruno: string
let anaHousehold: string

beforeAll(async () => {
  db = connect()
  await db.connect()
  ana = await createUser(db)
  bruno = await createUser(db)
  const { rows } = await db.query('select household_id from public.household_members where user_id = $1', [ana])
  anaHousehold = rows[0].household_id
})

afterAll(async () => {
  await deleteUsers(db, [ana, bruno])
  await db.end()
})

type Query = (sql: string, params?: unknown[]) => Promise<pg.QueryResult>

/** Hoy en Madrid más `days` días, en 'YYYY-MM-DD'. */
async function day(days = 0): Promise<string> {
  const { rows } = await db.query(
    `select to_char((now() at time zone 'Europe/Madrid')::date + $1::int, 'YYYY-MM-DD') as day`,
    [days],
  )
  return rows[0].day
}

/** El sábado del finde actual (si hoy es sábado o domingo) o del siguiente, más `weeks` semanas. */
async function saturday(weeks = 0): Promise<string> {
  const { rows } = await db.query(
    `select to_char(d - ((extract(isodow from d)::int + 1) % 7) + 7 * (case when extract(isodow from d) in (6, 7) then 0 else 1 end) + 7 * $1::int, 'YYYY-MM-DD') as day
     from (select (now() at time zone 'Europe/Madrid')::date as d) as today`,
    [weeks],
  )
  return rows[0].day
}

async function taskId(query: Query, name: string): Promise<string> {
  const { rows } = await query('select id from public.tasks where household_id = $1 and name = $2', [anaHousehold, name])
  return rows[0].id
}

async function frequencyOf(query: Query, id: string) {
  const { rows } = await query(
    `select frequency, interval_days, to_char(biweekly_start_on, 'YYYY-MM-DD') as biweekly_start_on,
       to_char(weekly_start_on, 'YYYY-MM-DD') as weekly_start_on, to_char(due_on, 'YYYY-MM-DD') as due_on,
       to_char(next_due_on, 'YYYY-MM-DD') as next_due_on,
       to_char(frequency_changed_on, 'YYYY-MM-DD') as frequency_changed_on
     from public.tasks where id = $1`,
    [id],
  )
  return rows[0]
}

const change = (
  query: Query,
  id: string,
  frequency: string,
  options: { days?: number; biweekly?: string; dueOn?: string } = {},
) =>
  query('select public.change_task_frequency($1, $2, $3, $4, $5)', [
    id,
    frequency,
    options.days ?? null,
    options.biweekly ?? null,
    options.dueOn ?? null,
  ])

/** Como administrador, dentro de asUser: lo que la app no puede hacer (fechas pasadas). */
async function asAdmin(query: Query, sql: string, params: unknown[]) {
  await query('reset role')
  await query(sql, params)
  await query('set local role authenticated')
}

describe('US-53 · cambiar la frecuencia', () => {
  it('de cada N días a semanal: cuenta desde hoy, sin lo de antes, y guarda la frecuencia de antes', async () => {
    const today = await day()
    const saved = await asUser(db, ana, async (query) => {
      const id = await taskId(query, 'Baño')
      await change(query, id, 'weekend_weekly')
      const { rows } = await query(
        `select frequency, interval_days, to_char(ends_on, 'YYYY-MM-DD') as ends_on from public.task_frequency_periods where task_id = $1`,
        [id],
      )
      return { task: await frequencyOf(query, id), periods: rows }
    })
    expect(saved.task).toEqual({
      frequency: 'weekend_weekly',
      interval_days: null,
      biweekly_start_on: null,
      weekly_start_on: null,
      due_on: null,
      next_due_on: null,
      frequency_changed_on: today,
    })
    expect(saved.periods).toEqual([{ frequency: 'interval', interval_days: 3, ends_on: today }])
  })

  it('a cada N días sin haberla hecho nunca: toca desde hoy', async () => {
    const today = await day()
    const task = await asUser(db, ana, async (query) => {
      const id = await taskId(query, 'Superficies')
      await change(query, id, 'interval', { days: 5 })
      return frequencyOf(query, id)
    })
    expect(task).toMatchObject({ frequency: 'interval', interval_days: 5, next_due_on: null, frequency_changed_on: today })
  })

  it('a cada N días, si la próxima desde la última vez ya ha pasado, toca hoy; si no, no se toca', async () => {
    const today = await day()
    const saved = await asUser(db, ana, async (query) => {
      const id = await taskId(query, 'Baño')
      await asAdmin(query, `insert into public.task_rounds (household_id, task_id, starts_on, completed_on) values ($1, $2, $3, $3)`, [
        anaHousehold,
        id,
        await day(-10),
      ])
      await change(query, id, 'interval', { days: 7 })
      const late = await frequencyOf(query, id)
      await change(query, id, 'interval', { days: 30 })
      return { late, onTime: await frequencyOf(query, id) }
    })
    expect(saved.late).toMatchObject({ interval_days: 7, next_due_on: today })
    expect(saved.onTime).toMatchObject({ interval_days: 30, next_due_on: null })
  })

  it('a cada 15 días, con el primer finde: el actual o uno posterior, y en sábado', async () => {
    const first = await saturday(1)
    const task = await asUser(db, ana, async (query) => {
      const id = await taskId(query, 'Baño')
      await change(query, id, 'weekend_biweekly', { biweekly: first })
      return frequencyOf(query, id)
    })
    expect(task).toMatchObject({ frequency: 'weekend_biweekly', biweekly_start_on: first, interval_days: null })

    const lastWeek = await saturday(-2)
    await expect(
      asUser(db, ana, async (query) => change(query, await taskId(query, 'Baño'), 'weekend_biweekly', { biweekly: lastWeek })),
    ).rejects.toMatchObject({ code: '23514' })
    const friday = await day(0).then(() => saturday(1)).then(async (sat) => {
      const { rows } = await db.query(`select to_char($1::date - 1, 'YYYY-MM-DD') as d`, [sat])
      return rows[0].d as string
    })
    await expect(
      asUser(db, ana, async (query) => change(query, await taskId(query, 'Baño'), 'weekend_biweekly', { biweekly: friday })),
    ).rejects.toMatchObject({ code: '22023' })
  })

  it('a puntual, con fecha o sin ella; la fecha, hoy o un día futuro', async () => {
    const tomorrow = await day(1)
    const task = await asUser(db, ana, async (query) => {
      const id = await taskId(query, 'Baño')
      await change(query, id, 'one_off', { dueOn: tomorrow })
      return frequencyOf(query, id)
    })
    expect(task).toMatchObject({ frequency: 'one_off', due_on: tomorrow, interval_days: null })

    const yesterday = await day(-1)
    await expect(
      asUser(db, ana, async (query) => change(query, await taskId(query, 'Baño'), 'one_off', { dueOn: yesterday })),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('quita lo de la frecuencia de antes: el finde al que se movió una semanal', async () => {
    const nextWeek = await saturday(1)
    const task = await asUser(db, ana, async (query) => {
      const id = await taskId(query, 'Superficies')
      await query('select public.move_weekend_task($1, $2)', [id, nextWeek])
      await change(query, id, 'weekend_biweekly', { biweekly: nextWeek })
      return frequencyOf(query, id)
    })
    expect(task).toMatchObject({ frequency: 'weekend_biweekly', weekly_start_on: null })
  })

  it('si la vuelta en curso estaba a medias, la nueva empieza después de ella', async () => {
    const [yesterday, tomorrow, nextWeek] = [await day(-1), await day(1), await day(5)]
    const saved = await asUser(db, ana, async (query) => {
      const id = await taskId(query, 'Superficies')
      const { rows } = await query('select id from public.task_parts where task_id = $1 order by position', [id])
      // La cocina, hecha ayer en una vuelta que empezó ayer y aún tiene plazo.
      await asAdmin(
        query,
        `insert into public.task_part_completions (household_id, task_id, part_id, starts_on, due_by, completed_on)
         values ($1, $2, $3, $4, $5, $4)`,
        [anaHousehold, id, rows[0].id, yesterday, nextWeek],
      )
      await change(query, id, 'weekend_biweekly', { biweekly: await saturday(1) })
      const weekend = await frequencyOf(query, id)
      await change(query, id, 'interval', { days: 3 })
      return { weekend, interval: await frequencyOf(query, id) }
    })
    // De fin de semana: desde dos días después de que empezara la vuelta a medias (así su
    // primer finde es otro).
    expect(saved.weekend.frequency_changed_on).toBe(tomorrow)
    // De cada N días: desde el día siguiente (aquí, hoy). Si no, empezaría ayer, como la vuelta a medias.
    expect(saved.interval.frequency_changed_on).toBe(await day(0))
  })

  it('no admite la misma frecuencia, ni que falte o sobre lo que pide cada una', async () => {
    const bad: [string, { days?: number; biweekly?: string; dueOn?: string }][] = [
      ['interval', { days: 3 }], // Baño ya es cada 3 días
      ['interval', {}],
      ['weekend_weekly', { days: 3 }],
      ['one_off', { days: 3 }],
      ['weekend_biweekly', {}],
      ['monthly', {}],
    ]
    for (const [frequency, options] of bad) {
      await expect(
        asUser(db, ana, async (query) => change(query, await taskId(query, 'Baño'), frequency, options)),
      ).rejects.toMatchObject({ code: '22023' })
    }
    await expect(
      asUser(db, ana, async (query) => change(query, await taskId(query, 'Baño'), 'interval', { days: 400 })),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('una tarea hecha con otra frecuencia y pasada a puntual sigue bloqueando su nombre (está en la lista)', async () => {
    await expect(
      asUser(db, ana, async (query) => {
        const id = await taskId(query, 'Baño')
        await asAdmin(query, `insert into public.task_rounds (household_id, task_id, starts_on, completed_on) values ($1, $2, $3, $3)`, [
          anaHousehold,
          id,
          await day(-2),
        ])
        await change(query, id, 'one_off')
        await query(`select public.create_task($1, 'baño', 'one_off', null, null, '{}', '{}')`, [anaHousehold])
      }),
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('no se cambia una puntual ya hecha (ya no está en la lista)', async () => {
    await expect(
      asUser(db, ana, async (query) => {
        const id = await taskId(query, 'Cepillar suelo')
        await query('insert into public.task_rounds (household_id, task_id) values ($1, $2)', [anaHousehold, id])
        await change(query, id, 'weekend_weekly')
      }),
    ).rejects.toMatchObject({ code: '22023' })
  })

  it('no se vuelve a puntual si ya tiene partes hechas como puntual: la vuelta nueva se quedaría con ellas', async () => {
    await expect(
      asUser(db, ana, async (query) => {
        const { rows } = await query(
          `select public.create_task($1, 'Horno', 'one_off', null, null, '{Puerta,Bandejas}', '{50,50}') as id`,
          [anaHousehold],
        )
        const id: string = rows[0].id
        const parts = await query('select id from public.task_parts where task_id = $1 order by position', [id])
        await query(
          'insert into public.task_part_completions (household_id, task_id, part_id, starts_on, due_by) values ($1, $2, $3, null, null)',
          [anaHousehold, id, parts.rows[0].id],
        )
        await change(query, id, 'interval', { days: 7 })
        await change(query, id, 'one_off')
      }),
    ).rejects.toMatchObject({ code: '22023' })
  })

  it('no en una tarea cancelada', async () => {
    await expect(
      asUser(db, ana, async (query) => {
        const id = await taskId(query, 'Baño')
        await asAdmin(query, 'update public.tasks set cancelled_on = created_on where id = $1', [id])
        await change(query, id, 'weekend_weekly')
      }),
    ).rejects.toMatchObject({ code: '22023' })
  })
})

describe('US-53 · seguridad', () => {
  it('nadie puede cambiar la frecuencia de una tarea de otro hogar', async () => {
    const id = await asUser(db, ana, (query) => taskId(query, 'Baño'))
    await expect(asUser(db, bruno, (query) => change(query, id, 'weekend_weekly'))).rejects.toMatchObject({
      code: '42501',
    })
  })

  it('sin sesión no se puede cambiar', async () => {
    const id = await asUser(db, ana, (query) => taskId(query, 'Baño'))
    await expect(asUser(db, null, (query) => change(query, id, 'weekend_weekly'))).rejects.toMatchObject({
      code: '42501',
    })
  })

  it('la app no puede cambiar la frecuencia ni frequency_changed_on directamente en la tabla', async () => {
    await expect(
      asUser(db, ana, async (query) => {
        const id = await taskId(query, 'Baño')
        await query(`update public.tasks set frequency_changed_on = created_on where id = $1`, [id])
      }),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('cada uno ve solo las frecuencias de antes de su hogar, y nadie las escribe directamente', async () => {
    const seen = await asUser(db, ana, async (query) => {
      await change(query, await taskId(query, 'Baño'), 'weekend_weekly')
      const mine = await query('select count(*)::int as count from public.task_frequency_periods')
      return mine.rows[0].count
    })
    expect(seen).toBe(1)

    // Lo guarda Ana de verdad (fuera de asUser) para ver si Bruno lo ve.
    await db.query('begin')
    try {
      const { rows } = await db.query(`select id from public.tasks where household_id = $1 and name = 'Baño'`, [anaHousehold])
      await db.query(
        `insert into public.task_frequency_periods (household_id, task_id, frequency, interval_days, starts_on, ends_on)
         values ($1, $2, 'interval', 3, current_date, current_date)`,
        [anaHousehold, rows[0].id],
      )
      await db.query('set local role authenticated')
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: bruno, role: 'authenticated' })])
      const others = await db.query('select count(*)::int as count from public.task_frequency_periods')
      expect(others.rows[0].count).toBe(0)
    } finally {
      await db.query('rollback')
    }

    await expect(
      asUser(db, ana, async (query) => {
        const id = await taskId(query, 'Baño')
        await query(
          `insert into public.task_frequency_periods (household_id, task_id, frequency, interval_days, starts_on, ends_on)
           values ($1, $2, 'interval', 3, current_date, current_date)`,
          [anaHousehold, id],
        )
      }),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      asUser(db, null, (query) => query('select count(*) from public.task_frequency_periods')),
    ).rejects.toMatchObject({ code: '42501' })
  })
})
