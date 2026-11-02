-- US-02 · Hogar creado automáticamente
--
-- Hogares y quién pertenece a cada uno. Todo lo demás (tareas, historial) colgará
-- del hogar y no del usuario, para poder compartir un hogar con otras personas
-- en el futuro (está en el backlog). Hoy cada usuario tiene un único hogar,
-- que se crea solo cuando se registra.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mi casa'
    check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

comment on table public.households is 'Hogar: agrupa las tareas y su historial.';

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

comment on table public.household_members is 'Qué usuarios pertenecen a cada hogar.';

-- Para buscar rápido los hogares de un usuario (lo hacen todas las reglas de seguridad).
create index household_members_user_id_idx on public.household_members (user_id);

-- ---------------------------------------------------------------------------
-- Seguridad (Row Level Security)
-- ---------------------------------------------------------------------------

-- ¿El usuario que hace la petición pertenece a este hogar?
-- Es "security definer" para poder leer household_members sin pasar por sus propias
-- reglas: si no, la regla de household_members se llamaría a sí misma sin fin.
create function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create policy "Los miembros ven su hogar"
  on public.households for select
  to authenticated
  using (public.is_household_member(id));

create policy "Los miembros pueden cambiar el nombre de su hogar"
  on public.households for update
  to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

create policy "Los miembros ven quién pertenece a su hogar"
  on public.household_members for select
  to authenticated
  using (public.is_household_member(household_id));

-- Además de las reglas, se limitan los permisos de cada rol (defensa en profundidad):
-- - anon (sin sesión) no puede tocar estas tablas.
-- - authenticated solo puede leer, y cambiar el nombre del hogar.
-- Los hogares y las pertenencias solo los crea la función de abajo, nunca la app.
revoke all on public.households, public.household_members from anon, authenticated;
grant select on public.households, public.household_members to authenticated;
grant update (name) on public.households to authenticated;

-- ---------------------------------------------------------------------------
-- Hogar automático al registrarse
-- ---------------------------------------------------------------------------

create function public.create_household_for_new_user()
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

  return new;
end;
$$;

revoke execute on function public.create_household_for_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_household_for_new_user();

-- Usuarios que ya existían antes de esta migración (por ejemplo, cuentas de prueba
-- en Supabase): se les crea su hogar igual que a los nuevos.
do $$
declare
  existing_user record;
  new_household_id uuid;
begin
  for existing_user in
    select u.id
    from auth.users u
    where not exists (
      select 1 from public.household_members m where m.user_id = u.id
    )
  loop
    insert into public.households default values
    returning id into new_household_id;

    insert into public.household_members (household_id, user_id, role)
    values (new_household_id, existing_user.id, 'owner');
  end loop;
end;
$$;
