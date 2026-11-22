import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, createUser, deleteUsers } from './helpers/database'

// US-51 · Cambiar las partes de una tarea (#83): la columna task_parts.archived_on y la
// función set_task_parts, con sus reglas de seguridad.
//
// Se usa una puntual con partes: su vuelta no tiene fecha (starts_on vacío), así que las
// partes se pueden marcar cualquier día. asUser deshace todo al terminar (rollback), así
// que la regla de los pesos, que se comprueba al final de la transacción, se fuerza con
// `set constraints all immediate`.

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

/** Crea «Cocina a fondo», puntual, con tres partes (50, 25 y 25). Devuelve su id y los de sus partes. */
async function kitchenTask(query: Query) {
  const { rows } = await query(
    `select public.create_task($1, 'Cocina a fondo', 'one_off', null, null, '{Horno,Nevera,Armarios}', '{50,25,25}') as id`,
    [anaHousehold],
  )
  const id: string = rows[0].id
  const parts = await query('select id from public.task_parts where task_id = $1 order by position', [id])
  const [oven, fridge, cupboards] = parts.rows.map((row) => row.id as string)
  return { id, oven: oven!, fridge: fridge!, cupboards: cupboards! }
}

/** Marca esas partes en la vuelta (sin fecha) de la puntual. */
async function markDone(query: Query, taskId: string, partIds: string[]) {
  for (const partId of partIds) {
    await query(
      'insert into public.task_part_completions (household_id, task_id, part_id, starts_on, due_by) values ($1, $2, $3, null, null)',
      [anaHousehold, taskId, partId],
    )
  }
}

/** Llama a set_task_parts como la app y comprueba las reglas que esperan al final. */
async function setParts(
  query: Query,
  taskId: string,
  kept: [string, number][],
  added: [string, number][] = [],
): Promise<{ new_part_ids: string[]; completed_on: string | null }> {
  const { rows } = await query('select public.set_task_parts($1, $2, $3, $4, $5, null, null) as result', [
    taskId,
    kept.map(([id]) => id),
    kept.map(([, weight]) => weight),
    added.map(([name]) => name),
    added.map(([, weight]) => weight),
  ])
  await query('set constraints all immediate')
  return rows[0].result
}

/** Las partes de la tarea, en orden: las que siguen y las archivadas. */
async function partsOf(query: Query, taskId: string) {
  const { rows } = await query(
    `select name, weight, archived_on is not null as archived
     from public.task_parts where task_id = $1 order by position`,
    [taskId],
  )
  return rows
}

async function roundsOf(query: Query, taskId: string): Promise<number> {
  const { rows } = await query('select count(*)::int as count from public.task_rounds where task_id = $1', [taskId])
  return rows[0].count
}

