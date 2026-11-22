import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, createUser, deleteUsers } from './helpers/database'

// US-54 · Cambiar el nombre de una tarea y de sus partes (#96): la función rename_task y
// sus reglas de seguridad. Y no puede haber dos tareas con el mismo nombre en un hogar,
// tampoco al añadirlas (US-33, create_task).

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

/** Una de las tareas por defecto de Ana, con sus partes en orden. */
async function taskOf(query: Query, name: string) {
  const { rows } = await query(
    'select id, name, default_key from public.tasks where household_id = $1 and name = $2',
    [anaHousehold, name],
  )
  const parts = await query(
    'select id, name, default_key from public.task_parts where task_id = $1 order by position',
    [rows[0].id],
  )
  return { ...rows[0], parts: parts.rows } as {
    id: string
    name: string
    default_key: string | null
    parts: { id: string; name: string; default_key: string | null }[]
  }
}

async function taskById(query: Query, id: string) {
  const { rows } = await query('select name, default_key from public.tasks where id = $1', [id])
  const parts = await query(
    'select name, default_key from public.task_parts where task_id = $1 order by position',
    [id],
  )
  return { ...rows[0], parts: parts.rows }
}

const rename = (query: Query, id: string, name: string | null, partIds: string[] = [], partNames: string[] = []) =>
  query('select public.rename_task($1, $2, $3, $4)', [id, name, partIds, partNames])

const createTask = (query: Query, name: string) =>
  query(`select public.create_task($1, $2, 'interval', 7) as id`, [anaHousehold, name])

describe('US-54 · renombrar una tarea y sus partes', () => {
  it('cambia el nombre de la tarea y de las partes elegidas; solo lo renombrado pierde su clave', async () => {
    const saved = await asUser(db, ana, async (query) => {
      const task = await taskOf(query, 'Superficies')
      await rename(query, task.id, '  Superficies de abajo ', [task.parts[1]!.id], [' Salón comedor '])
      return taskById(query, task.id)
    })
    expect(saved).toEqual({
      name: 'Superficies de abajo',
      default_key: null,
      parts: [
        { name: 'Cocina', default_key: 'kitchen' },
        { name: 'Salón comedor', default_key: null },
        { name: 'Dormitorio', default_key: 'bedroom' },
      ],
    })
  })

  it('se pueden renombrar solo las partes: la tarea conserva su nombre y su clave', async () => {
    const saved = await asUser(db, ana, async (query) => {
      const task = await taskOf(query, 'Superficies')
      await rename(query, task.id, null, [task.parts[0]!.id], ['Cocina y despensa'])
      return taskById(query, task.id)
    })
    expect(saved).toMatchObject({ name: 'Superficies', default_key: 'surfaces' })
    expect(saved.parts[0]).toEqual({ name: 'Cocina y despensa', default_key: null })
  })

  it('las partes de una tarea pueden llamarse igual', async () => {
    const saved = await asUser(db, ana, async (query) => {
      const task = await taskOf(query, 'Superficies')
      await rename(query, task.id, null, [task.parts[1]!.id], ['Cocina'])
      return taskById(query, task.id)
    })
    expect(saved.parts.map((part: { name: string }) => part.name)).toEqual(['Cocina', 'Cocina', 'Dormitorio'])
  })

  it('no admite un nombre vacío ni de más de 80 caracteres', async () => {
    await expect(
      asUser(db, ana, async (query) => rename(query, (await taskOf(query, 'Baño')).id, '   ')),
    ).rejects.toThrow(/tasks_name_check/)
    await expect(
      asUser(db, ana, async (query) => {
        const task = await taskOf(query, 'Superficies')
        await rename(query, task.id, null, [task.parts[0]!.id], ['x'.repeat(81)])
      }),
    ).rejects.toThrow(/task_parts_name_check/)
  })

  it('no admite partes de otra tarea', async () => {
    await expect(
      asUser(db, ana, async (query) => {
        const baño = await taskOf(query, 'Baño')
        const superficies = await taskOf(query, 'Superficies')
        await rename(query, baño.id, null, [superficies.parts[0]!.id], ['Cocina'])
      }),
    ).rejects.toThrow(/no es de esa tarea/)
  })

  it('no renombra una tarea cancelada', async () => {
    await expect(
      asUser(db, ana, async (query) => {
        const task = await taskOf(query, 'Baño')
        await query('reset role')
        await query(`update public.tasks set cancelled_on = (now() at time zone 'Europe/Madrid')::date where id = $1`, [task.id])
        await query('set local role authenticated')
        await rename(query, task.id, 'Baño de arriba')
      }),
    ).rejects.toThrow(/cancelada/)
  })
})

