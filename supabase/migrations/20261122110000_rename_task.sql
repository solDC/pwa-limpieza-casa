-- US-54 · Cambiar el nombre de una tarea y de sus partes
--
-- La app cambia el nombre de una tarea y el de sus partes con la función rename_task (no
-- puede escribir en tasks ni en task_parts directamente). Lo que se renombra pierde su
-- clave de tarea por defecto (default_key, US-52): deja de traducirse y se ve como se
-- escribió, en castellano y en inglés. Lo que no se renombra la conserva.
--
-- Además, no puede haber dos tareas con el mismo nombre en un hogar (US-33 y US-54), ni al
-- añadirlas (create_task) ni al renombrarlas. Se compara el nombre guardado sin espacios al
-- principio y al final y sin distinguir mayúsculas («baño » es «Baño»), solo con las tareas
-- no canceladas: una cancelada no bloquea su nombre. Las partes sí pueden repetirse.
--
-- Lo comprueban las funciones, no un índice único: así la migración no falla en un hogar que
-- ya tenga dos tareas iguales (se quedan, pero no se pueden crear más).
--
-- Compatible con la versión anterior de la app: create_task se llama igual que antes.

-- ---------------------------------------------------------------------------
-- Nombre repetido
-- ---------------------------------------------------------------------------

-- Falla (23505) si el hogar ya tiene otra tarea no cancelada con ese nombre. Bloquea los
-- nombres del hogar hasta el final de la transacción, para que dos móviles que guardan a la
-- vez el mismo nombre no lo consigan los dos.
-- Sin security definer: solo la llaman create_task y rename_task, que ya lo son.
create function public.check_task_name_free(
  target_household_id uuid,
  task_name text,
  except_task_id uuid default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('task_names:' || target_household_id::text, 0));
  if exists (
    select 1
    from public.tasks
    where household_id = target_household_id
      and cancelled_on is null
      and id is distinct from except_task_id
      and lower(btrim(name)) = lower(btrim(task_name))
  ) then
    raise exception using errcode = '23505', message = 'Ya tienes una tarea con ese nombre.';
  end if;
end;
$$;

revoke execute on function public.check_task_name_free(uuid, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Crear una tarea: sin nombres repetidos
-- ---------------------------------------------------------------------------

-- La misma función que en …_interval_first_due_on.sql (US-50), con la comprobación del nombre.
create or replace function public.create_task(
  target_household_id uuid,
  task_name text,
  task_frequency text,
  task_interval_days integer default null,
  task_biweekly_start_on date default null,
  part_names text[] default '{}',
  part_weights integer[] default '{}',
  task_due_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_task_id uuid;
  next_position integer;
begin
  if not public.is_household_member(target_household_id) then
    raise exception using errcode = '42501', message = 'No eres miembro de ese hogar.';
  end if;

  if coalesce(cardinality(part_names), 0) > 20 then
    raise exception using errcode = '22023', message = 'Como mucho 20 partes por tarea.';
  end if;

  if coalesce(cardinality(part_names), 0) <> coalesce(cardinality(part_weights), 0) then
    raise exception using errcode = '22023', message = 'Cada parte necesita su peso.';
  end if;

  perform public.check_due_on_not_past(task_due_on);
  perform public.check_task_name_free(target_household_id, task_name);

  select coalesce(max(position), 0) + 1 into next_position
  from public.tasks
  where household_id = target_household_id;

  -- Las reglas de la tabla (nombre, frecuencia, días del intervalo, primer finde, cada día
  -- solo en su frecuencia) rechazan los datos que no valen: en una de fin de semana, el día
  -- va a due_on y tasks_due_on_check lo rechaza, como antes.
  insert into public.tasks (
    household_id, name, position, frequency, interval_days, biweekly_start_on, due_on, next_due_on
  )
  values (
    target_household_id,
    btrim(task_name),
    next_position,
    task_frequency,
    task_interval_days,
    task_biweekly_start_on,
    case when task_frequency = 'interval' then null else task_due_on end,
    case when task_frequency = 'interval' then task_due_on end
  )
  returning id into new_task_id;

  insert into public.task_parts (household_id, task_id, name, position, weight)
  select target_household_id, new_task_id, btrim(part.name), part.position, part.weight
  from unnest(part_names, part_weights) with ordinality as part (name, weight, position);

  return new_task_id;
end;
$$;

-- Los permisos no cambian con «create or replace», pero se repiten para que se lean aquí:
-- solo los usuarios con sesión pueden crear tareas (y la función comprueba el hogar).
revoke execute on function public.create_task(uuid, text, text, integer, date, text[], integer[], date)
  from public, anon;
grant execute on function public.create_task(uuid, text, text, integer, date, text[], integer[], date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Renombrar una tarea y sus partes
-- ---------------------------------------------------------------------------

-- Cambia el nombre de una tarea no cancelada del hogar del usuario (new_name; null si no
-- cambia) y el de algunas de sus partes (part_ids, con su nombre nuevo en part_names, en el
-- mismo orden). Lo renombrado pierde su clave de tarea por defecto.
-- Es security definer porque la app no puede cambiar tasks ni task_parts directamente: así
-- solo puede tocar los nombres.
-- Errores:
-- - 42501: la tarea no existe o es de otro hogar (no se distingue, para no dar pistas).
-- - 22023: está cancelada, o alguna parte no es de esa tarea o le falta su nombre.
-- - 23505: el hogar ya tiene otra tarea con ese nombre.
-- - 23514: un nombre vacío o de más de 80 caracteres (las reglas de las tablas).
create function public.rename_task(
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
  where p.id = renamed.id and p.task_id = target_task_id;
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
