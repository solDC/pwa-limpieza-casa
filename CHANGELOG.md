# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Cada entrada explica qué cambió y por qué; no es un volcado automático de los mensajes de commit.

Los tipos de [Conventional Commits](https://www.conventionalcommits.org/) corresponden a estas secciones: `feat:` → Added, `fix:` → Fixed, `refactor:`/`chore:` → Changed. Lo que se quita va en Removed.

## [Unreleased]

### Added
- `CLAUDE.md` con el contexto del proyecto, la arquitectura y las reglas para la IA (convenciones, secretos, cómo mantener este changelog).
- `CHANGELOG.md` para documentar los cambios y las decisiones importantes.
- `.env.example` con las variables que necesitará Supabase, sin valores reales.

### Changed
- **Arquitectura: de datos en el navegador a base de datos en la nube.** Los datos pasan de IndexedDB a **Supabase** (PostgreSQL), y la app se desplegará en **Vercel**. Motivo: queremos usuarios reales y que toda la actividad quede guardada en un servidor, no en un solo navegador. Así los datos no se pierden si se borra el navegador y se podrán usar desde varios dispositivos.
- **La app necesitará conexión a internet.** Consecuencia directa del cambio anterior: con los datos en la nube, apuntar una tarea sin conexión obligaría a guardarla en una cola y sincronizarla después, y eso es bastante más complejo. Para el MVP la app seguirá siendo instalable, pero sin internet mostrará un aviso. El uso sin conexión pasa al backlog.
- **Inicio de sesión con enlace mágico por email, sin contraseña** (Supabase Auth). Es lo más sencillo para el usuario y evita gestionar contraseñas.
- **El modelo de datos incluye el hogar desde el principio** (`households` y `household_members`), aunque al inicio cada usuario tenga uno solo. Así, compartir la casa con otras personas (en el backlog) no obligará a rehacer la base de datos.
- **Docker pasa a ser el entorno de desarrollo**, con la misma versión de Node que usará Vercel. Hasta ahora compilaba la app y la servía con nginx, que ya no es lo que habrá en producción. La adaptación del Dockerfile está pendiente.
- Nombres técnicos en inglés, siguiendo la convención del proyecto: `src/features/inicio`, `tareas` e `historial` pasan a `home`, `tasks` y `history`, y las variables CSS (`--color-fondo` → `--color-background`, etc.). La documentación y los textos de la app siguen en español.
- `.gitignore`: `.env.example` ya no se ignora (la regla `.env.*` lo incluía) y se añaden `Thumbs.db` y los temporales de la CLI de Supabase.

## [0.1.0] - 2026-11-01

### Added
- Base del proyecto: React + TypeScript + Vite, PWA con vite-plugin-pwa, Vitest, Docker con nginx, README y `.gitignore`.
