-- US-39 · Marcar una parte como hecha
--
-- Las partes hechas de cada vuelta. Al marcar una parte, la app guarda de qué vuelta es
-- (desde cuándo tocaba y hasta cuándo había plazo, como en task_rounds) y la base de datos
-- apunta el día (hoy en Madrid) y el peso que tiene la parte en ese momento: así, si más
-- adelante cambian los pesos (US-51), las vueltas pasadas conservan su porcentaje.
--
-- Cuando están hechas todas las partes de la tarea, la base de datos apunta sola la vuelta
-- como terminada en task_rounds, con el día de la última parte: el resto de la app (cuándo
-- vuelve a tocar, el retraso) funciona igual que al marcar la tarea entera (US-30).
--
-- Una vuelta que se queda a medias no guarda nada más: su estado («parcial, 50 %») se
-- calcula a partir de estas filas. Deshacer una parte llega con la US-44.

-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------

-- Para que una parte hecha solo pueda apuntar a una parte de su misma tarea.
alter table public.task_parts
  add constraint task_parts_id_task_id_key unique (id, task_id);

create table public.task_part_completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  task_id uuid not null,
  part_id uuid not null,
  -- La vuelta, como en task_rounds: desde cuándo tocaba (vacío en las puntuales) y hasta
  -- cuándo había plazo (vacío en las de «cada N días» y las puntuales).
  starts_on date,
  due_by date,
  -- El peso de la parte, en %, el día en que se hizo. Lo copia siempre la base de datos.
  weight integer not null
    check (weight between 1 and 100),
  -- Día (en Madrid) en que se hizo. Lo pone siempre la base de datos.
  completed_on date not null default (now() at time zone 'Europe/Madrid')::date,
  created_at timestamptz not null default now(),

  -- La tarea es del mismo hogar, y la parte es de esa tarea.
  constraint task_part_completions_task_fkey
    foreign key (task_id, household_id) references public.tasks (id, household_id) on delete cascade,
  constraint task_part_completions_part_fkey
    foreign key (part_id, task_id) references public.task_parts (id, task_id) on delete cascade,
  -- Como en task_rounds: si la vuelta tiene plazo (las de fin de semana), la parte se hace
  -- dentro de ella. Si el reloj del móvil va mal, se rechaza.
  constraint task_part_completions_completed_on_check
    check (due_by is null or (starts_on is not null and completed_on between starts_on and due_by)),
  -- Una parte se marca una sola vez en cada vuelta, aunque se pulse dos veces o desde dos móviles.
  constraint task_part_completions_part_id_starts_on_key unique nulls not distinct (part_id, starts_on)
);

comment on table public.task_part_completions is
  'Partes hechas de cada vuelta de una tarea: qué día se hicieron y cuánto pesaban.';

create index task_part_completions_household_id_idx on public.task_part_completions (household_id);
-- Las partes hechas de una tarea, de la más reciente a la más antigua, que es como las lee la app.
create index task_part_completions_task_id_created_at_idx
  on public.task_part_completions (task_id, created_at desc);

-- ---------------------------------------------------------------------------
-- El peso lo copia la base de datos, y las partes de una tarea se marcan de una en una
-- ---------------------------------------------------------------------------

-- Se ejecuta con los permisos de quien marca la parte, que ve las partes de su hogar. Una
-- parte de otro hogar no la ve: se queda sin peso y la fila se rechaza.
create function public.set_task_part_completion_weight()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Si dos móviles marcan a la vez las dos últimas partes de una tarea, ninguno vería la
  -- parte del otro (aún sin confirmar) y la vuelta se quedaría sin terminar, con todas las
  -- partes hechas. Con este cerrojo, por tarea y hasta el final de la transacción, el
  -- segundo espera al primero y ya ve su parte.
  perform pg_advisory_xact_lock(hashtextextended(new.task_id::text, 0));
  new.weight := (select p.weight from public.task_parts p where p.id = new.part_id);
  return new;
end;
$$;

revoke execute on function public.set_task_part_completion_weight() from public, anon, authenticated;

create trigger set_task_part_completion_weight
  before insert on public.task_part_completions
  for each row execute function public.set_task_part_completion_weight();

-- ---------------------------------------------------------------------------
-- Con todas las partes hechas, la vuelta queda terminada
-- ---------------------------------------------------------------------------

-- Se ejecuta con los permisos de quien marca la parte: las reglas de task_rounds (RLS, una
-- vuelta por día, el día dentro del plazo) valen igual que al marcar la tarea entera.
create function public.complete_round_when_all_parts_done()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.task_parts p
    where p.task_id = new.task_id
      and not exists (
        select 1
        from public.task_part_completions c
        where c.part_id = p.id and c.starts_on is not distinct from new.starts_on
      )
  ) then
    -- Al marcar varias partes de una vez, la vuelta se apunta con la primera y las demás
    -- no hacen nada. Si ya hay otra vuelta de hoy (task_rounds_task_id_completed_on_key),
    -- sí falla, y no se guarda ninguna parte.
    insert into public.task_rounds (household_id, task_id, starts_on, due_by)
    values (new.household_id, new.task_id, new.starts_on, new.due_by)
    on conflict on constraint task_rounds_task_id_starts_on_key do nothing;
  end if;
  return null;
end;
$$;

revoke execute on function public.complete_round_when_all_parts_done() from public, anon, authenticated;

create trigger complete_round_when_all_parts_done
  after insert on public.task_part_completions
  for each row execute function public.complete_round_when_all_parts_done();

-- ---------------------------------------------------------------------------
-- Seguridad (Row Level Security)
-- ---------------------------------------------------------------------------

alter table public.task_part_completions enable row level security;

create policy "Los miembros ven las partes hechas de las tareas de su hogar"
  on public.task_part_completions for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "Los miembros apuntan partes hechas en las tareas de su hogar"
  on public.task_part_completions for insert
  to authenticated
  with check (public.is_household_member(household_id));

-- Permisos por rol (defensa en profundidad):
-- - anon (sin sesión) no puede tocar esta tabla.
-- - authenticated puede leer y apuntar partes hechas, pero no elige el día (completed_on)
--   ni el peso (weight), que pone la base de datos. Cambiar o borrar llega con la US-44.
revoke all on public.task_part_completions from anon, authenticated;
grant select on public.task_part_completions to authenticated;
grant insert (household_id, task_id, part_id, starts_on, due_by)
  on public.task_part_completions to authenticated;
