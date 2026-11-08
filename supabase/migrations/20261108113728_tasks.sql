-- US-27 · Mis tareas por defecto
--
-- Las tareas del hogar y sus partes. Al crearse un hogar, la base de datos le crea
-- las tareas que usa Sol, y los hogares que ya existían las reciben una vez.
-- Por ahora la app solo puede LEER tareas: crearlas, marcarlas y cancelarlas llega
-- con las US-30, US-32 y US-33, cada una con sus permisos.
-- Las vueltas (task_rounds) llegan con la US-30, que es la primera que las necesita.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null
    check (char_length(btrim(name)) between 1 and 80),
  -- Orden en que se muestran.
  position integer not null default 0,
  frequency text not null
    check (frequency in ('weekend_weekly', 'weekend_biweekly', 'interval', 'one_off')),
  -- Solo en «cada N días desde la última vez».
  interval_days integer,
  -- Solo en «fin de semana cada 15 días»: el sábado del primer fin de semana que toca.
  biweekly_start_on date,
  -- Día (en Madrid) en que se creó: la primera vez, una tarea de «cada N días» toca desde ese día.
  created_on date not null default (now() at time zone 'Europe/Madrid')::date,
  -- Las canceladas no se borran, para conservar su histórico (US-32).
  cancelled_on date,
  created_at timestamptz not null default now(),

  constraint tasks_interval_days_check
    check ((frequency = 'interval') = (interval_days is not null) and coalesce(interval_days, 1) > 0),
  constraint tasks_biweekly_start_on_check
    check ((frequency = 'weekend_biweekly') = (biweekly_start_on is not null)),
  constraint tasks_cancelled_on_check
    check (cancelled_on is null or cancelled_on >= created_on),
  -- Para que las partes solo puedan apuntar a una tarea de su mismo hogar.
  constraint tasks_id_household_id_key unique (id, household_id)
);

comment on table public.tasks is 'Tareas del hogar: algo que hay que mantener (una acción o un lugar).';

create index tasks_household_id_position_idx on public.tasks (household_id, position);

create table public.task_parts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  task_id uuid not null,
  name text not null
    check (char_length(btrim(name)) between 1 and 80),
  position integer not null default 0,
  -- Cuánto cuenta la parte en el progreso de la tarea, en %. Los de una tarea suman 100:
  -- hoy solo la base de datos crea partes; la regla llegará cuando las cree la app (US-33/34).
  weight integer not null
    check (weight between 1 and 100),
  created_at timestamptz not null default now(),

  constraint task_parts_task_fkey
    foreign key (task_id, household_id) references public.tasks (id, household_id) on delete cascade
);

comment on table public.task_parts is 'Partes de una tarea (lugares o acciones), cada una con su peso en %.';

create index task_parts_household_id_idx on public.task_parts (household_id);
create index task_parts_task_id_position_idx on public.task_parts (task_id, position);

-- ---------------------------------------------------------------------------
-- Seguridad (Row Level Security)
-- ---------------------------------------------------------------------------

alter table public.tasks enable row level security;
alter table public.task_parts enable row level security;

create policy "Los miembros ven las tareas de su hogar"
  on public.tasks for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "Los miembros ven las partes de las tareas de su hogar"
  on public.task_parts for select
  to authenticated
  using (public.is_household_member(household_id));

-- Permisos por rol (defensa en profundidad):
-- - anon (sin sesión) no puede tocar estas tablas.
-- - authenticated solo puede leer. Crear, cambiar y cancelar llegan con sus historias.
revoke all on public.tasks, public.task_parts from anon, authenticated;
grant select on public.tasks, public.task_parts to authenticated;

-- ---------------------------------------------------------------------------
-- Tareas por defecto
-- ---------------------------------------------------------------------------

-- Crea en un hogar las tareas que usa Sol (tabla de la US-27 en docs/user-stories.md).
create function public.create_default_tasks(target_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  surfaces_id uuid;
begin
  insert into public.tasks (household_id, name, position, frequency)
  values (target_household_id, 'Superficies', 1, 'weekend_weekly')
  returning id into surfaces_id;

  insert into public.task_parts (household_id, task_id, name, position, weight)
  values
    (target_household_id, surfaces_id, 'Cocina', 1, 50),
    (target_household_id, surfaces_id, 'Salón', 2, 25),
    (target_household_id, surfaces_id, 'Dormitorio', 3, 25);

  insert into public.tasks (household_id, name, position, frequency, interval_days, biweekly_start_on)
  values
    (target_household_id, 'Baño', 2, 'interval', 3, null),
    (target_household_id, 'Aspirar cosas de Cati', 3, 'weekend_biweekly', null, date '2026-12-05'),
    (target_household_id, 'Cristales y espejos', 4, 'interval', 30, null),
    (target_household_id, 'Cepillar suelo', 5, 'one_off', null, null),
    (target_household_id, 'Limpiar juntas', 6, 'one_off', null, null);
end;
$$;

revoke execute on function public.create_default_tasks(uuid) from public, anon, authenticated;

-- Los hogares que no tienen ninguna tarea (ni activa ni cancelada) reciben las de por defecto.
-- Así, si se cancela una, el hogar ya no está «sin tareas» y no vuelve a recibirlas.
-- Devuelve cuántos hogares las han recibido.
create function public.create_default_tasks_for_existing_households()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  total integer := 0;
begin
  for target in
    select h.id
    from public.households h
    where not exists (select 1 from public.tasks t where t.household_id = h.id)
  loop
    perform public.create_default_tasks(target.id);
    total := total + 1;
  end loop;
  return total;
end;
$$;

revoke execute on function public.create_default_tasks_for_existing_households() from public, anon, authenticated;

-- El alta de un usuario crea su hogar (US-02) y, ahora, también sus tareas.
-- Se sustituye la función de la migración de hogares, sin editar esa migración.
create or replace function public.create_household_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  insert into public.households default values
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  perform public.create_default_tasks(new_household_id);

  return new;
end;
$$;

-- Hogares que ya existían antes de esta migración (como el de Sol): reciben sus tareas una vez.
select public.create_default_tasks_for_existing_households();
