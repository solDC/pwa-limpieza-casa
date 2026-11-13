-- US-52 · La app en inglés y en castellano
--
-- Las tareas por defecto (US-27) y sus partes se guardan con su nombre en castellano.
-- Para que la app pueda mostrarlas en el idioma elegido, llevan una clave (default_key):
-- «surfaces», «bathroom»… La app tiene el nombre en inglés de cada clave
-- (src/domain/task.ts); en castellano usa el nombre guardado.
-- Las tareas que añade el usuario (create_task, US-33) no llevan clave: se ven como las
-- escribió, en cualquier idioma.
--
-- No cambian los permisos: las dos tablas ya se pueden leer enteras (con RLS por hogar),
-- y la app sigue sin poder insertar ni cambiar filas directamente.

alter table public.tasks
  add column default_key text
    check (default_key is null or default_key ~ '^[a-z_]{1,40}$');

alter table public.task_parts
  add column default_key text
    check (default_key is null or default_key ~ '^[a-z_]{1,40}$');

comment on column public.tasks.default_key is
  'Si es una tarea por defecto, cuál: para mostrarla en el idioma elegido (US-52).';
comment on column public.task_parts.default_key is
  'Si es una parte de una tarea por defecto, cuál: para mostrarla en el idioma elegido (US-52).';

-- ---------------------------------------------------------------------------
-- Tareas por defecto: ahora con su clave
-- ---------------------------------------------------------------------------

-- Sustituye la función de la migración de tareas (US-27), sin editar esa migración.
create or replace function public.create_default_tasks(target_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  surfaces_id uuid;
begin
  insert into public.tasks (household_id, name, position, frequency, default_key)
  values (target_household_id, 'Superficies', 1, 'weekend_weekly', 'surfaces')
  returning id into surfaces_id;

  insert into public.task_parts (household_id, task_id, name, position, weight, default_key)
  values
    (target_household_id, surfaces_id, 'Cocina', 1, 50, 'kitchen'),
    (target_household_id, surfaces_id, 'Salón', 2, 25, 'living_room'),
    (target_household_id, surfaces_id, 'Dormitorio', 3, 25, 'bedroom');

  insert into public.tasks
    (household_id, name, position, frequency, interval_days, biweekly_start_on, default_key)
  values
    (target_household_id, 'Baño', 2, 'interval', 3, null, 'bathroom'),
    (target_household_id, 'Aspirar cosas de Cati', 3, 'weekend_biweekly', null, date '2026-12-05', 'vacuum_cati'),
    (target_household_id, 'Cristales y espejos', 4, 'interval', 30, null, 'windows_mirrors'),
    (target_household_id, 'Cepillar suelo', 5, 'one_off', null, null, 'scrub_floor'),
    (target_household_id, 'Limpiar juntas', 6, 'one_off', null, null, 'clean_grout');
end;
$$;

revoke execute on function public.create_default_tasks(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Las tareas por defecto que ya existían
-- ---------------------------------------------------------------------------

-- Pone la clave a las tareas por defecto creadas antes de esta migración. Se reconocen por
-- su nombre y su posición (de la 1 a la 6): las que añade el usuario van siempre detrás
-- (create_task las pone al final), así que una suya que se llame igual no se toca.
-- Devuelve cuántas tareas ha marcado.
create function public.set_default_task_keys()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  update public.tasks t
  set default_key = d.default_key
  from (values
    ('Superficies', 1, 'surfaces'),
    ('Baño', 2, 'bathroom'),
    ('Aspirar cosas de Cati', 3, 'vacuum_cati'),
    ('Cristales y espejos', 4, 'windows_mirrors'),
    ('Cepillar suelo', 5, 'scrub_floor'),
    ('Limpiar juntas', 6, 'clean_grout')
  ) as d (name, position, default_key)
  where t.default_key is null and t.name = d.name and t.position = d.position;
  get diagnostics total = row_count;

  update public.task_parts p
  set default_key = d.default_key
  from public.tasks t, (values
    ('Cocina', 'kitchen'),
    ('Salón', 'living_room'),
    ('Dormitorio', 'bedroom')
  ) as d (name, default_key)
  where p.task_id = t.id and t.default_key = 'surfaces'
    and p.default_key is null and p.name = d.name;

  return total;
end;
$$;

revoke execute on function public.set_default_task_keys() from public, anon, authenticated;

select public.set_default_task_keys();
