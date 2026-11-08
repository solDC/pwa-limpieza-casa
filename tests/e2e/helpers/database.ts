import pg from 'pg'

// Para preparar datos que la app no deja crear (por ejemplo, una tarea creada hace días).
// Se conecta a la base de datos de Supabase en local como administrador.

const connectionString =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** Cambia el día en que se creó una tarea del hogar de ese usuario. */
export async function setTaskCreatedOn(email: string, taskName: string, createdOn: string) {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    const { rowCount } = await db.query(
      `update public.tasks t set created_on = $3
       from public.household_members m
       join auth.users u on u.id = m.user_id
       where m.household_id = t.household_id and u.email = $1 and t.name = $2`,
      [email, taskName, createdOn],
    )
    if (rowCount !== 1) throw new Error(`No se ha encontrado la tarea «${taskName}» de ${email}`)
  } finally {
    await db.end()
  }
}
