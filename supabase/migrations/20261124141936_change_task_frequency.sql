-- US-53 · Cambiar cada cuánto toca una tarea
--
-- La frecuencia de una tarea que ya existe se cambia con la función change_task_frequency:
-- a cualquiera de las cuatro, o solo el número de días de una de cada N días. La frecuencia
-- nueva empieza sin retraso, como una tarea nueva (US-48): cuenta desde el día del cambio
-- (tasks.frequency_changed_on, nueva), en lugar de desde el día en que se creó la tarea.
--
-- Para que el histórico (US-31) siga mostrando las vueltas de antes con la frecuencia que
-- tenían, cada frecuencia que deja de valer se guarda en task_frequency_periods, con los días
-- en que valió. El histórico calcula las vueltas no completadas de cada periodo con la suya.
--
-- Si la vuelta en curso estaba a medias, sus partes hechas no pasan a la vuelta nueva: la
-- vuelta nueva empieza después (el finde siguiente, o el día siguiente), así que es otra
-- vuelta (otro starts_on) y empieza con todas por hacer.
--
-- Compatible con la versión anterior de la app: la columna admite vacío y la tabla es nueva.

-- ---------------------------------------------------------------------------
-- Columna
-- ---------------------------------------------------------------------------

alter table public.tasks
  -- El día desde el que cuenta la frecuencia que tiene ahora: el del último cambio (vacío,
  -- desde que se creó la tarea, created_on).
  add column frequency_changed_on date,
  add constraint tasks_frequency_changed_on_check
    check (frequency_changed_on is null or frequency_changed_on >= created_on);

-- ---------------------------------------------------------------------------
-- Tabla de las frecuencias de antes
-- ---------------------------------------------------------------------------

create table public.task_frequency_periods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  task_id uuid not null,
  -- La frecuencia que tenía, con sus columnas, como en tasks.
  frequency text not null
    check (frequency in ('weekend_weekly', 'weekend_biweekly', 'interval', 'one_off')),
  interval_days integer,
  biweekly_start_on date,
  weekly_start_on date,
  -- Desde qué día contaba (su frequency_changed_on, o created_on) y el día en que se cambió:
  -- valió desde starts_on hasta el día antes de ends_on.
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),

  constraint task_frequency_periods_task_fkey
    foreign key (task_id, household_id) references public.tasks (id, household_id) on delete cascade,
  constraint task_frequency_periods_dates_check check (ends_on >= starts_on)
);

comment on table public.task_frequency_periods is
  'US-53 · Las frecuencias que ha tenido cada tarea antes de la actual, con los días en que valieron (para el histórico).';

create index task_frequency_periods_household_id_idx on public.task_frequency_periods (household_id);
create index task_frequency_periods_task_id_idx on public.task_frequency_periods (task_id);

-- Seguridad: los miembros del hogar ven las frecuencias de antes de sus tareas. Nadie las
-- escribe directamente: las guarda change_task_frequency.
alter table public.task_frequency_periods enable row level security;

create policy "Los miembros ven las frecuencias de antes de las tareas de su hogar"
  on public.task_frequency_periods for select
  to authenticated
  using (public.is_household_member(household_id));

-- La app solo puede leerlas; sin sesión, nada.
revoke all on public.task_frequency_periods from anon, authenticated;
grant select on public.task_frequency_periods to authenticated;

-- ---------------------------------------------------------------------------
-- Cambiar la frecuencia
-- ---------------------------------------------------------------------------

