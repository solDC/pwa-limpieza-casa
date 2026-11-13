import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, createUser, deleteUsers } from './helpers/database'

// US-52 · La app en inglés y en castellano (#85): las tareas por defecto y sus partes
// llevan una clave (default_key), para que la app las muestre en el idioma elegido.

let db: pg.Client
let ana: string
let household: string

beforeAll(async () => {
  db = connect()
  await db.connect()
  ana = await createUser(db)
  const { rows } = await db.query(
    'select household_id from public.household_members where user_id = $1',
    [ana],
  )
  household = rows[0].household_id
})

afterAll(async () => {
  await deleteUsers(db, [ana])
  await db.end()
})

const taskKeys = [
  { name: 'Superficies', default_key: 'surfaces' },
  { name: 'Baño', default_key: 'bathroom' },
  { name: 'Aspirar cosas de Cati', default_key: 'vacuum_cati' },
  { name: 'Cristales y espejos', default_key: 'windows_mirrors' },
  { name: 'Cepillar suelo', default_key: 'scrub_floor' },
  { name: 'Limpiar juntas', default_key: 'clean_grout' },
]
const partKeys = [
  { name: 'Cocina', default_key: 'kitchen' },
  { name: 'Salón', default_key: 'living_room' },
  { name: 'Dormitorio', default_key: 'bedroom' },
]

const tasksOf = async () =>
  (
    await db.query(
      'select name, default_key from public.tasks where household_id = $1 order by position',
      [household],
    )
  ).rows
const partsOf = async () =>
  (
    await db.query(
      'select name, default_key from public.task_parts where household_id = $1 order by position',
      [household],
    )
  ).rows

describe('US-52 · las tareas por defecto llevan su clave', () => {
  it('las de un hogar nuevo, y las partes de Superficies', async () => {
    expect(await tasksOf()).toEqual(taskKeys)
    expect(await partsOf()).toEqual(partKeys)
  })

  it('la app puede leer la clave', async () => {
    const rows = await asUser(db, ana, async (query) => {
      const { rows } = await query(
        `select default_key from public.tasks where household_id = $1 and name = 'Baño'`,
        [household],
      )
      return rows
    })
    expect(rows).toEqual([{ default_key: 'bathroom' }])
  })

  it('una tarea que añade el usuario no lleva clave, ni sus partes, aunque se llame igual', async () => {
    const saved = await asUser(db, ana, async (query) => {
      const { rows } = await query(
        `select public.create_task($1, 'Baño', 'one_off', null, null, '{Cocina}', '{100}') as id`,
        [household],
      )
      const task = await query('select default_key from public.tasks where id = $1', [rows[0].id])
      const parts = await query('select default_key from public.task_parts where task_id = $1', [
        rows[0].id,
      ])
      return { task: task.rows, parts: parts.rows }
    })
    expect(saved).toEqual({ task: [{ default_key: null }], parts: [{ default_key: null }] })
  })

  // Los hogares que ya existían antes de esta migración (como el de Sol).
  it('las tareas por defecto que ya existían sin clave la reciben; las del usuario, no', async () => {
    await db.query('begin')
    try {
      await db.query('update public.task_parts set default_key = null where household_id = $1', [household])
      await db.query('update public.tasks set default_key = null where household_id = $1', [household])
      // Una del usuario con el nombre de una por defecto, al final de la lista.
      await db.query(
        `insert into public.tasks (household_id, name, position, frequency) values ($1, 'Baño', 7, 'one_off')`,
        [household],
      )

      await db.query('select public.set_default_task_keys()')

      expect(await tasksOf()).toEqual([...taskKeys, { name: 'Baño', default_key: null }])
      expect(await partsOf()).toEqual(partKeys)
    } finally {
      await db.query('rollback')
    }
  })

  it('la app no puede ejecutar el relleno de claves', async () => {
    await expect(
      asUser(db, ana, (query) => query('select public.set_default_task_keys()')),
    ).rejects.toThrow(/permission denied/)
  })
})
