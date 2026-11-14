import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, connect, createUser, deleteUsers } from './helpers/database'

// US-39 · Marcar una parte como hecha (#57)
// y las reglas de seguridad (RLS) de task_part_completions.

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

type Query = (sql: string, params?: unknown[]) => Promise<pg.QueryResult>

/** «Superficies» (Cocina 50 %, Salón 25 %, Dormitorio 25 %) del hogar del usuario. */
async function surfacesOf(userId: string) {
  const { rows } = await db.query(
    `select t.household_id as household, t.id as task,
            (select jsonb_object_agg(p.name, p.id) from public.task_parts p where p.task_id = t.id) as parts
     from public.tasks t
     join public.household_members m on m.household_id = t.household_id
     where m.user_id = $1 and t.name = 'Superficies'`,
    [userId],
  )
  return rows[0] as { household: string; task: string; parts: Record<string, string> }
}

/** La vuelta de fin de semana en la que está hoy (en Madrid): del sábado al viernes. */
async function thisWeekend() {
  const { rows } = await db.query(
    `select to_char(d - ((extract(dow from d)::int + 1) % 7), 'YYYY-MM-DD') as starts_on,
            to_char(d - ((extract(dow from d)::int + 1) % 7) + 6, 'YYYY-MM-DD') as due_by,
            to_char(d, 'YYYY-MM-DD') as today
     from (select (now() at time zone 'Europe/Madrid')::date as d) as madrid`,
  )
  return rows[0] as { starts_on: string; due_by: string; today: string }
}

const insertPart = `insert into public.task_part_completions (household_id, task_id, part_id, starts_on, due_by)
  values ($1, $2, $3, $4, $5)
  returning weight, to_char(completed_on, 'YYYY-MM-DD') as completed_on`

const roundsOf = `select to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(completed_on, 'YYYY-MM-DD') as completed_on
  from public.task_rounds where task_id = $1`

describe('US-39 · marcar una parte como hecha', () => {
  it('apunto una parte de una tarea de mi hogar, con el día de hoy en Madrid y su peso', async () => {
    const { household, task, parts } = await surfacesOf(ana)
    const round = await thisWeekend()
    const inserted = await asUser(db, ana, (query) =>
      query(insertPart, [household, task, parts['Cocina'], round.starts_on, round.due_by]),
    )
    expect(inserted.rows).toEqual([{ weight: 50, completed_on: round.today }])
  })

  it('la app no puede elegir el peso ni el día en que se hizo', async () => {
    const { household, task, parts } = await surfacesOf(ana)
    for (const [column, value] of [
      ['weight', '100'],
      ['completed_on', `'2026-11-01'`],
    ]) {
      await expect(
        asUser(db, ana, (query) =>
          query(
            `insert into public.task_part_completions (household_id, task_id, part_id, ${column})
             values ($1, $2, $3, ${value})`,
            [household, task, parts['Cocina']],
          ),
        ),
      ).rejects.toThrow(/permission denied/)
    }
  })

  it('con una parte hecha, la vuelta no queda terminada', async () => {
    const { household, task, parts } = await surfacesOf(ana)
    const round = await thisWeekend()
    const rounds = await asUser(db, ana, async (query) => {
      await query(insertPart, [household, task, parts['Cocina'], round.starts_on, round.due_by])
      await query(insertPart, [household, task, parts['Salón'], round.starts_on, round.due_by])
      return query(roundsOf, [task])
    })
    expect(rounds.rows).toEqual([])
  })

  it('al marcar la última parte, la vuelta queda terminada con el día de hoy', async () => {
    const { household, task, parts } = await surfacesOf(ana)
    const round = await thisWeekend()
    const rounds = await asUser(db, ana, async (query) => {
      for (const part of ['Cocina', 'Salón', 'Dormitorio']) {
        await query(insertPart, [household, task, parts[part], round.starts_on, round.due_by])
      }
      return query(roundsOf, [task])
    })
    expect(rounds.rows).toEqual([{ starts_on: round.starts_on, completed_on: round.today }])
  })

  it('al marcar de una vez las partes que faltan, la vuelta queda terminada una sola vez', async () => {
    const { household, task, parts } = await surfacesOf(ana)
    const round = await thisWeekend()
    const rounds = await asUser(db, ana, async (query) => {
      await query(insertPart, [household, task, parts['Cocina'], round.starts_on, round.due_by])
      await query(
        `insert into public.task_part_completions (household_id, task_id, part_id, starts_on, due_by)
         values ($1, $2, $3, $5, $6), ($1, $2, $4, $5, $6)`,
        [household, task, parts['Salón'], parts['Dormitorio'], round.starts_on, round.due_by],
      )
      return query(roundsOf, [task])
    })
    expect(rounds.rows).toEqual([{ starts_on: round.starts_on, completed_on: round.today }])
  })

  it('las partes hechas en otra vuelta no cuentan para esta', async () => {
    const { household, task, parts } = await surfacesOf(ana)
    const round = await thisWeekend()
    // Como administrador: dos partes hechas el finde pasado, que se quedó a medias.
    await db.query('begin')
    try {
      await db.query(
        `insert into public.task_part_completions (household_id, task_id, part_id, starts_on, due_by, completed_on)
         select $1, $2, p.id, $3::date - 7, $3::date - 1, $3::date - 7
         from public.task_parts p where p.task_id = $2 and p.name in ('Cocina', 'Salón')`,
        [household, task, round.starts_on],
      )
      await db.query(insertPart, [household, task, parts['Dormitorio'], round.starts_on, round.due_by])
      const rounds = await db.query(roundsOf, [task])
      expect(rounds.rows).toEqual([])
    } finally {
      await db.query('rollback')
    }
  })

  it('una parte no se marca dos veces en la misma vuelta', async () => {
    const { household, task, parts } = await surfacesOf(ana)
    const round = await thisWeekend()
    await expect(
      asUser(db, ana, async (query) => {
        await query(insertPart, [household, task, parts['Cocina'], round.starts_on, round.due_by])
        await query(insertPart, [household, task, parts['Cocina'], round.starts_on, round.due_by])
      }),
    ).rejects.toThrow(/task_part_completions_part_id_starts_on_key/)
  })

  // Si el reloj del móvil va mal, la vuelta que manda puede no ser la de hoy.
  it('en las de fin de semana, el día de hoy tiene que estar dentro de la vuelta', async () => {
    const { household, task, parts } = await surfacesOf(ana)
    await expect(
      asUser(db, ana, (query) =>
        query(insertPart, [household, task, parts['Cocina'], '2026-01-03', '2026-01-09']),
      ),
    ).rejects.toThrow(/task_part_completions_completed_on_check/)
  })

  it('si la tarea ya se ha hecho hoy, no se termina otra vuelta el mismo día: no se guarda la parte', async () => {
    const { household, task, parts } = await surfacesOf(ana)
    await expect(
      asUser(db, ana, async (query: Query) => {
        // Como una de «cada N días» con partes: una vuelta hecha hoy y, después, la siguiente.
        await query(
          `insert into public.task_rounds (household_id, task_id, starts_on) values ($1, $2, '2026-11-01')`,
          [household, task],
        )
        await query(
          `insert into public.task_part_completions (household_id, task_id, part_id, starts_on)
           select $1, $2, p.id, '2026-11-04' from public.task_parts p where p.task_id = $2`,
          [household, task],
        )
      }),
    ).rejects.toThrow(/task_rounds_task_id_completed_on_key/)
    expect(Object.keys(parts)).toHaveLength(3)
  })
})