-- Cambia la frecuencia de una tarea no cancelada del hogar del usuario:
-- - task_frequency: 'weekend_weekly', 'weekend_biweekly', 'interval' o 'one_off'.
-- - task_interval_days: en las de cada N días, cuántos (de 1 a 365, lo comprueba la tabla).
-- - task_biweekly_start_on: en las de cada 15 días, el sábado del primer finde: el actual (hoy
--   en Madrid, si es sábado o domingo) o uno posterior.
-- - task_due_on: en las puntuales, su fecha, opcional (hoy o un día futuro, US-38).
-- Lo demás lo pone la función:
-- - Guarda la frecuencia de antes en task_frequency_periods.
-- - frequency_changed_on: hoy o, si la vuelta en curso estaba a medias, un día que hace que
--   la vuelta nueva empiece después de ella.
-- - En las de cada N días, si ya se ha hecho alguna vez y la próxima (la última vez más N
--   días) ya ha pasado, toca hoy (next_due_on); si nunca se ha hecho, toca desde
--   frequency_changed_on.
-- - Quita lo de la frecuencia de antes: el finde al que se movió (weekly_start_on, US-42), la
--   fecha de una puntual o el día elegido para la próxima vez (US-41).
-- Devuelve lo que ha puesto: { frequency_changed_on, next_due_on }.
-- Errores:
-- - 42501: la tarea no existe o es de otro hogar.
-- - 22023: está cancelada, la frecuencia no existe, falta lo que pide, el primer finde no es
--   sábado o la frecuencia es la misma que ya tiene.
-- - 23514: el primer finde o la fecha ya han pasado, o los días no valen (reglas de la tabla).
create function public.change_task_frequency(
  target_task_id uuid,
  task_frequency text,
  task_interval_days integer default null,
  task_biweekly_start_on date default null,
  task_due_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.tasks;
  today date := (now() at time zone 'Europe/Madrid')::date;
  since date := (now() at time zone 'Europe/Madrid')::date;
  half_done date;
  last_done date;
  next_due date;
begin
  -- El mismo cerrojo que al marcar una parte: mientras se cambia, nadie marca partes.
  perform pg_advisory_xact_lock(hashtextextended(target_task_id::text, 0));

  select * into target
  from public.tasks
  where id = target_task_id and public.is_household_member(household_id)
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'No existe esa tarea en tu hogar.';
  end if;

  if target.cancelled_on is not null then
    raise exception using errcode = '22023', message = 'No se puede cambiar una tarea cancelada.';
  end if;

  if task_frequency is null or task_frequency not in ('weekend_weekly', 'weekend_biweekly', 'interval', 'one_off') then
    raise exception using errcode = '22023', message = 'Esa frecuencia no existe.';
  end if;

  if (task_frequency = 'interval') <> (task_interval_days is not null)
    or (task_frequency = 'weekend_biweekly') <> (task_biweekly_start_on is not null)
    or (task_frequency <> 'one_off' and task_due_on is not null) then
    raise exception using errcode = '22023', message = 'Falta lo que pide la frecuencia, o sobra algo.';
  end if;

  if task_biweekly_start_on is not null then
    if extract(isodow from task_biweekly_start_on) <> 6 then
      raise exception using errcode = '22023', message = 'El finde empieza en sábado.';
    end if;
    -- El de ayer vale si hoy es domingo: es el finde actual.
    if task_biweekly_start_on < today - 1 then
      raise exception using errcode = '23514', message = 'Elige el finde actual o uno posterior.';
    end if;
  end if;

  perform public.check_due_on_not_past(task_due_on);

  if task_frequency = target.frequency
    and task_interval_days is not distinct from target.interval_days
    and task_biweekly_start_on is not distinct from target.biweekly_start_on then
    -- (La fecha de una puntual se cambia con set_task_due_on, US-38.)
    raise exception using errcode = '22023', message = 'La tarea ya tiene esa frecuencia.';
  end if;

  -- La vuelta en curso, si estaba a medias: partes hechas en una vuelta con fecha que no se
  -- ha terminado y cuyo plazo no ha acabado. La vuelta nueva empieza después de ella.
  select max(c.starts_on) into half_done
  from public.task_part_completions c
  where c.task_id = target_task_id
    and c.starts_on is not null
    and (c.due_by is null or c.due_by >= today)
    and not exists (
      select 1 from public.task_rounds r
      where r.task_id = c.task_id and r.starts_on = c.starts_on
    );

  if half_done is not null then
    if task_frequency in ('weekend_weekly', 'weekend_biweekly') then
      -- Dos días después de su sábado: el lunes, así que el primer finde es el siguiente.
      since := greatest(since, half_done + 2);
    elsif task_frequency = 'interval' then
      since := greatest(since, half_done + 1);
    end if;
  end if;

  -- En las de cada N días, si la próxima vez ya ha pasado, toca hoy.
  if task_frequency = 'interval' then
    select max(completed_on) into last_done from public.task_rounds where task_id = target_task_id;
    if last_done is not null and last_done + task_interval_days < today then
      next_due := today;
    end if;
  end if;

  insert into public.task_frequency_periods (
    household_id, task_id, frequency, interval_days, biweekly_start_on, weekly_start_on, starts_on, ends_on
  )
  values (
    target.household_id,
    target_task_id,
    target.frequency,
    target.interval_days,
    target.biweekly_start_on,
    target.weekly_start_on,
    coalesce(target.frequency_changed_on, target.created_on),
    greatest(today, coalesce(target.frequency_changed_on, target.created_on))
  );

  update public.tasks
  set frequency = task_frequency,
    interval_days = task_interval_days,
    biweekly_start_on = task_biweekly_start_on,
    weekly_start_on = null,
    due_on = task_due_on,
    next_due_on = next_due,
    frequency_changed_on = since
  where id = target_task_id;

  return jsonb_build_object('frequency_changed_on', since, 'next_due_on', next_due);
end;
$$;

-- Solo la app con sesión (comprueba ella misma que la tarea es del hogar del usuario).
revoke execute on function public.change_task_frequency(uuid, text, integer, date, date) from public, anon;
grant execute on function public.change_task_frequency(uuid, text, integer, date, date) to authenticated;
