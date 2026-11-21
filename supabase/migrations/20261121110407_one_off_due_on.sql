-- US-38 · Poner fecha a una tarea puntual
--
-- Una tarea puntual puede llevar una fecha, que no es obligatoria: si la tiene, toca ese
-- día y, si llega sin hacerse, va con retraso; sin fecha, sigue pendiente sin retraso.
-- Se pone al crearla (create_task) o después (set_task_due_on), y se puede cambiar o quitar.
-- Siempre hoy (en Madrid) o un día futuro.
--
-- La fecha no cambia la vuelta: la de una puntual sigue sin fecha (starts_on vacío en
-- task_rounds y task_part_completions), así que al cambiarla no se pierden las partes ya
-- hechas.
--
-- Compatible con la versión anterior de la app: la columna admite vacío, y create_task
-- acepta los mismos argumentos que antes (la fecha es opcional).

-- ---------------------------------------------------------------------------
-- Columna
-- ---------------------------------------------------------------------------

alter table public.tasks
  -- Solo en las puntuales: el día en que tocan (vacío, sin fecha).
  add column due_on date,
  add constraint tasks_due_on_check
    check (frequency = 'one_off' or due_on is null);

-- Que la fecha sea hoy o futura no puede ser un check de la tabla: «hoy» cambia, y una
-- fecha que ya ha pasado es justo la de una tarea retrasada. Lo comprueban las dos
-- funciones al guardarla.

-- Error de las dos funciones si la fecha ya ha pasado (por ejemplo, si el reloj del móvil
-- va mal o se guarda justo al cambiar de día). La app lo reconoce por el código 23514.
create function public.check_due_on_not_past(new_due_on date)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if new_due_on < (now() at time zone 'Europe/Madrid')::date then
    raise exception using
      errcode = '23514',
      message = 'La fecha de una tarea tiene que ser hoy o un día futuro.';
  end if;
end;
$$;

revoke execute on function public.check_due_on_not_past(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Crear una tarea, ahora también con fecha
-- ---------------------------------------------------------------------------

-- La misma create_task de la US-33, con un argumento más al final (task_due_on, opcional).
-- Se borra la anterior en lugar de añadir otra con el mismo nombre: con dos, una llamada
-- con los argumentos de antes no sabría cuál usar.
drop function public.create_task(uuid, text, text, integer, date, text[], integer[]);

-- Crea una tarea en un hogar del que el usuario es miembro, con sus partes (opcionales) y
-- el peso de cada una, y, si es puntual, su fecha (opcional). Va al final de la lista. El
-- día de creación lo pone la base de datos (hoy en Madrid). Devuelve su id.
-- Es security definer porque la app no tiene permiso para insertar en las tablas: por eso
-- comprueba ella misma que el usuario es miembro del hogar.
create function public.create_task(
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

  -- Las reglas de la tabla (nombre, frecuencia, días del intervalo, primer finde, fecha
  -- solo en las puntuales) rechazan los datos que no valen.
  insert into public.tasks (
    household_id, name, position, frequency, interval_days, biweekly_start_on, due_on
  )
  values (
    target_household_id,
    btrim(task_name),
    next_position,
    task_frequency,
    task_interval_days,
    task_biweekly_start_on,
    task_due_on
  )
  returning id into new_task_id;

  insert into public.task_parts (household_id, task_id, name, position, weight)
  select target_household_id, new_task_id, btrim(part.name), part.position, part.weight
  from unnest(part_names, part_weights) with ordinality as part (name, weight, position);

  return new_task_id;
end;
$$;

-- Solo los usuarios con sesión pueden crear tareas (y la función comprueba el hogar).
revoke execute on function public.create_task(uuid, text, text, integer, date, text[], integer[], date)
  from public, anon;
grant execute on function public.create_task(uuid, text, text, integer, date, text[], integer[], date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Poner, cambiar o quitar la fecha de una puntual
-- ---------------------------------------------------------------------------

-- Pone la fecha de una tarea puntual del hogar del usuario, o la quita (new_due_on vacío).
-- Es security definer porque la app no puede cambiar tasks directamente: así solo puede
-- tocar esta columna, en una puntual que sigue pendiente.
-- Errores:
-- - 42501: la tarea no existe o es de otro hogar (no se distingue, para no dar pistas).
-- - 22023: no es puntual o está cancelada.
-- - 23505: ya está hecha (por ejemplo, desde otro móvil): la app vuelve a cargar la lista.
-- - 23514: la fecha ya ha pasado.
create function public.set_task_due_on(target_task_id uuid, new_due_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.tasks;
begin
  -- Solo bloquea la fila (para que no se marque como hecha a la vez) si es del hogar del
  -- usuario: una tarea de otro hogar ni se bloquea.
  select * into target
  from public.tasks
  where id = target_task_id and public.is_household_member(household_id)
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'No existe esa tarea en tu hogar.';
  end if;

  if target.frequency <> 'one_off' or target.cancelled_on is not null then
    raise exception using errcode = '22023', message = 'Solo se puede poner fecha a una tarea puntual pendiente.';
  end if;

  if exists (select 1 from public.task_rounds r where r.task_id = target_task_id) then
    raise exception using errcode = '23505', message = 'La tarea ya está hecha.';
  end if;

  perform public.check_due_on_not_past(new_due_on);

  update public.tasks set due_on = new_due_on where id = target_task_id;
end;
$$;

revoke execute on function public.set_task_due_on(uuid, date) from public, anon;
grant execute on function public.set_task_due_on(uuid, date) to authenticated;
