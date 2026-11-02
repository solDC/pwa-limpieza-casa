# CLAUDE.md

Contexto para la IA que trabaja en este repositorio. Léelo antes de cambiar nada.

## Qué es

PWA para organizar las tareas de mantenimiento del hogar: qué toca hoy, qué se ha retrasado y cuánto llevas de cada tarea. El detalle del producto y del modelo de tareas está en el `README.md`; el alcance del MVP, en `docs/user-stories.md` (historias con prioridad Must/Should).

**Estado:** MVP en desarrollo. Hechas US-01 (entrar con enlace mágico) y US-02 (hogar automático). La pantalla de Inicio es provisional.

## Arquitectura

- **Frontend:** React 19 + TypeScript (estricto) + Vite. Es una SPA: no hay servidor propio.
- **PWA:** vite-plugin-pwa. Es instalable, pero **necesita conexión**: no hay modo sin conexión en el MVP.
- **Datos y usuarios:** Supabase (PostgreSQL + Auth). La app habla directamente con Supabase desde el navegador.
- **Seguridad de los datos:** Row Level Security (RLS) en **todas** las tablas. Un usuario solo ve y modifica los datos de los hogares de los que es miembro. Una tabla sin RLS es un fallo de seguridad.
- **Inicio de sesión:** enlace mágico por email, sin contraseña.
- **Despliegue:** Vercel (compila con `npm run build` y publica `dist/`).
- **Desarrollo:** dev container (requisito de la clase), que construye el mismo `Dockerfile` que `docker-compose.yml`, con la misma versión de Node que Vercel. Supabase local con la CLI de Supabase.

### Carpetas

```
src/
├── domain/      Modelo de tareas, motor de frecuencias y progreso. TypeScript puro.
├── storage/     Acceso a Supabase. Única carpeta que importa @supabase/supabase-js.
├── demo/        Datos de ejemplo, separados de los datos reales.
├── features/    Una carpeta por pantalla: home, tasks, history (y auth).
└── ui/          Componentes visuales comunes.

tests/
├── unit/        Vitest. Lógica pura de src/domain/. Misma ruta que el código.
├── integration/ Vitest. Base de datos: tablas y reglas RLS, contra Supabase local.
└── e2e/         Playwright. La app en un navegador: criterios de aceptación de cada historia.
```

### Reglas de dependencias

- `domain/` **no importa** React, Supabase, `storage/`, `features/` ni APIs del navegador. Recibe datos y devuelve datos. Así se prueba de forma aislada.
- `features/` usa `domain/` para la lógica y `storage/` para leer y guardar. No llama a Supabase directamente.
- `storage/` traduce entre las filas de la base de datos (`snake_case`) y los tipos de `domain/` (`camelCase`).

### Modelo de datos

- `households`: el hogar. `household_members`: qué usuarios pertenecen a cada hogar. Hoy cada usuario tiene un único hogar, pero **todo cuelga del hogar, no del usuario**, para poder compartirlo en el futuro (está en el backlog).
- `tasks`, `task_parts`: las tareas y sus partes opcionales.
- `completions`: lo que se ha hecho. Guarda `performed_at` (cuándo se hizo), `created_at` (cuándo se apuntó) y quién lo hizo.
- Los días se guardan como **fecha local sin hora** (`date` en PostgreSQL, `'YYYY-MM-DD'` en TypeScript), nunca como `Date` con hora. «Hoy», «ayer» y «cada 30 días» son días, y así se evitan errores de zona horaria y cambio de hora.
- Llegar a la fecha prevista **nunca** marca una tarea como hecha.

### Base de datos

- **Todo cambio en la base de datos es una migración** en `supabase/migrations/` (`npx supabase migration new <nombre-en-ingles>`). Nunca se cambian tablas a mano en el panel de Supabase.
- **Una migración ya fusionada en `main` no se edita:** se corrige con otra nueva.
- Cada migración que crea tablas incluye su RLS, sus políticas y los permisos de cada rol (`anon`, `authenticated`) en el mismo archivo, con comentarios en español.
- Las funciones `security definer` llevan `set search_path = ''` y nombres de tabla con esquema (`public.households`).
- En local: `npx supabase db reset` aplica todas las migraciones desde cero. En la nube las aplica Sol con `npx supabase db push --remote` (ver README, «Puesta en producción»). Avísale en el pull request cuando haya una migración nueva.

## Convenciones

- **Nombres técnicos en inglés:** carpetas, archivos, variables, funciones, tipos, tablas, columnas y variables CSS. Carpetas y archivos que no son componentes, en `kebab-case` (`task-form`, `api-client`). Componentes React en `PascalCase.tsx`.
- **En español:** la documentación (README, CHANGELOG, este archivo), los comentarios y todos los textos que ve el usuario.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) con el tipo en inglés y la descripción en español: `feat: marcar una parte como hecha`, `fix: …`, `docs: …`, `refactor: …`, `chore: …`, `test: …`.

## Pruebas

El detalle está en `tests/README.md`. Lo esencial:

