---
name: start-story
description: Empezar a implementar una historia de usuario del MVP (US-XX) de principio a fin — leer la historia y su issue, crear la rama feature/…, planificar por capas (domain, storage, features), escribir primero las pruebas e2e de cada criterio de aceptación y dejar CHANGELOG, README y CLAUDE.md al día. Úsala cuando pidan «implementa la US-04», «empieza la historia de crear tareas» o cualquier trabajo que cierre una historia de docs/user-stories.md.
---

# Implementar una historia de usuario

Guía para llevar una historia de `docs/user-stories.md` desde «sin empezar» hasta lista para el pull request. Sigue los pasos en orden.

## 1. Entender la historia

1. Busca la historia en `docs/user-stories.md` (por ID o por nombre). Copia literalmente sus criterios de aceptación: son la lista de lo que hay que probar.
2. Saca el número de issue de la tabla «Resumen» (columna Issue). **No lo deduzcas del ID**: US-26 es el #29.
3. Si tienes herramientas de GitHub, lee el issue (`mcp__github__issue_read`): puede tener comentarios o una definición de hecho más precisa que el documento.
4. Revisa «Decisiones pendientes» al final de `docs/user-stories.md`. Si la historia depende de una (por ejemplo US-07 y el historial, US-22/23 y `is_demo`), **pregunta a Sol antes de programar** y apunta la decisión en el CHANGELOG.
5. Mira qué historias ya están hechas (sección «Estado» de `CLAUDE.md`) para reutilizar lo que exista.

## 2. Rama

- Si no te han dado una rama, crea `feature/us-XX-<nombre-corto-en-ingles>` desde `main` (ejemplo: `feature/us-04-create-task`). GitHub Flow: no hay rama `development`.
- Si el entorno te asigna otra rama, usa esa.

## 3. Plan por capas

Antes de escribir código, decide qué toca cada capa (reglas de dependencias en `CLAUDE.md`):

| Capa | Qué va | Skill |
|---|---|---|
| `supabase/migrations/` | Tablas nuevas o cambios, con RLS | `db-migration` |
| `src/domain/` | Lógica pura: frecuencias, fechas, progreso | `domain-logic` |
| `src/storage/` | Funciones que leen y guardan en Supabase y traducen `snake_case` ↔ `camelCase` | — |
| `src/features/<pantalla>/` | Componentes `PascalCase.tsx` y hooks `use-xxx.ts` de esa pantalla | — |
| `src/components/` | Solo si lo usan dos o más pantallas | — |

Patrón de `storage/` (ver `src/storage/households.ts` y `auth.ts`):
- Importa `getSupabase()` de `./supabase-client`; nadie más importa `@supabase/supabase-js`.
- Devuelve tipos de `domain/` (o tipos propios en `camelCase`), nunca filas crudas.
- Si hay error, lanza `new Error('<mensaje en español para el usuario>')`.
- Las fechas de días viajan como `'YYYY-MM-DD'`, nunca como `Date`.

Textos de la interfaz en español, nombres técnicos en inglés.

## 4. Pruebas primero

1. Crea `tests/e2e/us-XX-<nombre-en-ingles>.spec.ts`. Cabecera con la historia y el issue:
   ```ts
   // US-04 · Crear una tarea (#5)
   //
   // Necesitan Supabase en local (npx supabase start): usan su buzón de pruebas.
   ```
2. Un `test.describe('US-XX · <título>')` y **al menos un `test(...)` por criterio de aceptación**, con el nombre en español diciendo qué comprueba. Si la historia no tiene criterios explícitos, deriva uno de la frase «I want … so that …».
3. Para entrar, reutiliza el patrón `signIn()` de `tests/e2e/us-01-sign-in.spec.ts` con `uniqueEmail()` y `waitForMagicLink()` de `tests/e2e/helpers/mailbox.ts`. Si un segundo archivo lo necesita, muévelo a `tests/e2e/helpers/` en lugar de copiarlo.
4. Selecciona elementos por rol y texto visible (`getByRole`, `getByLabel`, `getByText`), como en las pruebas existentes. Así la prueba también comprueba la accesibilidad.
5. Las pruebas se ejecutan en `desktop` y `mobile` (Pixel 7): comprueba que la pantalla funciona en las dos.
6. Unitarias para `src/domain/` e integración para cada tabla nueva: las crean las skills `domain-logic` y `db-migration`.

## 5. Implementar y comprobar

```
npm test
npm run test:integration   # si hay base de datos (npx supabase start; npm run env:local)
npm run build
npm run test:e2e
```

Las cuatro deben pasar. Nunca desactives ni te saltes una prueba para que pase.

## 6. Documentación (en el mismo commit que el código)

- `CHANGELOG.md` → `## [Unreleased]` → `### Added`: `**US-XX · <título>** (#N).` y qué puede hacer ahora el usuario y por qué se hizo así. No copies el mensaje del commit.
- `CLAUDE.md` → línea **Estado**: añade la historia a las hechas.
- `README.md` → aviso «🚧 MVP en desarrollo»: actualiza qué funciona ya.
- Si cambias el modelo de datos, actualiza «Modelo de datos» en `CLAUDE.md`.

## 7. Commit

Conventional Commits, tipo en inglés, descripción en español, con el ID: `feat: crear una tarea con nombre y frecuencia (US-04)`.

Cuando esté terminado, usa la skill `open-pr`.
