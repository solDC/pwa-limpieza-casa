-- US-50 · Elegir desde qué día toca una tarea de cada N días
--
-- Al añadir una tarea de cada N días se puede elegir el día en que toca la primera vez (hoy
-- o un día futuro). Se guarda en tasks.next_due_on, la misma columna en la que la US-41
-- guarda el día elegido para la próxima vez: así, hasta ese día toca ese día, sin retraso, y
-- al terminar la vuelta se olvida (trigger de la US-41) y las siguientes se cuentan desde el
-- día en que se hizo.
--
-- create_task usa para este día el mismo argumento que la fecha de las puntuales
-- (task_due_on): en una puntual es su fecha (due_on); en una de cada N días, el día en que
-- toca la primera vez (next_due_on). La función se llama igual que antes, así que la versión
-- anterior de la app sigue funcionando.

-- Crea una tarea en un hogar del que el usuario es miembro, con sus partes (opcionales) y
-- el peso de cada una y, si se quiere, el día en que toca: la fecha de una puntual o la
-- primera vez de una de cada N días. Va al final de la lista. El día de creación lo pone la
-- base de datos (hoy en Madrid). Devuelve su id.
-- Es security definer porque la app no tiene permiso para insertar en las tablas: por eso
-- comprueba ella misma que el usuario es miembro del hogar.
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