describe('US-39 · solo veo y apunto partes hechas de mi hogar (RLS)', () => {
  it('un usuario solo ve las partes hechas de su hogar', async () => {
    const anaTask = await surfacesOf(ana)
    const brunoTask = await surfacesOf(bruno)
    await db.query('begin')
    try {
      await db.query(insertPart, [anaTask.household, anaTask.task, anaTask.parts['Cocina'], null, null])
      await db.query(insertPart, [brunoTask.household, brunoTask.task, brunoTask.parts['Cocina'], null, null])
      await db.query('set local role authenticated')
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: ana, role: 'authenticated' }),
      ])
      const seen = await db.query('select distinct household_id from public.task_part_completions')
      expect(seen.rows).toEqual([{ household_id: anaTask.household }])
    } finally {
      await db.query('rollback')
    }
  })

  it('no puedo apuntar una parte hecha en el hogar de otro', async () => {
    const { household, task, parts } = await surfacesOf(bruno)
    await expect(
      asUser(db, ana, (query) => query(insertPart, [household, task, parts['Cocina'], null, null])),
    ).rejects.toThrow(/row-level security/)
  })

  it('no puedo apuntar en mi hogar una parte de una tarea de otro hogar', async () => {
    const mine = await surfacesOf(ana)
    const theirs = await surfacesOf(bruno)
    await expect(
      asUser(db, ana, (query) =>
        query(insertPart, [mine.household, theirs.task, theirs.parts['Cocina'], null, null]),
      ),
    ).rejects.toThrow(/task_part_completions_task_fkey/)
    // Ni una parte de otra tarea en una tarea mía.
    await expect(
      asUser(db, ana, (query) =>
        query(insertPart, [mine.household, mine.task, theirs.parts['Cocina'], null, null]),
      ),
    ).rejects.toThrow(/task_part_completions_part_fkey/)
  })

  it('no puedo cambiar ni borrar partes hechas desde la app', async () => {
    for (const sql of [
      `update public.task_part_completions set starts_on = '2026-01-01'`,
      `delete from public.task_part_completions`,
    ]) {
      await expect(asUser(db, ana, (query) => query(sql))).rejects.toThrow(/permission denied/)
    }
  })

  it('sin sesión no se puede leer ni apuntar nada', async () => {
    const { household, task, parts } = await surfacesOf(ana)
    await expect(
      asUser(db, null, (query) => query('select * from public.task_part_completions')),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(db, null, (query) => query(insertPart, [household, task, parts['Cocina'], null, null])),
    ).rejects.toThrow(/permission denied/)
  })
})
