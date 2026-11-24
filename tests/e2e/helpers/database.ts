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

/**
 * Apunta esas partes como hechas en los `weekends` fines de semana anteriores al actual
 * (US-39), cada una el sábado de su vuelta: vueltas antiguas que se quedaron a medias.
 */
export async function addPastPartCompletions(
  email: string,
  taskName: string,
  partNames: string[],
  weekends: number,
) {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    const { rowCount } = await db.query(
      `insert into public.task_part_completions (household_id, task_id, part_id, starts_on, due_by, completed_on)
       select t.household_id, t.id, p.id, s.saturday, s.saturday + 6, s.saturday
       from public.tasks t
       join public.household_members m on m.household_id = t.household_id
       join auth.users u on u.id = m.user_id
       join public.task_parts p on p.task_id = t.id and p.name = any($3::text[])
       cross join lateral (
         select d - ((extract(dow from d)::int + 1) % 7) - 7 * week as saturday
         from (select (now() at time zone 'Europe/Madrid')::date as d) as madrid,
              generate_series(1, $4::int) as week
       ) as s
       where u.email = $1 and t.name = $2`,
      [email, taskName, partNames, weekends],
    )
    if (rowCount !== partNames.length * weekends) {
      throw new Error(`No se han podido apuntar las partes de «${taskName}» de ${email}`)
    }
  } finally {
    await db.end()
  }
}

/**
 * US-38 · Pone la fecha de una tarea puntual del hogar de ese usuario, también una que ya
 * ha pasado (la app no deja: así se prueba una puntual retrasada).
 */
export async function setTaskDueOn(email: string, taskName: string, dueOn: string | null) {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    const { rowCount } = await db.query(
      `update public.tasks t set due_on = $3
       from public.household_members m
       join auth.users u on u.id = m.user_id
       where m.household_id = t.household_id and u.email = $1 and t.name = $2`,
      [email, taskName, dueOn],
    )
    if (rowCount !== 1) throw new Error(`No se ha encontrado la tarea «${taskName}» de ${email}`)
  } finally {
    await db.end()
  }
}

/** Marca como hecha una tarea puntual, como si se hubiera hecho desde otro dispositivo. */
export async function completeOneOffTask(email: string, taskName: string) {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    const { rowCount } = await db.query(
      `insert into public.task_rounds (household_id, task_id)
       select t.household_id, t.id
       from public.tasks t
       join public.household_members m on m.household_id = t.household_id
       join auth.users u on u.id = m.user_id
       where u.email = $1 and t.name = $2`,
      [email, taskName],
    )
    if (rowCount !== 1) throw new Error(`No se ha encontrado la tarea «${taskName}» de ${email}`)
  } finally {
    await db.end()
  }
}

/**
 * US-41 y US-50 · Pone el día en que toca la próxima vez una tarea de cada N días del hogar
 * de ese usuario, también uno que ya ha pasado (la app no deja: así se prueba que va con
 * retraso desde el día siguiente).
 */
export async function setTaskNextDueOn(email: string, taskName: string, nextDueOn: string | null) {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    const { rowCount } = await db.query(
      `update public.tasks t set next_due_on = $3
       from public.household_members m
       join auth.users u on u.id = m.user_id
       where m.household_id = t.household_id and u.email = $1 and t.name = $2`,
      [email, taskName, nextDueOn],
    )
    if (rowCount !== 1) throw new Error(`No se ha encontrado la tarea «${taskName}» de ${email}`)
  } finally {
    await db.end()
  }
}

/**
 * US-51 · Quita una parte de una tarea del hogar de ese usuario, como si se hiciera desde
 * otro dispositivo: la archiva y pone a otra parte el peso que haga falta para sumar 100.
 */
