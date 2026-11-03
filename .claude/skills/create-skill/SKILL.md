---
name: create-skill
description: Descubre qué skills serían útiles en este proyecto (PWA de tareas del hogar con React, Supabase y Vercel) y crea la que se elija en .claude/skills/. Úsala cuando pidan crear, proponer, buscar o mejorar una skill, o cuando se repita a mano un mismo flujo de trabajo (historias, migraciones, pruebas, pull requests).
---

# create-skill

Ayuda a Sol a **descubrir** skills útiles para este repositorio y a **crearlas** siguiendo sus convenciones. Trabaja en dos fases: primero propone, luego crea solo la que se elija.

## Fase 1 · Descubrir

1. **Lee el contexto del proyecto** antes de proponer nada:
   - `CLAUDE.md` (reglas, arquitectura, comandos, cosas que no se hacen nunca).
   - `README.md`, `tests/README.md`, `docs/user-stories.md` (historias pendientes y su issue).
   - `CHANGELOG.md` y `git log --oneline -30`: qué trabajo se repite.
   - `.github/workflows/ci.yml`, `supabase/migrations/`, `tests/`, `src/`.
2. **Mira qué skills existen ya** en `.claude/skills/` para no duplicarlas. Si una existente casi cubre la necesidad, propón mejorarla en lugar de crear otra.
3. **Busca flujos repetibles.** Una buena skill cumple al menos una de estas condiciones:
   - Es un proceso de varios pasos que se repite (cada historia, cada migración, cada pull request).
   - Tiene reglas fáciles de olvidar que están en `CLAUDE.md` (RLS, CHANGELOG en el mismo commit, fechas sin hora, nombres en inglés y textos en español).
   - Necesita comandos concretos del proyecto (`npx supabase …`, `npm run test:e2e` contra `preview`).
   - No conviene si es una tarea puntual o si basta con una línea en `CLAUDE.md`.
4. **Presenta de 3 a 6 candidatas** en una tabla, ordenadas por utilidad, con: nombre (`kebab-case`, en inglés), para qué sirve, cuándo se activaría y qué regla del proyecto protege. Usa como punto de partida este catálogo, ajustándolo a lo que encuentres:

   | Skill | Para qué |
   |---|---|
   | `implement-story` | Llevar una historia `US-xx` de principio a fin: leer criterios e issue, rama `feature/…`, código por capas (`domain` → `storage` → `features`), pruebas, CHANGELOG y PR con «Cómo probarlo a mano». |
   | `new-migration` | Crear una migración con `npx supabase migration new`, con RLS, políticas, permisos por rol y comentarios en español; prueba de integración de aislamiento entre hogares; aviso en el PR. |
   | `story-e2e-tests` | Escribir `tests/e2e/us-xx-….spec.ts` con una prueba por criterio de aceptación, nombres en español, contra la versión compilada. |
   | `domain-unit-tests` | Pruebas de `src/domain/` en la misma ruta bajo `tests/unit/`, con casos límite de fechas (fin de mes, bisiestos, cambio de hora). |
   | `open-pr` | Comprobar `npm test`, `npm run build`, `npm run test:e2e`; CHANGELOG al día; PR con «Cómo probarlo a mano» y aviso de migraciones. |
   | `fix-bug` | Reproducir el fallo con una prueba que falla, arreglarlo y anotarlo en `Fixed`. |
   | `check-architecture` | Revisar que `domain/` no importa React/Supabase/navegador, que solo `storage/` usa Supabase y que los componentes compartidos están en `components/`. |

5. **Pregunta cuál crear** (con AskUserQuestion si está disponible) y no escribas nada hasta tener la respuesta. Si Sol describe una idea propia, úsala.

## Fase 2 · Crear

1. **Concreta el alcance** con Sol si hace falta: qué la activa, qué pasos sigue, qué produce y qué no debe hacer.
2. **Crea** `.claude/skills/<nombre>/SKILL.md`:
   - Frontmatter YAML con `name` (igual que la carpeta) y `description`. La descripción decide cuándo se activa la skill: di **qué hace y cuándo usarla**, con las palabras que Sol usaría («nueva historia», «migración», «abrir PR»…).
   - Cuerpo **en español**, con nombres técnicos en inglés, como pide `CLAUDE.md`.
   - Pasos numerados y accionables, con los comandos exactos del proyecto y las rutas reales.
   - Una sección «Antes de terminar» con la comprobación final (pruebas, build, CHANGELOG).
   - No copies `CLAUDE.md` entero: remite a él y recoge solo las reglas que la skill necesita aplicar.
   - Breve (idealmente menos de 150 líneas). Si necesita plantillas o ejemplos largos, ponlos en archivos aparte dentro de la misma carpeta (`templates/`, `reference.md`) y enlázalos desde `SKILL.md`.
   - Nunca incluyas claves, tokens ni datos reales.
3. **Revisa** la skill contra el código: que las rutas, scripts de `package.json` y comandos existen de verdad.
4. **CHANGELOG:** añade una entrada en `## [Unreleased]` → `### Added` explicando qué hace la skill y por qué es útil, en el mismo commit.
5. **Commit** con Conventional Commits: `chore: skill <nombre> para …`.
6. **Explica a Sol** cómo usarla (`/<nombre>` o pidiéndolo con palabras) y sugiere la siguiente candidata de la lista.

## Antes de terminar

- [ ] La carpeta y el `name` coinciden y están en `kebab-case`.
- [ ] La `description` dice qué hace y cuándo usarla.
- [ ] Las rutas y comandos citados existen en el repositorio.
- [ ] No contradice ninguna regla de `CLAUDE.md`.
- [ ] `CHANGELOG.md` actualizado en el mismo commit.