- **Una historia no está terminada sin pruebas automáticas** que cubran sus criterios de aceptación. Las historias están en `docs/user-stories.md` y cada una tiene su issue en GitHub (US-01 es el issue #2; US-n es el #n+1).
- **E2E:** un archivo por historia con su ID (`tests/e2e/us-01-sign-in.spec.ts`), una prueba por criterio de aceptación como mínimo, con el nombre en español.
- **Unitarias:** toda la lógica de `src/domain/` lleva pruebas, en la misma ruta (`src/domain/frequency.ts` → `tests/unit/domain/frequency.test.ts`). Las fechas, con casos límite: fin de mes, años bisiestos, cambio de hora.
- **Integración:** cada tabla nueva lleva una prueba de que un usuario **no** puede leer ni modificar los datos de otro hogar.
- **Fallos:** primero la prueba que reproduce el fallo, luego el arreglo.
- Las pruebas e2e se ejecutan contra la versión compilada (`npm run preview`, puerto 4173), no contra el servidor de desarrollo.
- La CI (`.github/workflows/ci.yml`) arranca Supabase en local y lo ejecuta todo en cada pull request. Un pull request en rojo no se fusiona.

### Prueba manual de aceptación

Además de las automáticas, Sol prueba cada historia a mano en el despliegue de prueba de Vercel del pull request (sobre todo en el móvil) antes de fusionarlo. Por eso **cada pull request de una historia incluye una sección «Cómo probarlo a mano»**, con pasos concretos y numerados, y qué debería verse en cada uno. Si encuentra un fallo, primero la prueba automática que lo reproduce y luego el arreglo.

## Comandos

El entorno de desarrollo es el **dev container** (`.devcontainer/`), que construye el mismo `Dockerfile` que `docker-compose.yml` (Node 22, la misma versión que Vercel). No usa Compose porque las versiones recientes rechazan el Dockerfile temporal que genera la extensión de VS Code. Dentro del dev container los comandos son los de `npm` directamente: `npm run dev`, `npm test`, `npm run build`, `npm install X`.

Desde fuera del contenedor, con Docker:

```
docker compose up --build              # arranca Vite en http://localhost:5173
docker compose exec app npm test       # pruebas unitarias y de integración (Vitest)
docker compose exec app npm run test:e2e  # pruebas en navegador (Playwright)
docker compose exec app npm run build  # comprobación de tipos + compilación
docker compose exec app npm install X  # añadir una dependencia
docker compose up --build -V           # tras cambiar dependencias
```

Sin Docker, los mismos scripts con `npm` directamente (`npm run dev`, `npm test`, `npm run build`).

Supabase en local (dentro del dev container, que trae Docker dentro):

```
npx supabase start          # arranca Supabase local (API 54321, Studio 54323, buzón de pruebas 54324)
npm run env:local           # crea .env con la URL y la clave del Supabase local
npm run test:integration    # pruebas de la base de datos (necesitan Supabase arrancado)
npx supabase db reset       # aplica las migraciones desde cero
npx supabase stop           # para Supabase
```

- La versión de Node se fija en tres sitios que deben coincidir: `Dockerfile` (`node:22-slim`), `package.json` (`engines`, que es lo que lee Vercel) y `.nvmrc`.
- `node_modules` del contenedor es independiente del de tu ordenador. No lo mezcles.
- El dev container y `docker compose up` usan el puerto 5173: no los arranques a la vez.
- Si cambias `docker-compose.yml` o el `Dockerfile`, comprueba que siguen funcionando las dos formas de arrancar.

- Playwright está fijado a una versión exacta en `package.json` porque su navegador va dentro de la imagen de Docker: si se actualiza, hay que reconstruir la imagen (o el dev container).

Antes de dar un cambio por terminado: `npm test`, `npm run build` y `npm run test:e2e` deben pasar.

## Secretos y variables de entorno

- **Nunca** escribas claves, contraseñas ni tokens en el código. Usa variables de entorno.
- `.env` nunca se sube a Git. `.env.example` sí, con valores de ejemplo, y se actualiza cada vez que se añade una variable.
- Todo lo que lleva el prefijo `VITE_` acaba en el navegador y es **público**. Solo pueden ir ahí la URL de Supabase y la clave `anon`.
- La clave `service_role` de Supabase **nunca** va en el frontend, ni en `.env` con `VITE_`, ni en Vercel con ese prefijo. Si alguna vez hace falta, será en una función de servidor.
- En producción, las variables se configuran en el panel de Vercel.

## CHANGELOG

Mantén `CHANGELOG.md` al día **en el mismo commit** que el cambio:

- Añade la entrada en `## [Unreleased]`, en la sección que corresponda al tipo de commit: `feat:` → Added, `fix:` → Fixed, `refactor:`/`chore:` → Changed, lo que se elimina → Removed.
- Explica **qué** cambió y **por qué**, pensando en quien lo lea dentro de unos meses. No copies el mensaje del commit.
- Las decisiones de arquitectura o de producto también van al changelog, aunque no cambien código.
- No hace falta entrada para cambios que no afectan a nadie (erratas, formato).

## Nunca

- Desactivar RLS o crear una tabla sin políticas.
- Subir `.env` o cualquier clave real.
- Hacer que `domain/` dependa de React, Supabase o el navegador.
- Saltarse o desactivar una prueba para que pase la compilación.
- Guardar fechas de días como timestamps con hora.
- Mezclar los datos de ejemplo con los datos reales del usuario.
