-- US-33 · Añadir una tarea
--
-- La app puede crear tareas nuevas, con sus partes. Lo hace con una sola función,
-- create_task, que guarda la tarea y sus partes de una vez: si algo falla, no se guarda
-- nada (no puede quedar una tarea sin sus partes ni partes sin tarea).
-- La app no puede insertar directamente en tasks ni en task_parts: solo con esta función.
--
-- Además, dos reglas que hasta ahora no hacían falta, porque solo la base de datos creaba
-- tareas (las de por defecto, US-27):
-- - Los pesos de las partes de una tarea suman 100.
-- - En las de «fin de semana cada 15 días», el primer finde empieza en sábado.
-- - En las de «cada N días», como mucho 365 días; y como mucho 20 partes por tarea.
--   Son los mismos límites que el formulario (src/domain/new-task.ts).

-- ---------------------------------------------------------------------------
-- Reglas
-- ---------------------------------------------------------------------------

alter table public.tasks
  add constraint tasks_biweekly_start_on_saturday_check
    check (biweekly_start_on is null or extract(isodow from biweekly_start_on) = 6),
  add constraint tasks_interval_days_max_check
    check (interval_days is null or interval_days <= 365);

-- Los pesos de las partes de una tarea suman 100. Se comprueba al final de la
-- transacción (deferrable initially deferred), cuando ya están todas las partes:
-- parte a parte, la suma todavía no es 100.
-- Es security definer porque se ejecuta con el usuario que guarda: también Supabase Auth
-- al dar de alta a alguien (supabase_auth_admin, que crea las tareas por defecto y no
-- puede leer task_parts). Solo suma pesos; no devuelve nada.
create function public.check_task_part_weights()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_task_id uuid := coalesce(new.task_id, old.task_id);
  total integer;
begin
  select sum(weight) into total from public.task_parts where task_id = target_task_id;
  -- Sin partes (por ejemplo, si se ha borrado la tarea), no hay nada que comprobar.
  if total is not null and total <> 100 then
    raise exception using
      errcode = '23514',
      message = format('Los pesos de las partes de una tarea tienen que sumar 100 (suman %s).', total);
  end if;
  return null;
end;
$$;

create constraint trigger task_parts_weights_sum_check
  after insert or update or delete on public.task_parts
  deferrable initially deferred
  for each row
  execute function public.check_task_part_weights();

-- ---------------------------------------------------------------------------
-- Crear una tarea
-- ---------------------------------------------------------------------------

-- Crea una tarea en un hogar del que el usuario es miembro, con sus partes (opcionales) y
-- el peso de cada una (los calcula la app: a partes iguales, US-33). Va al final de la
-- lista. El día de creación lo pone la base de datos (hoy en Madrid). Devuelve su id.
-- Es security definer porque la app no tiene permiso para insertar en las tablas: por eso
-- comprueba ella misma que el usuario es miembro del hogar.
create function public.create_task(
  target_household_id uuid,
  task_name text,
  task_frequency text,
  task_interval_days integer default null,
  task_biweekly_start_on date default null,
  part_names text[] default '{}',
  part_weights integer[] default '{}'
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

  select coalesce(max(position), 0) + 1 into next_position
  from public.tasks
  where household_id = target_household_id;

  -- Las reglas de la tabla (nombre, frecuencia, días del intervalo, primer finde)
  -- rechazan los datos que no valen.
  insert into public.tasks (household_id, name, position, frequency, interval_days, biweekly_start_on)
  values (
    target_household_id,
    btrim(task_name),
    next_position,
    task_frequency,
    task_interval_days,
    task_biweekly_start_on
  )
  returning id into new_task_id;

  insert into public.task_parts (household_id, task_id, name, position, weight)
  select target_household_id, new_task_id, btrim(part.name), part.position, part.weight
  from unnest(part_names, part_weights) with ordinality as part (name, weight, position);

  return new_task_id;
end;
$$;

-- Solo los usuarios con sesión pueden crear tareas (y la función comprueba el hogar).
revoke execute on function public.create_task(uuid, text, text, integer, date, text[], integer[])
  from public, anon;
grant execute on function public.create_task(uuid, text, text, integer, date, text[], integer[])
  to authenticated;

-- La función de los pesos solo la usa el trigger.
revoke execute on function public.check_task_part_weights() from public, anon, authenticated;
