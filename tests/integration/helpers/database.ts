import { randomUUID } from 'node:crypto'
import pg from 'pg'

// Ayudas para probar la base de datos de Supabase en local (npx supabase start o
// npx supabase db start). Se conecta directamente a PostgreSQL, como administrador,
// y puede hacerse pasar por un usuario concreto para comprobar las reglas de seguridad.

const connectionString =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export function connect(): pg.Client {
  return new pg.Client({ connectionString })
}

/** Crea un usuario de Supabase Auth, como si se registrara. Devuelve su id. */
export async function createUser(db: pg.Client): Promise<string> {
  const id = randomUUID()
  await db.query(
    `insert into auth.users (id, email, aud, role)
     values ($1, $2, 'authenticated', 'authenticated')`,
    [id, `test-${id}@example.test`],
  )
  return id
}

/** Borra usuarios de prueba y los hogares que se quedan sin nadie. */
export async function deleteUsers(db: pg.Client, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db.query('delete from auth.users where id = any($1::uuid[])', [ids])
  await db.query(
    `delete from public.households h
     where not exists (select 1 from public.household_members m where m.household_id = h.id)`,
  )
}

/**
 * Ejecuta consultas como si las hiciera la app con la sesión de ese usuario
 * (rol "authenticated" y su id en el token), o sin sesión si userId es null (rol "anon").
 * Todo se deshace al terminar, así que las pruebas no dejan rastro.
 */
export async function asUser<T>(
  db: pg.Client,
  userId: string | null,
  run: (query: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>,
): Promise<T> {
  await db.query('begin')
  try {
    if (userId) {
      await db.query('set local role authenticated')
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ])
    } else {
      await db.query('set local role anon')
    }
    return await run((sql, params) => db.query(sql, params))
  } finally {
    await db.query('rollback')
  }
}