describe('US-51 · cambiar las partes de una tarea', () => {
  it('cambia los pesos, añade las nuevas al final y archiva las que se quitan', async () => {
    const saved = await asUser(db, ana, async (query) => {
      const task = await kitchenTask(query)
      const result = await setParts(query, task.id, [[task.oven, 40], [task.cupboards, 30]], [[' Fregadero ', 30]])
      return { result, parts: await partsOf(query, task.id) }
    })
    expect(saved.parts).toEqual([
      { name: 'Horno', weight: 40, archived: false },
      { name: 'Nevera', weight: 25, archived: true },
      { name: 'Armarios', weight: 30, archived: false },
      { name: 'Fregadero', weight: 30, archived: false },
    ])
    expect(saved.result.new_part_ids).toHaveLength(1)
    expect(saved.result.completed_on).toBeNull()
  })

  it('se pueden añadir partes a una tarea que no tiene', async () => {
    const parts = await asUser(db, ana, async (query) => {
      const { rows } = await query(`select id from public.tasks where household_id = $1 and name = 'Baño'`, [anaHousehold])
      await setParts(query, rows[0].id, [], [['Ducha', 60], ['Lavabo', 40]])
      return partsOf(query, rows[0].id)
    })
    expect(parts).toEqual([
      { name: 'Ducha', weight: 60, archived: false },
      { name: 'Lavabo', weight: 40, archived: false },
    ])
  })

  it('se pueden quitar todas: la tarea se marca entera, sin dar la vuelta por terminada', async () => {
    const saved = await asUser(db, ana, async (query) => {
      const task = await kitchenTask(query)
      await markDone(query, task.id, [task.oven])
      const result = await setParts(query, task.id, [])
      // Ya sin partes, la tarea se marca entera.
      await query('insert into public.task_rounds (household_id, task_id) values ($1, $2)', [anaHousehold, task.id])
      return { result, parts: await partsOf(query, task.id), rounds: await roundsOf(query, task.id) }
    })
    expect(saved.result.completed_on).toBeNull()
    expect(saved.parts.every((part: { archived: boolean }) => part.archived)).toBe(true)
    expect(saved.rounds).toBe(1)
  })

  it('las partes archivadas conservan sus partes hechas, con su peso', async () => {
    const completions = await asUser(db, ana, async (query) => {
      const task = await kitchenTask(query)
      await markDone(query, task.id, [task.fridge])
      await setParts(query, task.id, [[task.oven, 50], [task.cupboards, 50]])
      const { rows } = await query('select part_id, weight from public.task_part_completions where task_id = $1', [task.id])
      return { rows, fridge: task.fridge }
    })
    expect(completions.rows).toEqual([{ part_id: completions.fridge, weight: 25 }])
  })

  it('si al quitar partes ya están hechas todas las que quedan, la vuelta queda completada hoy', async () => {
    const saved = await asUser(db, ana, async (query) => {
      const task = await kitchenTask(query)
      await markDone(query, task.id, [task.oven, task.fridge])
      const result = await setParts(query, task.id, [[task.oven, 60], [task.fridge, 40]])
      const { rows } = await query(
        `select (now() at time zone 'Europe/Madrid')::date::text as today`,
      )
      return { result, rounds: await roundsOf(query, task.id), today: rows[0].today }
    })
    expect(saved.rounds).toBe(1)
    expect(saved.result.completed_on).toBe(saved.today)
  })

  it('si se añade una parte, no: falta la nueva', async () => {
    const rounds = await asUser(db, ana, async (query) => {
      const task = await kitchenTask(query)
      await markDone(query, task.id, [task.oven, task.fridge])
      await setParts(query, task.id, [[task.oven, 40], [task.fridge, 30]], [['Fregadero', 30]])
      return roundsOf(query, task.id)
    })
    expect(rounds).toBe(0)
  })

  it('una parte archivada ya no se puede marcar ni renombrar', async () => {
    await expect(
      asUser(db, ana, async (query) => {
        const task = await kitchenTask(query)
        await setParts(query, task.id, [[task.oven, 100]])
        await markDone(query, task.id, [task.fridge])
      }),
    ).rejects.toThrow(/ya no es de la tarea/)
    await expect(
      asUser(db, ana, async (query) => {
        const task = await kitchenTask(query)
        await setParts(query, task.id, [[task.oven, 100]])
        await query('select public.rename_task($1, null, $2, $3)', [task.id, [task.fridge], ['Congelador']])
      }),
    ).rejects.toThrow(/no es de esa tarea/)
  })

  it('con todas las partes hechas, la vuelta se termina sin contar las archivadas', async () => {
    const rounds = await asUser(db, ana, async (query) => {
      const task = await kitchenTask(query)
      await setParts(query, task.id, [[task.oven, 50], [task.fridge, 50]])
      await markDone(query, task.id, [task.oven, task.fridge])
      return roundsOf(query, task.id)
    })
    expect(rounds).toBe(1)
  })

  it('los pesos tienen que sumar 100, sin contar las archivadas', async () => {
    await expect(
      asUser(db, ana, async (query) => {
        const task = await kitchenTask(query)
        await setParts(query, task.id, [[task.oven, 50], [task.fridge, 25]])
      }),
    ).rejects.toThrow(/tienen que sumar 100 \(suman 75\)/)
  })

  it('cada peso de 1 a 100 y como mucho 20 partes', async () => {
    await expect(
      asUser(db, ana, async (query) => {
        const task = await kitchenTask(query)
        await setParts(query, task.id, [[task.oven, 100]], [['Fregadero', 0]])
      }),
    ).rejects.toThrow(/task_parts_weight_check/)
    await expect(
      asUser(db, ana, async (query) => {
        const task = await kitchenTask(query)
        const added = Array.from({ length: 18 }, (_, i): [string, number] => [`Parte ${i}`, 1])
        await setParts(query, task.id, [[task.oven, 41], [task.fridge, 20], [task.cupboards, 21]], added)
      }),
    ).rejects.toThrow(/Como mucho 20 partes/)
  })

  it('no admite partes de otra tarea, ni ya archivadas, ni repetidas', async () => {
    for (const pick of ['other', 'archived', 'repeated'] as const) {
      await expect(
        asUser(db, ana, async (query) => {
          const task = await kitchenTask(query)
          if (pick === 'other') {
            const { rows } = await query(
              `select p.id from public.task_parts p join public.tasks t on t.id = p.task_id
               where t.household_id = $1 and t.name = 'Superficies' limit 1`,
              [anaHousehold],
            )
            await setParts(query, task.id, [[rows[0].id, 100]])
          } else if (pick === 'archived') {
            await setParts(query, task.id, [[task.oven, 100]])
            await setParts(query, task.id, [[task.oven, 50], [task.fridge, 50]])
          } else {
            await setParts(query, task.id, [[task.oven, 50], [task.oven, 50]])
          }
        }),
      ).rejects.toThrow(/no es de esa tarea/)
    }
  })

  it('no en una tarea cancelada', async () => {
    await expect(
      asUser(db, ana, async (query) => {
        const task = await kitchenTask(query)
        await query('reset role')
        await query(`update public.tasks set cancelled_on = (now() at time zone 'Europe/Madrid')::date where id = $1`, [task.id])
        await query('set local role authenticated')
        await setParts(query, task.id, [[task.oven, 100]])
      }),
    ).rejects.toThrow(/cancelada/)
  })
})

describe('US-51 · seguridad', () => {
  it('nadie puede cambiar las partes de una tarea de otro hogar', async () => {
    await expect(
      asUser(db, bruno, async (query) => {
        await query('reset role')
        const { rows } = await query(`select id from public.tasks where household_id = $1 and name = 'Baño'`, [
          anaHousehold,
        ])
        await query('set local role authenticated')
        await setParts(query, rows[0].id, [], [['Mío', 100]])
      }),
    ).rejects.toThrow(/No existe esa tarea en tu hogar/)
  })

  it('la app no puede archivar ni cambiar partes directamente en la tabla', async () => {
    for (const change of ['archived_on = current_date', 'weight = 50']) {
      await expect(
        asUser(db, ana, (query) =>
          query(`update public.task_parts set ${change} where household_id = $1`, [anaHousehold]),
        ),
      ).rejects.toThrow(/permission denied/)
    }
  })

  it('sin sesión no se pueden cambiar', async () => {
    await expect(
      asUser(db, null, (query) =>
        query('select public.set_task_parts($1, $2, $3, $4, $5, null, null)', [
          '00000000-0000-0000-0000-000000000000',
          [],
          [],
          ['Mío'],
          [100],
        ]),
      ),
    ).rejects.toThrow(/permission denied/)
  })
})
