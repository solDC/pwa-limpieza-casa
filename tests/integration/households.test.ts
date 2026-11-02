import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, createUser, deleteUsers } from './helpers/database'

// US-02 · Hogar creado automáticamente
// y las reglas de seguridad (RLS) de households y household_members.

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

describe('US-02 · al registrarse se crea su hogar', () => {
  it('cada usuario nuevo tiene exactamente un hogar, del que es propietario', async () => {
    const { rows } = await db.query(
      `select h.name, m.role
       from public.household_members m
       join public.households h on h.id = m.household_id
       where m.user_id = $1`,
      [ana],
    )
    expect(rows).toEqual([{ name: 'Mi casa', role: 'owner' }])
  })

  it('dos usuarios tienen hogares distintos', async () => {
    expect(await householdOf(ana)).not.toBe(await householdOf(bruno))
  })
})

describe('US-02 · solo veo los datos de mi hogar (RLS)', () => {
  it('un usuario solo ve su propio hogar', async () => {
    const rows = await asUser(db, ana, async (query) => {
      const result = await query('select id from public.households')
      return result.rows
    })
    expect(rows).toEqual([{ id: await householdOf(ana) }])
  })

  it('un usuario no ve quién pertenece a otro hogar', async () => {
    const rows = await asUser(db, ana, async (query) => {
      const result = await query('select user_id from public.household_members')
      return result.rows
    })
    expect(rows).toEqual([{ user_id: ana }])
  })

  it('un usuario puede cambiar el nombre de su hogar', async () => {
    const updated = await asUser(db, ana, async (query) => {
      const result = await query(`update public.households set name = 'Casa de Ana' returning name`)
      return result.rows
    })
    expect(updated).toEqual([{ name: 'Casa de Ana' }])
  })

  it('un usuario no puede cambiar el nombre del hogar de otro', async () => {
    const brunoHousehold = await householdOf(bruno)
    const updated = await asUser(db, ana, async (query) => {
      const result = await query(`update public.households set name = 'Pirateado' where id = $1`, [
        brunoHousehold,
      ])
      return result.rowCount
    })
    expect(updated).toBe(0)
  })

  it('un usuario no puede meterse en el hogar de otro', async () => {
    const brunoHousehold = await householdOf(bruno)
    await expect(
      asUser(db, ana, (query) =>
        query(`insert into public.household_members (household_id, user_id) values ($1, $2)`, [
          brunoHousehold,
          ana,
        ]),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('un usuario no puede crear hogares ni borrarlos desde la app', async () => {
    await expect(
      asUser(db, ana, (query) => query('insert into public.households default values')),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(db, ana, (query) => query('delete from public.households')),
    ).rejects.toThrow(/permission denied/)
  })

  it('sin sesión no se puede leer nada', async () => {
    await expect(
      asUser(db, null, (query) => query('select * from public.households')),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(db, null, (query) => query('select * from public.household_members')),
    ).rejects.toThrow(/permission denied/)
  })
})
