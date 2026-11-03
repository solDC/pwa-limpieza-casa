---
name: create-skill
description: Descubre qué skills y agentes serían útiles en este proyecto (PWA de tareas del hogar con React, Supabase y Vercel) y crea el que se elija en .claude/skills/ o .claude/agents/. Úsala cuando pidan crear, proponer, buscar o mejorar una skill o un agente (por ejemplo, un revisor de código), o cuando se repita a mano un mismo flujo de trabajo (historias, migraciones, pruebas, pull requests).
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
   | `code-reviewer` (agente) | Revisar los cambios de la rama frente a `main` con las reglas de `CLAUDE.md`: dependencias entre capas (`domain/` sin React, Supabase ni navegador; solo `storage/` importa Supabase), RLS y políticas en cada migración, fechas como `'YYYY-MM-DD'`, nombres en inglés y textos en español, pruebas que cubren cada criterio de aceptación, CHANGELOG al día. Solo informa; no cambia código. |
   | `write-tests` | Una sola skill para las pruebas de los tres niveles, según lo que se haya cambiado: unitarias de `src/domain/` (casos límite de fechas), integración de cada tabla nueva (aislamiento entre hogares) y e2e por historia (una prueba por criterio, contra la versión compilada). |
   | `open-pr` | Comprobar `npm test`, `npm run build`, `npm run test:e2e`; CHANGELOG al día; PR con «Cómo probarlo a mano» y aviso de migraciones. |
   | `fix-bug` | Reproducir el fallo con una prueba que falla, arreglarlo y anotarlo en `Fixed`. |

   **Evita la fragmentación:** es mejor una skill que cubra un flujo completo que varias muy especializadas que se solapan. Antes de proponer una skill nueva, comprueba si cabe como un paso de otra (por ejemplo, las pruebas son un paso de `implement-story` y de `fix-bug`, que remiten a `write-tests`).

   **Skill o agente.** Propón un **agente** (`.claude/agents/<nombre>.md`) cuando la tarea se beneficia de un contexto limpio y de una mirada independiente, como revisar código: así no revisa con los mismos supuestos con los que se escribió. Propón una **skill** cuando son pasos que Claude sigue en la conversación actual.

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
   Si es un **agente**, crea en su lugar `.claude/agents/<nombre>.md`: el mismo frontmatter (`name`, `description`) más `tools` con solo las herramientas que necesita (un revisor: `Read, Grep, Glob, Bash`, sin `Edit` ni `Write`). El cuerpo es su prompt de sistema: qué revisa, en qué orden y cómo informa (hallazgos por gravedad, con `archivo:línea` y la regla de `CLAUDE.md` que incumple).
3. **Revisa** la skill o el agente contra el código: que las rutas, scripts de `package.json` y comandos existen de verdad.
4. **CHANGELOG:** añade una entrada en `## [Unreleased]` → `### Added` explicando qué hace la skill y por qué es útil, en el mismo commit.
5. **Commit** con Conventional Commits: `chore: skill <nombre> para …`.
6. **Explica a Sol** cómo usarla (`/<nombre>` o pidiéndolo con palabras) y sugiere la siguiente candidata de la lista.

## Antes de terminar

- [ ] La carpeta y el `name` coinciden y están en `kebab-case`.
- [ ] La `description` dice qué hace y cuándo usarla.
- [ ] Las rutas y comandos citados existen en el repositorio.
- [ ] No contradice ninguna regla de `CLAUDE.md`.
- [ ] `CHANGELOG.md` actualizado en el mismo commit.
