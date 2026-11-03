---
name: db-migration
description: Crear o cambiar tablas, columnas, políticas RLS, funciones o triggers de Supabase con una migración nueva en supabase/migrations/, con su RLS, permisos por rol, comentarios en español y la prueba de integración que demuestra que otro hogar no puede leer ni modificar los datos. Úsala siempre que un cambio toque la base de datos (tasks, task_parts, completions, is_demo…), aunque sea una sola columna.
---

# Migración de la base de datos

Todo cambio en la base de datos es una migración. Nunca se toca el panel de Supabase ni se edita una migración que ya está en `main` (se corrige con otra nueva). Modelo de referencia: `supabase/migrations/20261102113552_households.sql`.

## 1. Crear el archivo

```
npx supabase migration new <nombre-en-ingles>
```

Nombre corto en inglés y en `kebab-case`: `tasks`, `task-parts`, `completions`, `add-is-demo-to-tasks`. Si la CLI no está disponible, crea a mano `supabase/migrations/<AAAAMMDDHHMMSS>_<nombre>.sql` con una marca de tiempo posterior a la última migración.

## 2. Contenido obligatorio

Usa esta estructura, con secciones separadas y **comentarios en español** que expliquen el porqué:

```sql
-- US-XX · <título de la historia>
--
-- Qué guarda la tabla y por qué cuelga del hogar.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

comment on table public.tasks is '…';

-- Índice por household_id: lo usan todas las reglas de seguridad.
create index tasks_household_id_idx on public.tasks (household_id);

-- ---------------------------------------------------------------------------
-- Seguridad (Row Level Security)
-- ---------------------------------------------------------------------------

alter table public.tasks enable row level security;

create policy "Los miembros ven las tareas de su hogar"
  on public.tasks for select
  to authenticated
  using (public.is_household_member(household_id));

-- … una política por operación que la app necesite (insert con «with check»,
-- update con «using» y «with check», delete con «using»).

-- Permisos por rol (defensa en profundidad).
revoke all on public.tasks from anon, authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
```

Reglas:
- **Todo cuelga del hogar** (`household_id`), no del usuario. Las tablas hijas (`task_parts`, `completions`) pueden comprobar el hogar a través de su padre, pero es más simple y rápido guardar también `household_id`.
- **RLS activado y políticas en el mismo archivo** que crea la tabla. Una tabla sin RLS es un fallo de seguridad.
- Usa `public.is_household_member(<columna>)` en las políticas; no repitas la consulta a `household_members`.
- `insert` y `update` llevan `with check`, para que nadie mueva una fila a otro hogar.
- `revoke all … from anon, authenticated` y después `grant` solo de lo necesario. `anon` no recibe nada. Si solo se puede cambiar alguna columna, `grant update (col1, col2)`.
- **Días como `date`**, nunca `timestamptz` (`performed_at date not null`). `created_at` sí es `timestamptz` porque es un instante.
- En `completions`, `performed_at` no puede ser futuro: añade `check` o valídalo en la app, y pruébalo.
- Quién lo hizo: `user_id uuid not null references auth.users (id) default auth.uid()`; la política de insert comprueba `user_id = (select auth.uid())`.
- Funciones `security definer`: `set search_path = ''`, nombres con esquema (`public.tasks`), y `revoke execute … from public, anon` + `grant` solo a quien la necesite.
- Usa `(select auth.uid())` dentro de políticas, no `auth.uid()` a secas (se evalúa una sola vez).
- Nombres de políticas: frase en español entre comillas que diga quién puede hacer qué.
- Si cambias una tabla con datos existentes, piensa en las filas que ya hay (valor por defecto o `do $$ … $$`, como hace la migración de hogares).

## 3. Aplicar en local

```
npx supabase db reset
```

Si falla, corrige la migración nueva (todavía no está en `main`) y repite.

## 4. Prueba de integración

Crea `tests/integration/<tabla-o-grupo>.test.ts` siguiendo `tests/integration/households.test.ts`:
- `connect()`, `createUser()`, `deleteUsers()` y `asUser()` de `tests/integration/helpers/database.ts`. `asUser` hace `rollback` al terminar.
- Dos usuarios (`ana`, `bruno`), cada uno con su hogar.
- Para cada tabla nueva, como mínimo:
  - el usuario ve y modifica sus propias filas;
  - **no ve** las filas del otro hogar (la consulta devuelve `[]`);
  - **no puede modificar ni borrar** las del otro (`rowCount` es 0);
  - **no puede insertar** con el `household_id` del otro (rechazado: `/row-level security/` o `/permission denied/`);
  - no puede mover una fila suya al hogar del otro con `update`;
  - sin sesión (`asUser(db, null, …)`) no puede leer nada (`/permission denied/`).
- Si hay `check` (nombre vacío, fecha futura), una prueba por cada uno.
- `describe` e `it` en español, con el ID de la historia.

```
npm run test:integration
```

## 5. Después

- `src/storage/`: tipos en `camelCase` y traducción desde las columnas `snake_case`.
- `CLAUDE.md` → «Modelo de datos», si aparece una tabla o columna nueva.
- `CHANGELOG.md`: qué tabla, qué protege la RLS y por qué el diseño.
- En el pull request, **avisa a Sol de que hay una migración nueva** para que la aplique con `npx supabase db push --linked` desde la rama antes de fusionar (la skill `open-pr` lo incluye).
