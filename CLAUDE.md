# CLAUDE.md

Contexto para la IA que trabaja en este repositorio. Léelo antes de cambiar nada.

## Qué es

PWA para organizar las tareas de mantenimiento del hogar: qué toca hoy, qué se ha retrasado y cuánto llevas de cada tarea. El detalle del producto y del modelo de tareas está en el `README.md`; el alcance del MVP, en `docs/user-stories.md` (historias con prioridad Must have / Nice to have).

**Estado:** MVP en desarrollo. Hechas US-01 (entrar con enlace mágico), US-02 (hogar automático), US-03 (cerrar sesión), US-26 (entrar con código desde la app instalada), US-27 (mis tareas por defecto), US-28 (frecuencias), US-29 (qué toca) y US-30 (marcar una tarea como hecha). La pantalla de Inicio es provisional.

**Nombre de la app:** «Limpieza de casa» (`short_name`: «Limpieza»).

## Arquitectura

- **Frontend:** React 19 + TypeScript (estricto) + Vite. Es una SPA: no hay servidor propio.
- **PWA:** vite-plugin-pwa. Es instalable, pero **necesita conexión**: no hay modo sin conexión en el MVP.
- **Datos y usuarios:** Supabase (PostgreSQL + Auth). La app habla directamente con Supabase desde el navegador.
- **Seguridad de los datos:** Row Level Security (RLS) en **todas** las tablas. Un usuario solo ve y modifica los datos de los hogares de los que es miembro. Una tabla sin RLS es un fallo de seguridad.
- **Inicio de sesión:** por email, sin contraseña. El email trae un código (también en el asunto) y un enlace: el código sirve en cualquier dispositivo, también en la app instalada del iPhone (iOS abre el enlace en Safari, que no comparte la sesión con la app); el enlace es un atajo para entrar desde el dispositivo donde se pulsa. La plantilla del email está en `supabase/templates/sign-in.html` y en la nube hay que copiarla a mano (ver README).
- **Despliegue:** Vercel (compila con `npm run build` y publica `dist/`).
- **Desarrollo:** dev container (requisito de la clase), que construye el mismo `Dockerfile` que `docker-compose.yml`, con la misma versión de Node que Vercel. Supabase local con la CLI de Supabase.

### Carpetas

```
src/
├── domain/      Modelo de tareas, motor de frecuencias y progreso. TypeScript puro.
├── storage/     Acceso a Supabase. Única carpeta que importa @supabase/supabase-js.
├── features/    Una carpeta por pantalla: home, tasks, history, auth. Cada una con sus
│                componentes propios (SignInScreen.tsx…) y sus hooks (use-session.ts…).
└── components/  Componentes visuales comunes a varias pantallas (botones, tarjetas, avisos).

tests/
├── unit/        Vitest. Lógica pura de src/domain/. Misma ruta que el código.
├── integration/ Vitest. Base de datos: tablas y reglas RLS, contra Supabase local.
└── e2e/         Playwright. La app en un navegador: criterios de aceptación de cada historia.
```

### Reglas de dependencias

- `domain/` **no importa** React, Supabase, `storage/`, `features/` ni APIs del navegador. Recibe datos y devuelve datos. Así se prueba de forma aislada.
- `features/` usa `domain/` para la lógica, `storage/` para leer y guardar y `components/` para las piezas visuales comunes. No llama a Supabase directamente.
- Un componente va en `components/` cuando lo usan **dos o más pantallas**; si solo lo usa una, se queda en su carpeta de `features/`.
- `storage/` traduce entre las filas de la base de datos (`snake_case`) y los tipos de `domain/` (`camelCase`).

### Modelo de datos

Los conceptos (tarea, partes, vuelta, frecuencias) están en «Conceptos» de `docs/user-stories.md`.

