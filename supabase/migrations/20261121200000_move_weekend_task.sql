-- US-42 · Mover una tarea de fin de semana a otro finde
--
-- Una tarea de fin de semana se puede mover a otro finde, el actual o uno posterior:
-- - En las semanales solo se mueve esa vuelta: hasta el finde elegido no toca (ni va con
--   retraso), y desde él vuelve a tocar cada finde. Se guarda como el sábado desde el que
--   toca (tasks.weekly_start_on, nueva), igual que el primer finde de las de cada 15 días.
-- - En las de cada 15 días se mueve todo el calendario: el finde elegido pasa a ser su primer
--   finde (tasks.biweekly_start_on).
-- La app lo hace con la función move_weekend_task.
--
-- Si la vuelta en curso tenía partes hechas, se quedan en esa vuelta: la vuelta movida es
-- otra (empieza otro sábado) y empieza con todas por hacer, como al cambiar la frecuencia
-- (US-53).
--
-- Compatible con la versión anterior de la app: la columna admite vacío y nadie la usa.

-- ---------------------------------------------------------------------------
-- Columna
-- ---------------------------------------------------------------------------

alter table public.tasks
  -- Solo en las semanales: el sábado desde el que tocan (vacío, desde que se crearon).
  add column weekly_start_on date,
  add constraint tasks_weekly_start_on_check
    check (frequency = 'weekend_weekly' or weekly_start_on is null),
  add constraint tasks_weekly_start_on_saturday_check
    check (weekly_start_on is null or extract(isodow from weekly_start_on) = 6);

-- ---------------------------------------------------------------------------
-- Mover a otro finde
-- ---------------------------------------------------------------------------

-- Mueve una tarea de fin de semana del hogar del usuario al finde que empieza el sábado
-- new_saturday: el actual (hoy en Madrid, si es sábado o domingo) o uno posterior.
-- Es security definer porque la app no puede cambiar tasks directamente: así solo puede
-- tocar estas dos columnas, en una tarea de fin de semana que no está cancelada.
-- Errores:
-- - 42501: la tarea no existe o es de otro hogar (no se distingue, para no dar pistas).
-- - 22023: no es de fin de semana, está cancelada o el día no es un sábado.
-- - 23514: el finde ya ha pasado.
create function public.move_weekend_task(target_task_id uuid, new_saturday date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.tasks;
begin
  -- Solo bloquea la fila si es del hogar del usuario: una tarea de otro hogar ni se bloquea.
  select * into target
  from public.tasks
  where id = target_task_id and public.is_household_member(household_id)
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'No existe esa tarea en tu hogar.';
  end if;

  if target.frequency not in ('weekend_weekly', 'weekend_biweekly') or target.cancelled_on is not null then
    raise exception using errcode = '22023', message = 'Solo se puede mover una tarea de fin de semana.';
  end if;

  if new_saturday is null or extract(isodow from new_saturday) <> 6 then
    raise exception using errcode = '22023', message = 'El finde empieza en sábado.';
  end if;

  -- El de ayer vale si hoy es domingo: es el finde actual. Entre semana, el sábado de
  -- ayer o antes ya ha pasado.
  if new_saturday < (now() at time zone 'Europe/Madrid')::date - 1 then
    raise exception using
      errcode = '23514',
      message = 'Elige el finde actual o uno posterior.';
  end if;

  if target.frequency = 'weekend_weekly' then
    update public.tasks set weekly_start_on = new_saturday where id = target_task_id;
  else
    update public.tasks set biweekly_start_on = new_saturday where id = target_task_id;
  end if;
end;
$$;

revoke execute on function public.move_weekend_task(uuid, date) from public, anon;
grant execute on function public.move_weekend_task(uuid, date) to authenticated;
