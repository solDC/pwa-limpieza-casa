---
name: new-migration
description: Crea una migración de Supabase para este proyecto (tablas, columnas, políticas RLS, permisos, funciones o triggers) con las reglas de CLAUDE.md, la aplica en local y añade su prueba de integración. Úsala siempre que cambie la base de datos, cuando pidan «nueva tabla», «añadir columna», «migración», «política RLS» o «cambiar permisos», o cuando una historia necesite guardar datos nuevos.
---

# new-migration

Todo cambio en la base de datos es una migración en `supabase/migrations/`. Nunca se cambia nada a mano en el panel de Supabase. El modelo a seguir es `supabase/migrations/20261102113552_households.sql`: léelo antes de escribir.

## 1. Antes de escribir

1. **¿Corrige una migración que ya está en `main`?** Entonces no se edita: se crea otra nueva que la corrige. Compruébalo con:

   ```bash
   git fetch origin main && git ls-tree --name-only origin/main supabase/migrations/
   ```

   Una migración de la rama actual que aún no está en `main` sí se puede editar, si no se ha aplicado ya en la nube (pregúntaselo a Sol).
2. **Diseña con el modelo de datos de `CLAUDE.md`:**
   - **Todo cuelga del hogar**, no del usuario: cada tabla de datos lleva `household_id uuid not null references public.households (id) on delete cascade`. Las tablas hijas (como `task_parts`) también lo llevan, para que su regla RLS sea igual de simple que la del padre.
   - **Días como `date`** (`'YYYY-MM-DD'` en TypeScript), nunca `timestamptz`. Los momentos exactos (`created_at`) sí son `timestamptz not null default now()`.
   - Nombres de tablas y columnas en inglés y `snake_case`, tablas en plural.
   - Restricciones `check` para lo que nunca debe ser válido (textos vacíos o demasiado largos, valores de una lista), como en `households.name`.
3. **Compatible con la versión anterior.** La migración se aplica en la nube desde la rama del pull request, **antes de fusionar**, y producción (`main`) sigue funcionando un tiempo contra el esquema nuevo. Por eso:
   - Añadir tablas, columnas con valor por defecto o que admiten `null`: bien.
   - Borrar o renombrar tablas o columnas, o hacer `not null` una columna existente: en dos pasos. Primero la app deja de usarla (un PR), después se quita (otro PR). Si no se puede, avísalo a Sol antes de seguir.

## 2. Crear el archivo

```bash
npx supabase migration new <nombre-en-ingles>
```

El nombre en inglés, `snake_case` y descriptivo (`tasks`, `add_task_notes`, `add_task_rounds`). Crea `supabase/migrations/<fecha>_<nombre>.sql`.

## 3. Contenido

Ordénalo en secciones con comentarios **en español**, como en `households.sql`:

1. **Cabecera:** historia (`-- US-04 · Crear una tarea`) y qué hace la migración y por qué.
2. **Tablas:** `create table public.<tabla>`, con `comment on table` en español. Índice en `household_id` (lo usan todas las reglas) y en las columnas por las que se filtre u ordene.
3. **RLS en la misma migración**, para cada tabla nueva:

   ```sql
   alter table public.<tabla> enable row level security;

   create policy "Los miembros ven las <cosas> de su hogar"
     on public.<tabla> for select
     to authenticated
     using (public.is_household_member(household_id));
   ```

   - Una política por operación que la app necesite (`select`, `insert`, `update`, `delete`), con nombre descriptivo en español.
   - `insert` lleva `with check (...)`; `update`, `using (...)` **y** `with check (...)`, para que no se pueda mover una fila a otro hogar.
   - Reutiliza `public.is_household_member(...)`; no repitas la consulta a `household_members`.
   - Ninguna política para `anon`.
4. **Permisos por rol** (defensa en profundidad), con un comentario que explique qué puede hacer cada rol:

   ```sql
   revoke all on public.<tabla> from anon, authenticated;
   grant select, insert, update, delete on public.<tabla> to authenticated;
   ```

   Concede solo lo que la app usa. Si solo se pueden cambiar algunas columnas, permisos por columna: `grant update (name) on ...`.
5. **Funciones** (si hacen falta):
   - `security definer` solo si es imprescindible, y entonces con `set search_path = ''` y nombres con esquema (`public.households`, `auth.users`).
   - Usa `(select auth.uid())`, no `auth.uid()` directamente.
   - `revoke execute ... from public, anon` y `grant execute` solo a quien la necesite.
6. **Datos existentes:** si la tabla o columna nueva necesita valores para las filas que ya hay en la nube, rellénalos en la misma migración (como el bloque `do $$` de `households.sql`).

## 4. Aplicar en local

Necesita Supabase local arrancado (`npx supabase start`).

```bash
npx supabase db reset
```

Aplica todas las migraciones desde cero (borra los datos locales). Si falla, corrige el SQL y repite. No uses el panel de Supabase Studio para probar cambios de esquema: lo que no esté en la migración no existe.

## 5. Pruebas

Usa la skill `write-tests` para la prueba de integración en `tests/integration/<tabla-o-grupo>.test.ts`. Como mínimo, con dos usuarios de hogares distintos: cada uno ve y modifica lo suyo; **no** lee, modifica, borra ni inserta en el hogar del otro; sin sesión no lee nada; y lo que no tiene permiso falla con `permission denied`.

```bash
npm run test:integration
```

El código que usa la tabla va en `src/storage/` (que traduce `snake_case` a `camelCase`), no en esta skill: es parte de `implement-story`.

## 6. Documentar

- **CHANGELOG** (mismo commit): en `### Added` o `### Changed`, qué tablas o columnas cambian, qué reglas de seguridad tienen y por qué.
- **Pull request:** avisa a Sol de que hay una migración nueva y de que debe aplicarla desde la rama del PR, antes de fusionar, con `npx supabase db push --linked` (README, «Puesta en producción»). Si no es compatible con la versión anterior, dilo en el aviso.
- Commit: `feat: …` si forma parte de una historia; `fix: …` si corrige una migración anterior.

## Nunca

- Editar una migración que ya está en `main`.
- Crear una tabla sin `enable row level security` y sin sus políticas, o desactivar RLS.
- Dar permisos a `anon` sobre datos de los hogares.
- Guardar días como `timestamptz`.
- Escribir claves, contraseñas o datos reales en la migración.

## Antes de terminar

- [ ] La migración es nueva (no edita una de `main`) y se ha creado con `npx supabase migration new`.
- [ ] Cada tabla nueva tiene `household_id`, RLS, una política por operación y sus `revoke`/`grant`.
- [ ] Las funciones `security definer` llevan `set search_path = ''` y nombres con esquema.
- [ ] Comentarios en español; nombres en inglés.
- [ ] Es compatible con la versión de `main`, o se ha avisado a Sol.
- [ ] `npx supabase db reset` funciona y `npm run test:integration` pasa con la prueba de aislamiento entre hogares.
- [ ] CHANGELOG actualizado y aviso de migración preparado para el pull request.
