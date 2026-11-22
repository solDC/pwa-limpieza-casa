-- US-51 · Cambiar las partes de una tarea
--
-- En una tarea que ya existe se pueden cambiar los pesos de sus partes, añadir partes y
-- quitarlas, también todas (sin partes, la tarea se marca entera). La app lo hace con la
-- función set_task_parts, de una vez: no puede escribir en task_parts directamente.
--
-- Quitar una parte la archiva (task_parts.archived_on, nueva): deja de salir y de contar,
-- pero no se borra, para que las vueltas pasadas conserven sus partes hechas y su porcentaje
-- (el peso de cada parte hecha ya lo guarda task_part_completions, US-39). Se archivan
-- también las que nunca se han hecho: así es igual para todas.
--
-- Los cambios cuentan desde la vuelta en curso: sus partes ya hechas siguen hechas. Si al
-- quitar partes ya están hechas todas las que quedan (al menos una), la vuelta queda
-- completada, como al marcar la última parte. Si se quitan todas, no: la tarea pasa a
-- marcarse entera (si no, quitarlas todas sin hacer ninguna la daría por hecha).
--
-- Compatible con la versión anterior de la app: la columna admite vacío (ninguna parte está
-- archivada hasta que se use la función nueva), y las reglas que cambian solo dejan fuera
-- las partes archivadas.

-- ---------------------------------------------------------------------------
-- Columna
-- ---------------------------------------------------------------------------

alter table public.task_parts
  -- Día (en Madrid) en que se quitó la parte. Vacío, la parte sigue en la tarea.
  add column archived_on date;

-- ---------------------------------------------------------------------------
-- Las partes archivadas no cuentan
-- ---------------------------------------------------------------------------

-- Los pesos de las partes de una tarea suman 100: ahora solo los de las que no están
-- archivadas. Sin partes (todas archivadas, o la tarea borrada), no hay nada que comprobar.
-- La misma función que en …_create_tasks.sql, con el filtro de las archivadas.
create or replace function public.check_task_part_weights()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_task_id uuid := coalesce(new.task_id, old.task_id);
  total integer;
begin
  select sum(weight) into total
  from public.task_parts
  where task_id = target_task_id and archived_on is null;
  if total is not null and total <> 100 then
    raise exception using
      errcode = '23514',
      message = format('Los pesos de las partes de una tarea tienen que sumar 100 (suman %s).', total);
  end if;
  return null;
end;
$$;

revoke execute on function public.check_task_part_weights() from public, anon, authenticated;

-- Una parte archivada ya no se puede marcar como hecha. La misma función que en
-- …_task_part_completions.sql, con esa comprobación.
create or replace function public.set_task_part_completion_weight()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  part public.task_parts;
begin
  -- Si dos móviles marcan a la vez las dos últimas partes de una tarea, ninguno vería la
  -- parte del otro (aún sin confirmar) y la vuelta se quedaría sin terminar, con todas las
  -- partes hechas. Con este cerrojo, por tarea y hasta el final de la transacción, el
  -- segundo espera al primero y ya ve su parte.
  perform pg_advisory_xact_lock(hashtextextended(new.task_id::text, 0));
  select * into part from public.task_parts p where p.id = new.part_id;
  if part.archived_on is not null then
    raise exception using errcode = '22023', message = 'Esa parte ya no es de la tarea.';
  end if;
  new.weight := part.weight;
  return new;
end;
$$;

revoke execute on function public.set_task_part_completion_weight() from public, anon, authenticated;

-- Con todas las partes (no archivadas) hechas, la vuelta queda terminada. La misma función
-- que en …_task_part_completions.sql, sin contar las archivadas.
create or replace function public.complete_round_when_all_parts_done()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.task_parts p
    where p.task_id = new.task_id
      and p.archived_on is null
      and not exists (
        select 1
        from public.task_part_completions c
        where c.part_id = p.id and c.starts_on is not distinct from new.starts_on
      )
  ) then
    -- Al marcar varias partes de una vez, la vuelta se apunta con la primera y las demás
    -- no hacen nada. Si ya hay otra vuelta de hoy (task_rounds_task_id_completed_on_key),
    -- sí falla, y no se guarda ninguna parte.
    insert into public.task_rounds (household_id, task_id, starts_on, due_by)
    values (new.household_id, new.task_id, new.starts_on, new.due_by)
    on conflict on constraint task_rounds_task_id_starts_on_key do nothing;
  end if;
  return null;
