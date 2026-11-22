-- US-51 · Cambiar las partes de una tarea: también su nombre
--
-- En «Cambiar partes» se puede cambiar también el nombre de las partes que ya existen, no
-- solo su peso (antes se cambiaba solo con «Cambiar nombre», US-54). set_task_parts recibe
-- un argumento nuevo, kept_names, y lo guarda todo de una vez: nombres, pesos, partes nuevas
-- y quitadas.
--
-- Es una migración nueva, y no un cambio en …_edit_task_parts.sql, porque esa ya puede
-- estar aplicada en el proyecto de pruebas.
--
-- Compatible con la versión anterior de la app: kept_names va al final y es opcional, así
-- que la llamada de antes (sin nombres) sigue igual. Se borra la función de antes porque con
-- otra lista de argumentos sería otra función, y habría dos.

drop function public.set_task_parts(uuid, uuid[], uuid[], integer[], text[], integer[], date, date);

-- Cambia las partes de una tarea no cancelada del hogar del usuario, de una vez. Igual que
-- la de …_edit_task_parts.sql (allí están todos los argumentos y los errores), y además:
-- - kept_names: el nombre nuevo de cada parte que sigue, en el orden de kept_part_ids, o
--   vacío (null) si no se ha renombrado. Sin el argumento, no se renombra ninguna. Una
--   parte renombrada pierde su clave (default_key): se ve como se escribió en cualquier
--   idioma. El nombre lo comprueba la tabla (de 1 a 80 caracteres, 23514).
-- - 22023 también si kept_names no tiene un elemento por cada parte que sigue.

create function public.set_task_parts(
  target_task_id uuid,
  shown_part_ids uuid[],
  kept_part_ids uuid[],
  kept_weights integer[],
  new_part_names text[],
  new_part_weights integer[],
  round_starts_on date,
  round_due_by date,
  kept_names text[] default null
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
  -- Mientras se cambian, nadie marca partes de esta tarea (el mismo cerrojo que al marcar).
  -- Se pide antes de bloquear la fila de la tarea, en el mismo orden que al marcar una parte
  -- (que pide este cerrojo y después la fila): en el orden contrario, uno esperaría al otro
  -- y la base de datos rechazaría uno de los dos.
  perform pg_advisory_xact_lock(hashtextextended(target_task_id::text, 0));

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

  -- Las partes de la tarea son las que se veían al abrir el formulario.
  if exists (
    select id from public.task_parts where task_id = target_task_id and archived_on is null
    except
    select unnest(coalesce(shown_part_ids, '{}'))
  ) or exists (
    select unnest(coalesce(shown_part_ids, '{}'))
    except
    select id from public.task_parts where task_id = target_task_id and archived_on is null
  ) then
    raise exception using errcode = '22023', message = 'Las partes de la tarea han cambiado.';
  end if;

  if kept_count <> coalesce(cardinality(kept_weights), 0)
    or new_count <> coalesce(cardinality(new_part_weights), 0) then
    raise exception using errcode = '22023', message = 'Cada parte necesita su peso.';
  end if;

  if kept_names is not null and cardinality(kept_names) <> kept_count then
    raise exception using errcode = '22023', message = 'Cada parte que sigue necesita su nombre (o vacío, si no cambia).';
  end if;

  if kept_count + new_count > 20 then
    raise exception using errcode = '22023', message = 'Como mucho 20 partes por tarea.';
  end if;

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

  -- Los pesos de las que siguen y, si se han renombrado, su nombre, que deja de traducirse
  -- (pierde la clave), como con rename_task.
  update public.task_parts p
  set weight = kept.weight,
    name = coalesce(btrim(kept.name), p.name),
    default_key = case when kept.name is null then p.default_key end
  from unnest(kept_part_ids, kept_weights, kept_names) as kept (id, weight, name)
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

-- Solo la app con sesión (comprueba ella misma que la tarea es del hogar del usuario).
revoke execute on function public.set_task_parts(uuid, uuid[], uuid[], integer[], text[], integer[], date, date, text[])
  from public, anon;
grant execute on function public.set_task_parts(uuid, uuid[], uuid[], integer[], text[], integer[], date, date, text[])
  to authenticated;