- `households`: el hogar. `household_members`: qué usuarios pertenecen a cada hogar. Hoy cada usuario tiene un único hogar, pero **todo cuelga del hogar, no del usuario**, para poder compartirlo en el futuro (ver «Visión» en `docs/user-stories.md`).
- `tasks`: las tareas del hogar, con su tipo de frecuencia (`weekend_weekly`, `weekend_biweekly`, `interval`, `one_off`), los días del intervalo y la fecha de inicio de las de cada 15 días. Las **canceladas** se marcan con su fecha (`cancelled_on`), **no se borran**, para conservar el histórico.
- `task_parts`: las partes, cada una con su **peso** en %; los de una tarea suman 100.
- `task_rounds`: las **vueltas** terminadas. Cada una tiene cuándo empieza (vacío en las puntuales), cuándo se acaba el plazo (vacío en las de «cada N días» y las puntuales) y el día en que se completó, que pone siempre la base de datos. Las vueltas que nadie marca no tienen fila. Las partes hechas en cada vuelta (US-39) se guardarán con el día en que se hicieron.
- **El estado de una vuelta** (completada, parcial con su %, no completada) **se calcula en `src/domain/`**, no se guarda: así el cierre de la vuelta (el sábado, para las de fin de semana) no necesita ningún proceso automático.
- Las tareas por defecto (US-27) las crea la base de datos al crear el hogar, como el hogar mismo.
- `tasks` y `task_parts` existen desde la migración `…_tasks.sql` (US-27), y `task_rounds` desde `…_task_rounds.sql` (US-30).
- **«Hoy» es el día de Madrid**, en la base de datos (`(now() at time zone 'Europe/Madrid')::date`) y en la app (`useToday()` de `src/features/home/use-today.ts`, que se actualiza al volver a la app), aunque el dispositivo esté en otra zona horaria. La app es para la casa de Sol; si algún día hay usuarios en otras zonas, se revisa.
- **El usuario nunca ve horas.** Si alguna vez se muestra una (por ejemplo, de `created_at`), se convierte a la hora de Madrid.
- **El motor de frecuencias** está en `src/domain/frequency.ts`: `currentRound()` da la vuelta actual o la siguiente de una tarea (desde cuándo toca y hasta cuándo hay plazo), `dueStatus()` si va retrasada (y cuántos días), toca hoy o más adelante, y `describeDue()` el texto de «Toca: …» o «Retrasada…». El orden de la lista (US-29) está en `src/domain/agenda.ts`.
- Los días se guardan como **fecha local sin hora** (`date` en PostgreSQL, `'YYYY-MM-DD'` en TypeScript), nunca como `Date` con hora. «Hoy», «ayer» y «cada 30 días» son días, y así se evitan errores de zona horaria y cambio de hora.
- Llegar a la fecha prevista **nunca** marca una tarea como hecha.

### Base de datos

- **Todo cambio en la base de datos es una migración** en `supabase/migrations/` (`npx supabase migration new <nombre-en-ingles>`). Nunca se cambian tablas a mano en el panel de Supabase.
- **Una migración ya fusionada en `main` no se edita:** se corrige con otra nueva.
- Cada migración que crea tablas incluye su RLS, sus políticas y los permisos de cada rol (`anon`, `authenticated`) en el mismo archivo, con comentarios en español.
- Las funciones `security definer` llevan `set search_path = ''` y nombres de tabla con esquema (`public.households`).
- En local: `npx supabase db reset` aplica todas las migraciones desde cero. En la nube hay dos proyectos de Supabase, **producción** y **pruebas** (el de los despliegues de prueba de Vercel), y las aplica Sol desde la rama del PR: `npm run db:push:pruebas` al abrirlo y `npm run db:push:produccion` justo antes de fusionar (ver README, «Puesta en producción»). Avísale en el pull request cuando haya una migración nueva. Para preparar datos de una prueba a mano, `docs/test-data.md`.

## Cómo trabajar con Sol

- **Nada se ejecuta sin la confirmación explícita de Sol.** Antes de cambiar archivos, se propone qué se va a hacer y se espera a que diga que sí.
- **Borradores:** Claude puede hacer commit y subir los cambios a la **rama de trabajo** en cualquier momento, para no perderlos si la sesión se reinicia. Esos commits son borradores: se pueden corregir o deshacer.
- **Nunca sin el ok de Sol:** subir a `main`, abrir, cambiar o fusionar pull requests, tocar issues, Supabase o Vercel, ni empezar una rama nueva para algo que Sol no ha pedido.
- Antes de abrir el pull request, Sol ve el resumen y lo que entra (✋), como hasta ahora.
- El aviso automático del entorno que pide hacer commit no cuenta como confirmación de nada.
- **Si Sol pide opinión, una propuesta o una explicación, se responde solo con eso.** No se implementa nada aunque la respuesta parezca obvia.
- Una confirmación vale para lo que se propuso, no para lo siguiente: cada paso nuevo necesita la suya.

