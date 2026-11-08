-- US-30 · Marcar una tarea como hecha
--
-- Las vueltas terminadas de cada tarea. Al marcar una tarea como hecha, la app guarda
-- su vuelta (desde cuándo tocaba y hasta cuándo había plazo) y la base de datos apunta
-- el día en que se hizo: «hoy» en Madrid, aunque el reloj del móvil esté mal.
--
-- El estado de una vuelta (completada, parcial, no completada) no se guarda: se calcula
-- en src/domain/. Las vueltas que nadie marca no tienen fila.
-- Las partes hechas de cada vuelta llegan con la US-39, y deshacer (borrar una vuelta),
-- con la US-43, cada una con sus permisos.

-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------

create table public.task_rounds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  task_id uuid not null,
  -- Desde cuándo tocaba. Vacío en las puntuales, que no tienen fecha.
  starts_on date,
  -- Hasta cuándo había plazo. Vacío en las de «cada N días» y las puntuales, que no tienen.
  due_by date,
  -- Día (en Madrid) en que se hizo. Lo pone siempre la base de datos: la app no puede escribirlo.
  completed_on date not null default (now() at time zone 'Europe/Madrid')::date,
  created_at timestamptz not null default now(),

  -- La vuelta solo puede apuntar a una tarea de su mismo hogar.
  constraint task_rounds_task_fkey
    foreign key (task_id, household_id) references public.tasks (id, household_id) on delete cascade,
  -- Si la vuelta tiene plazo (las de fin de semana), se tiene que hacer dentro de ella.
  -- La vuelta la calcula el móvil con su reloj, y el día lo pone la base de datos: si el
  -- reloj del móvil va mal (o se marca justo al cambiar de día), se rechaza en lugar de
  -- apuntar como hecha una vuelta que no es la de hoy.
  constraint task_rounds_completed_on_check
    check (due_by is null or (starts_on is not null and completed_on between starts_on and due_by)),
  -- Cada vuelta se guarda una sola vez, aunque se pulse dos veces «Hecha» (o desde dos móviles).
  -- Dos puntuales sin fecha cuentan como la misma vuelta: una puntual solo se hace una vez.
  constraint task_rounds_task_id_starts_on_key unique nulls not distinct (task_id, starts_on),
  -- Y una tarea no se hace dos veces el mismo día: en las de «cada N días», una segunda vez
  -- guardaría la vuelta siguiente sin cambiar el día de la última, y la tarea se bloquearía.
  constraint task_rounds_task_id_completed_on_key unique (task_id, completed_on)
);

comment on table public.task_rounds is 'Vueltas terminadas de cada tarea: cuándo tocaba y qué día se hizo.';

create index task_rounds_household_id_idx on public.task_rounds (household_id);
-- La última vuelta terminada de cada tarea, que lee la app, usa el índice de
-- task_rounds_task_id_completed_on_key.

-- ---------------------------------------------------------------------------
-- Seguridad (Row Level Security)
-- ---------------------------------------------------------------------------

alter table public.task_rounds enable row level security;

create policy "Los miembros ven las vueltas de las tareas de su hogar"
  on public.task_rounds for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "Los miembros apuntan vueltas en las tareas de su hogar"
  on public.task_rounds for insert
  to authenticated
  with check (public.is_household_member(household_id));

-- Permisos por rol (defensa en profundidad):
-- - anon (sin sesión) no puede tocar esta tabla.
-- - authenticated puede leer y apuntar vueltas, pero no el día en que se hizo (completed_on),
--   que pone la base de datos. Cambiar o borrar vueltas llega con sus historias (US-39, US-43).
revoke all on public.task_rounds from anon, authenticated;
grant select on public.task_rounds to authenticated;
grant insert (household_id, task_id, starts_on, due_by) on public.task_rounds to authenticated;
