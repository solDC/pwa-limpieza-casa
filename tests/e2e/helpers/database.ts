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

/**
 * Cambia el día en que se crearon todas las tareas del hogar de ese usuario: como si se
 * hubiera dado de alta ese día (las tareas por defecto se crean al darse de alta).
 */
export async function setAllTasksCreatedOn(email: string, createdOn: string) {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    const { rowCount } = await db.query(
      `update public.tasks t set created_on = $2
       from public.household_members m
       join auth.users u on u.id = m.user_id
       where m.household_id = t.household_id and u.email = $1`,
      [email, createdOn],
    )
    if (!rowCount) throw new Error(`No se han encontrado tareas de ${email}`)
  } finally {
    await db.end()
  }
}

/** El idioma guardado en la cuenta de ese usuario (US-52), o `null` si no tiene. */
export async function accountLanguage(email: string): Promise<string | null> {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    const { rows } = await db.query(
      `select raw_user_meta_data->>'lang' as lang from auth.users where email = $1`,
      [email],
    )
    return rows[0]?.lang ?? null
  } finally {
    await db.end()
  }
}

/** Quita el idioma guardado en la cuenta: como las cuentas creadas antes de la US-52. */
export async function removeAccountLanguage(email: string) {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query(
      `update auth.users set raw_user_meta_data = raw_user_meta_data - 'lang' where email = $1`,
      [email],
    )
  } finally {
    await db.end()
  }
}
