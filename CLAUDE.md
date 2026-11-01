# CLAUDE.md

Contexto para la IA que trabaja en este repositorio. Léelo antes de cambiar nada.

## Qué es

PWA para organizar las tareas de mantenimiento del hogar: qué toca hoy, qué se ha retrasado y cuánto llevas de cada tarea. El detalle del producto y del modelo de tareas está en el `README.md`.

**Estado:** MVP en desarrollo. Hay una pantalla provisional; la migración a Supabase está decidida pero aún no implementada.

## Arquitectura

- **Frontend:** React 19 + TypeScript (estricto) + Vite. Es una SPA: no hay servidor propio.
- **PWA:** vite-plugin-pwa. Es instalable, pero **necesita conexión**: no hay modo sin conexión en el MVP.
- **Datos y usuarios:** Supabase (PostgreSQL + Auth). La app habla directamente con Supabase desde el navegador.
- **Seguridad de los datos:** Row Level Security (RLS) en **todas** las tablas. Un usuario solo ve y modifica los datos de los hogares de los que es miembro. Una tabla sin RLS es un fallo de seguridad.
- **Inicio de sesión:** enlace mágico por email, sin contraseña.
- **Despliegue:** Vercel (compila con `npm run build` y publica `dist/`).
- **Desarrollo:** Docker, con la misma versión de Node que Vercel. Supabase local con la CLI de Supabase.

### Carpetas

```
src/
├── domain/      Modelo de tareas, motor de frecuencias y progreso. TypeScript puro.
├── storage/     Acceso a Supabase. Única carpeta que importa @supabase/supabase-js.
├── demo/        Datos de ejemplo, separados de los datos reales.
├── features/    Una carpeta por pantalla: home, tasks, history (y auth).
└── ui/          Componentes visuales comunes.
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

## Convenciones

- **Nombres técnicos en inglés:** carpetas, archivos, variables, funciones, tipos, tablas, columnas y variables CSS. Carpetas y archivos que no son componentes, en `kebab-case` (`task-form`, `api-client`). Componentes React en `PascalCase.tsx`.
- **En español:** la documentación (README, CHANGELOG, este archivo), los comentarios y todos los textos que ve el usuario.
- **Pruebas:** junto al código, con el mismo nombre y `.test.ts` (`domain/frequency.ts` → `domain/frequency.test.ts`). Toda la lógica de `domain/` lleva pruebas.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) con el tipo en inglés y la descripción en español: `feat: marcar una parte como hecha`, `fix: …`, `docs: …`, `refactor: …`, `chore: …`, `test: …`.

## Comandos

El entorno de desarrollo es Docker (Node 22, la misma versión que Vercel):

```
docker compose up --build              # arranca Vite en http://localhost:5173
docker compose exec app npm test       # pruebas (Vitest)
docker compose exec app npm run build  # comprobación de tipos + compilación
docker compose exec app npm install X  # añadir una dependencia
docker compose up --build -V           # tras cambiar dependencias
```

Sin Docker, los mismos scripts con `npm` directamente (`npm run dev`, `npm test`, `npm run build`).

- La versión de Node se fija en tres sitios que deben coincidir: `Dockerfile` (`node:22-slim`), `package.json` (`engines`, que es lo que lee Vercel) y `.nvmrc`.
- `node_modules` del contenedor es independiente del de tu ordenador. No lo mezcles.

Antes de dar un cambio por terminado: las pruebas y la compilación deben pasar.

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