describe('US-33 y US-54 · no hay dos tareas con el mismo nombre', () => {
  it('no se puede renombrar una tarea con el nombre de otra, sin distinguir mayúsculas ni espacios', async () => {
    await expect(
      asUser(db, ana, async (query) => rename(query, (await taskOf(query, 'Baño')).id, '  superficies ')),
    ).rejects.toThrow(/Ya tienes una tarea con ese nombre/)
  })

  it('sí con su propio nombre, por ejemplo para cambiar las mayúsculas', async () => {
    const saved = await asUser(db, ana, async (query) => {
      const task = await taskOf(query, 'Baño')
      await rename(query, task.id, 'BAÑO')
      return taskById(query, task.id)
    })
    expect(saved).toMatchObject({ name: 'BAÑO', default_key: null })
  })

  it('no se puede añadir una tarea con el nombre de otra', async () => {
    await expect(asUser(db, ana, (query) => createTask(query, 'baño '))).rejects.toThrow(
      /Ya tienes una tarea con ese nombre/,
    )
  })

  it('una tarea cancelada no bloquea su nombre', async () => {
    const id = await asUser(db, ana, async (query) => {
      const task = await taskOf(query, 'Baño')
      await query('reset role')
      await query(`update public.tasks set cancelled_on = (now() at time zone 'Europe/Madrid')::date where id = $1`, [task.id])
      await query('set local role authenticated')
      const { rows } = await createTask(query, 'Baño')
      return rows[0].id
    })
    expect(id).toBeTruthy()
  })

  it('el nombre de una tarea de otro hogar no cuenta', async () => {
    const id = await asUser(db, bruno, async (query) => {
      const { rows } = await query(
        `select public.create_task(household_id, 'Regar las plantas', 'interval', 7) as id
         from public.household_members where user_id = $1`,
        [bruno],
      )
      // Y Ana puede tener otra igual.
      return rows[0].id
    })
    expect(id).toBeTruthy()
    const anaId = await asUser(db, ana, async (query) => (await createTask(query, 'Regar las plantas')).rows[0].id)
    expect(anaId).toBeTruthy()
  })
})

describe('US-54 · seguridad', () => {
  it('nadie puede renombrar una tarea de otro hogar', async () => {
    await expect(
      asUser(db, bruno, async (query) => {
        await query('reset role')
        const { rows } = await query(`select id from public.tasks where household_id = $1 and name = 'Baño'`, [
          anaHousehold,
        ])
        await query('set local role authenticated')
        await rename(query, rows[0].id, 'Mío')
      }),
    ).rejects.toThrow(/No existe esa tarea en tu hogar/)
  })

  it('la app no puede cambiar los nombres directamente en las tablas', async () => {
    for (const table of ['tasks', 'task_parts']) {
      await expect(
        asUser(db, ana, (query) =>
          query(`update public.${table} set name = 'Otro' where household_id = $1`, [anaHousehold]),
        ),
      ).rejects.toThrow(/permission denied/)
    }
  })

  it('sin sesión no se puede renombrar', async () => {
    await expect(
      asUser(db, null, (query) => rename(query, '00000000-0000-0000-0000-000000000000', 'Otro')),
    ).rejects.toThrow(/permission denied/)
  })

  it('la app no puede llamar a la comprobación del nombre', async () => {
    await expect(
      asUser(db, ana, (query) =>
        query('select public.check_task_name_free($1, $2)', [anaHousehold, 'Baño']),
      ),
    ).rejects.toThrow(/permission denied/)
  })
})