end;
$$;

revoke execute on function public.complete_round_when_all_parts_done() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Renombrar (US-54): solo las partes que siguen en la tarea
-- ---------------------------------------------------------------------------

-- La misma función que en …_rename_task.sql: una parte archivada cuenta como «no es de esa
-- tarea».
create or replace function public.rename_task(
  target_task_id uuid,
  new_name text default null,
  part_ids uuid[] default '{}',
  part_names text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.tasks;
  renamed_parts integer;
begin
  -- Solo bloquea la fila si es del hogar del usuario: una tarea de otro hogar ni se bloquea.
  select * into target
  from public.tasks
  where id = target_task_id and public.is_household_member(household_id)
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'No existe esa tarea en tu hogar.';
  end if;

  if target.cancelled_on is not null then
    raise exception using errcode = '22023', message = 'No se puede renombrar una tarea cancelada.';
  end if;

  if coalesce(cardinality(part_ids), 0) <> coalesce(cardinality(part_names), 0) then
    raise exception using errcode = '22023', message = 'Cada parte necesita su nombre.';
  end if;

  if new_name is not null then
    perform public.check_task_name_free(target.household_id, new_name, target_task_id);
    update public.tasks
    set name = btrim(new_name), default_key = null
    where id = target_task_id;
  end if;

  update public.task_parts p
  set name = btrim(renamed.name), default_key = null
  from unnest(part_ids, part_names) as renamed (id, name)
  where p.id = renamed.id and p.task_id = target_task_id and p.archived_on is null;
  get diagnostics renamed_parts = row_count;

  -- Todas las partes tienen que ser de esta tarea (y no repetirse).
  if renamed_parts <> coalesce(cardinality(part_ids), 0)
    or renamed_parts <> (select count(distinct id) from unnest(part_ids) as id) then
    raise exception using errcode = '22023', message = 'Alguna parte no es de esa tarea.';
  end if;
end;
$$;

revoke execute on function public.rename_task(uuid, text, uuid[], text[]) from public, anon;
grant execute on function public.rename_task(uuid, text, uuid[], text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Cambiar las partes
-- ---------------------------------------------------------------------------

-- Cambia las partes de una tarea no cancelada del hogar del usuario, de una vez:
-- - kept_part_ids / kept_weights: las partes que siguen, cada una con su peso (en el mismo
--   orden). Conservan su sitio.
-- - new_part_names / new_part_weights: las partes nuevas, que van al final, en ese orden.
-- - Las que no vienen se archivan.
-- - round_starts_on / round_due_by: la vuelta en curso, como al marcar una parte. Si ya
--   están hechas en ella todas las que quedan (al menos una), se apunta como terminada hoy.
-- Devuelve los ids de las partes nuevas, en su orden, y el día en que se ha terminado la
-- vuelta (vacío si no se ha terminado): {"new_part_ids": [...], "completed_on": ...}.
-- Es security definer porque la app no puede escribir en task_parts ni en task_rounds
-- directamente: así solo puede hacer esto, en una tarea de su hogar.
-- Errores:
-- - 42501: la tarea no existe o es de otro hogar (no se distingue, para no dar pistas).
-- - 22023: está cancelada, alguna parte no es de esa tarea (o está archivada o repetida),
--   falta un peso o hay más de 20 partes.
-- - 23514: los pesos no suman 100, un peso o un nombre que no valen (las reglas de la
--   tabla), o la fecha del dispositivo no es la de la vuelta.
-- - 23505: la tarea ya se ha terminado hoy (en otro dispositivo).
create function public.set_task_parts(
  target_task_id uuid,
  kept_part_ids uuid[],
  kept_weights integer[],
  new_part_names text[],
  new_part_weights integer[],
  round_starts_on date,
  round_due_by date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.tasks;
  kept_count integer := coalesce(cardinality(kept_part_ids), 0);
  new_count integer := coalesce(cardinality(new_part_names), 0);
  matching integer;
  next_position integer;
  new_ids uuid[];
  completed date;
  today date := (now() at time zone 'Europe/Madrid')::date;
begin
  -- Solo bloquea la fila si es del hogar del usuario: una tarea de otro hogar ni se bloquea.
  select * into target
  from public.tasks
  where id = target_task_id and public.is_household_member(household_id)
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'No existe esa tarea en tu hogar.';
  end if;

  if target.cancelled_on is not null then
    raise exception using errcode = '22023', message = 'No se pueden cambiar las partes de una tarea cancelada.';
  end if;

  if kept_count <> coalesce(cardinality(kept_weights), 0)
    or new_count <> coalesce(cardinality(new_part_weights), 0) then
    raise exception using errcode = '22023', message = 'Cada parte necesita su peso.';
  end if;

  if kept_count + new_count > 20 then
    raise exception using errcode = '22023', message = 'Como mucho 20 partes por tarea.';
  end if;

  -- Mientras se cambian, nadie marca partes de esta tarea (el mismo cerrojo que al marcar).
  perform pg_advisory_xact_lock(hashtextextended(target_task_id::text, 0));

  -- Las que siguen son partes de esta tarea, sin archivar y sin repetir.
  select count(*) into matching
  from public.task_parts
  where task_id = target_task_id and archived_on is null and id = any (kept_part_ids);
  if matching <> kept_count or kept_count <> (select count(distinct id) from unnest(kept_part_ids) as id) then
    raise exception using errcode = '22023', message = 'Alguna parte no es de esa tarea.';
  end if;

  -- Se archivan las que no siguen.
  update public.task_parts
  set archived_on = today
  where task_id = target_task_id and archived_on is null and not (id = any (coalesce(kept_part_ids, '{}')));

  -- Los pesos de las que siguen.
  update public.task_parts p
  set weight = kept.weight
  from unnest(kept_part_ids, kept_weights) as kept (id, weight)
  where p.id = kept.id;

  -- Las nuevas, al final (también detrás de las archivadas).
  select coalesce(max(position), 0) into next_position from public.task_parts where task_id = target_task_id;
  with inserted as (
    insert into public.task_parts (household_id, task_id, name, position, weight)
    select target.household_id, target_task_id, btrim(part.name), next_position + part.position, part.weight
    from unnest(new_part_names, new_part_weights) with ordinality as part (name, weight, position)
    returning id, position
  )
  select coalesce(array_agg(id order by position), '{}') into new_ids from inserted;

  -- Si ya están hechas en la vuelta en curso todas las que quedan (y queda alguna), la vuelta
  -- se termina hoy, como al marcar la última parte. Las reglas de task_rounds (el día dentro
  -- del plazo, una vuelta por día) valen igual.
  if kept_count > 0 and new_count = 0 and not exists (
    select 1
    from public.task_parts p
    where p.task_id = target_task_id
      and p.archived_on is null
      and not exists (
        select 1
        from public.task_part_completions c
        where c.part_id = p.id and c.starts_on is not distinct from round_starts_on
      )
  ) then
    insert into public.task_rounds (household_id, task_id, starts_on, due_by)
    values (target.household_id, target_task_id, round_starts_on, round_due_by)
    on conflict on constraint task_rounds_task_id_starts_on_key do nothing
    returning completed_on into completed;
  end if;

  return jsonb_build_object('new_part_ids', to_jsonb(new_ids), 'completed_on', completed);
end;
$$;

revoke execute on function public.set_task_parts(uuid, uuid[], integer[], text[], integer[], date, date)
  from public, anon;
grant execute on function public.set_task_parts(uuid, uuid[], integer[], text[], integer[], date, date)
  to authenticated;