## Flujo de trabajo de una historia

Cada historia sigue este orden, con las skills y el agente de `.claude/`. Los puntos marcados con ✋ **esperan la confirmación de Sol** antes de seguir.

1. **`implement-story`**: leer la historia y sus criterios, y presentar un **plan breve**: qué cambia en la base de datos, en `domain/`, en `storage/` y en las pantallas, qué prueba cubre cada criterio y qué queda fuera. ✋
2. **Rama** `feature/us-xx-…` desde `main`.
3. **`new-migration`**, si cambia la base de datos: la migración, su RLS y su prueba de integración.
4. **`write-tests`**: las pruebas de cada criterio, **antes** del código, y comprobar que fallan.
5. **El código**, por capas: `domain/`, luego `storage/`, luego `features/`.
6. **Comprobar:** `npm test`, `npm run test:integration`, `npm run build` y `npm run test:e2e`.
7. **Agente `code-reviewer`**: revisa la rama. Se arreglan los bloqueantes y los importantes; las sugerencias se comentan con Sol.
8. **Resumen para Sol** de lo hecho y de lo que encontró el revisor. ✋
9. **`open-pr`**: commit, subir la rama y abrir el pull request con «Cómo probarlo a mano». Usa **`release-check`** para la sección «⚠️ Antes de fusionar»: lo que Sol tiene que hacer en Supabase o Vercel.
10. **Sol** lo prueba a mano y lo fusiona. Claude nunca fusiona.

Para un cambio pequeño fuera de una historia, como un texto o un arreglo, el mismo principio: proponer, esperar el sí, hacer, comprobar y pedir confirmación antes del commit y el pull request.

**Otras skills:**
- **`new-story`**: cuando Sol describe algo que quiere en la app, para convertirlo en una historia de usuario de `docs/user-stories.md` que cumpla **INVEST**, con su ok antes de escribirla.
- **`sync-issues`**: cuando cambian las historias de `docs/user-stories.md`, para que los issues de GitHub digan lo mismo.
- **`release-check`**: antes de fusionar, o cuando Sol pregunta qué hay que configurar fuera del código.
- **`create-skill`**: para proponer, crear o mejorar skills y agentes. Se registran aquí, no en el CHANGELOG.

## Convenciones

- **Nombres técnicos en inglés:** carpetas, archivos, variables, funciones, tipos, tablas, columnas y variables CSS. Carpetas y archivos que no son componentes, en `kebab-case` (`task-form`, `api-client`). Componentes React en `PascalCase.tsx`.
- **En español:** la documentación (README, CHANGELOG, este archivo), los comentarios y todos los textos que ve el usuario.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) con el tipo en inglés y la descripción en español: `feat: marcar una parte como hecha`, `fix: …`, `docs: …`, `refactor: …`, `chore: …`, `test: …`.

## Pruebas

El detalle está en `tests/README.md`. Lo esencial:

- **Una historia no está terminada sin pruebas automáticas** que cubran sus criterios de aceptación. Las historias están en `docs/user-stories.md`, y su issue de GitHub está enlazado en la tabla de resumen de ese archivo.
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
docker compose exec app npm test       # pruebas unitarias (Vitest)
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

Antes de dar un cambio por terminado: `npm test`, `npm run test:integration`, `npm run build` y `npm run test:e2e` deben pasar.

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
- El CHANGELOG cuenta los **cambios en la app**: lo que puede hacer el usuario, cómo se guardan los datos, cómo se despliega. Las decisiones de arquitectura o de producto también van, aunque no cambien código.
- **No van** los cambios en la forma de trabajar: reglas de este archivo, skills, agentes, flujo de ramas o de pull requests, issues.
- No hace falta entrada para cambios que no afectan a nadie (erratas, formato).

## Nunca

- Desactivar RLS o crear una tabla sin políticas.
- Subir `.env` o cualquier clave real.
- Hacer que `domain/` dependa de React, Supabase o el navegador.
- Saltarse o desactivar una prueba para que pase la compilación.
- Guardar fechas de días como timestamps con hora.