export async function archivePart(email: string, taskName: string, partName: string, otherPart: string) {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('begin')
    const { rows } = await db.query(
      `select p.id, p.name, p.weight from public.task_parts p
       join public.tasks t on t.id = p.task_id
       join public.household_members m on m.household_id = t.household_id
       join auth.users u on u.id = m.user_id
       where u.email = $1 and t.name = $2 and p.archived_on is null and p.name in ($3, $4)`,
      [email, taskName, partName, otherPart],
    )
    const removed = rows.find((row) => row.name === partName)
    const kept = rows.find((row) => row.name === otherPart)
    if (!removed || !kept) throw new Error(`No se han encontrado las partes de «${taskName}» de ${email}`)
    await db.query('update public.task_parts set archived_on = current_date where id = $1', [removed.id])
    await db.query('update public.task_parts set weight = $2 where id = $1', [kept.id, kept.weight + removed.weight])
    await db.query('commit')
  } catch (error) {
    await db.query('rollback')
    throw error
  } finally {
    await db.end()
  }
}

/**
 * US-51 · Cambia el peso de dos partes de una tarea del hogar de ese usuario, como si se
 * hiciera desde otro dispositivo: pasa `amount` puntos de una parte a la otra (siguen sumando 100).
 */
export async function movePartWeight(email: string, taskName: string, from: string, to: string, amount: number) {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    const { rowCount } = await db.query(
      `update public.task_parts p
       set weight = p.weight + case when p.name = $4 then $5::int else -$5::int end
       from public.tasks t, public.household_members m, auth.users u
       where t.id = p.task_id and m.household_id = t.household_id and u.id = m.user_id
         and u.email = $1 and t.name = $2 and p.archived_on is null and p.name in ($3, $4)`,
      [email, taskName, from, to, amount],
    )
    if (rowCount !== 2) throw new Error(`No se han encontrado las partes de «${taskName}» de ${email}`)
  } finally {
    await db.end()
  }
}

/**
 * US-31 · Apunta como terminada una vuelta pasada de una tarea del hogar de ese usuario (la
 * app solo deja terminar la de hoy): la que empieza `startsOn`, con plazo hasta `dueBy`
 * (`null` sin plazo), terminada el día `completedOn`.
 */
export async function addPastRound(
  email: string,
  taskName: string,
  round: { startsOn: string | null; dueBy: string | null; completedOn: string },
) {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    const { rowCount } = await db.query(
      `insert into public.task_rounds (household_id, task_id, starts_on, due_by, completed_on)
       select t.household_id, t.id, $3, $4, $5
       from public.tasks t
       join public.household_members m on m.household_id = t.household_id
       join auth.users u on u.id = m.user_id
       where u.email = $1 and t.name = $2`,
      [email, taskName, round.startsOn, round.dueBy, round.completedOn],
    )
    if (rowCount !== 1) throw new Error(`No se ha encontrado la tarea «${taskName}» de ${email}`)
  } finally {
    await db.end()
  }
}

/**
 * US-31 · Cambia las partes de una tarea del hogar de ese usuario como lo haría «Cambiar
 * partes» (`set_task_parts`) el día `day`, durante la vuelta que empieza `startsOn`: el peso
 * nuevo de cada parte (`null`, se quita ese día), y el mismo peso nuevo para las partes ya
 * hechas en esa vuelta. Así se prepara una vuelta pasada con los pesos cambiados a mitad.
 */
export async function changePartsDuringRound(
  email: string,
  taskName: string,
  startsOn: string,
  day: string,
  weights: Record<string, number | null>,
) {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('begin')
    for (const [partName, weight] of Object.entries(weights)) {
      const { rows } = await db.query(
        `update public.task_parts p
         set weight = coalesce($4::int, p.weight), archived_on = case when $4::int is null then $5::date end
         from public.tasks t, public.household_members m, auth.users u
         where t.id = p.task_id and m.household_id = t.household_id and u.id = m.user_id
           and u.email = $1 and t.name = $2 and p.name = $3 and p.archived_on is null
         returning p.id`,
        [email, taskName, partName, weight, day],
      )
      if (rows.length !== 1) throw new Error(`No se ha encontrado la parte «${partName}» de «${taskName}» de ${email}`)
      if (weight !== null) {
        await db.query('update public.task_part_completions set weight = $2 where part_id = $1 and starts_on = $3', [
          rows[0].id,
          weight,
          startsOn,
        ])
      }
    }
    await db.query('commit')
  } catch (error) {
    await db.query('rollback')
    throw error
  } finally {
    await db.end()
  }
}
