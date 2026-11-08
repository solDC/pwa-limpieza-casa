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
2. **Mira qué skills existen ya** y qué agentes, en `.claude/skills/` y `.claude/agents/`, para no duplicarlos. Si una existente casi cubre la necesidad, propón mejorarla en lugar de crear otra.
3. **Busca flujos repetibles.** Una buena skill cumple al menos una de estas condiciones:
   - Es un proceso de varios pasos que se repite (cada historia, cada migración, cada pull request).
   - Tiene reglas fáciles de olvidar que están en `CLAUDE.md` (RLS, CHANGELOG en el mismo commit, fechas sin hora, nombres en inglés y textos en español).
   - Necesita comandos concretos del proyecto (`npx supabase …`, `npm run test:e2e` contra `preview`).
   - No conviene si es una tarea puntual o si basta con una línea en `CLAUDE.md`.
4. **Distingue skill de agente:**
   - **Skill** (`.claude/skills/<nombre>/SKILL.md`): una receta de pasos que Claude sigue en la conversación actual, con todo su contexto. Sirve para **hacer** trabajo de forma repetible.
   - **Agente** (`.claude/agents/<nombre>.md`): otro Claude que recibe un encargo, empieza con el contexto limpio, puede tener solo algunas herramientas y devuelve un resumen. Solo merece la pena para **una mirada independiente** (juzgar algo sin los supuestos de quien lo hizo) o para **separar mucho trabajo de lectura** de la conversación. Para buscar en el código ya existen los agentes de Claude Code (`Explore`, `general-purpose`).
   - En la duda, es una skill.

5. **Parte de este catálogo** (1 agente y 7 skills) y marca cuáles existen ya:

   | Nombre | Tipo | Para qué |
   |---|---|---|
   | `write-tests` | Skill | Las pruebas de los tres niveles según lo que haya cambiado: unitarias de `src/domain/`, integración de cada tabla (aislamiento entre hogares) y e2e por historia. También para fallos: primero la prueba que lo reproduce. |
   | `new-migration` | Skill | Cada cambio en la base de datos: migración con `npx supabase migration new`, RLS, políticas, permisos por rol y comentarios en español; usa `write-tests` para la prueba de integración. |
   | `code-reviewer` | Agente | Revisa la rama frente a `main` con las reglas de `CLAUDE.md`: dependencias entre carpetas, RLS, fechas `'YYYY-MM-DD'`, nombres en inglés y textos en español, una prueba por criterio, documentación al día y CHANGELOG solo con cambios de la app. Solo lee e informa. |
   | `implement-story` | Skill | El flujo principal: de la historia `US-xx` al código por capas (`domain` → `storage` → `features`). Usa `new-migration` y `write-tests`, y pide revisión a `code-reviewer`. |
   | `open-pr` | Skill | Pasa `npm test`, `npm run build` y `npm run test:e2e`, revisa el CHANGELOG, avisa de migraciones, enseña el resumen a Sol y, con su ok, hace el commit y abre el PR con «Cómo probarlo a mano». |
   | `new-story` | Skill | Convierte una idea de Sol en una historia de `docs/user-stories.md`: pregunta lo que falte, comprueba que no duplica otra y que encaja con «Conceptos», escribe criterios comprobables y espera su ok. |
   | `sync-issues` | Skill | Mantiene los issues de GitHub iguales que `docs/user-stories.md`: crear, actualizar, cerrar como *not planned* o pasar al backlog, con el ok de Sol, y enlazarlos en la tabla. |
   | `release-check` | Skill | Lista para Sol lo que hay que hacer fuera del código antes de fusionar (migraciones en la nube, plantillas del email, variables de Vercel, Redirect URLs, reinstalar la PWA). No ejecuta nada en la nube. |

   Flujo de cada historia: `implement-story` → (`new-migration`, `write-tests`) → `code-reviewer` → resumen y ok de Sol → `open-pr` (con `release-check`). Está también en «Flujo de trabajo de una historia» de `CLAUDE.md`.

   Si Sol pide algo nuevo, comprueba primero si cabe como un paso de una de estas antes de crear otra: es mejor pocas piezas que cubran flujos completos que muchas que se solapan. Un segundo agente solo tendría sentido en casos como estos: probar la app en el navegador como un usuario sin ver el código, o revisar solo la seguridad cuando se pueda compartir el hogar.

6. **Pregunta cuál crear** (con AskUserQuestion si está disponible) y no escribas nada hasta tener la respuesta. Si Sol describe una idea propia, úsala.

## Fase 2 · Crear

1. **Concreta el alcance** con Sol si hace falta: qué la activa, qué pasos sigue, qué produce y qué no debe hacer.
2. **Crea** `.claude/skills/<nombre>/SKILL.md`:
   - Frontmatter YAML con `name` (igual que la carpeta) y `description`. La descripción decide cuándo se activa la skill: di **qué hace y cuándo usarla**, con las palabras que Sol usaría («nueva historia», «migración», «abrir PR»…).
   - Cuerpo **en español**, con nombres técnicos en inglés, como pide `CLAUDE.md`.
   - Pasos numerados y accionables, con los comandos exactos del proyecto y las rutas reales.
   - Una sección «Antes de terminar» con la comprobación final (pruebas y build, si la skill cambia código).
   - No copies `CLAUDE.md` entero: remite a él y recoge solo las reglas que la skill necesita aplicar.
   - Breve (idealmente menos de 150 líneas). Si necesita plantillas o ejemplos largos, ponlos en archivos aparte dentro de la misma carpeta (`templates/`, `reference.md`) y enlázalos desde `SKILL.md`.
   - Nunca incluyas claves, tokens ni datos reales.
   Si es un **agente**, crea en su lugar `.claude/agents/<nombre>.md`: el mismo frontmatter (`name`, `description`) más `tools` con solo las herramientas que necesita (un revisor: `Read, Grep, Glob, Bash`, sin `Edit` ni `Write`). El cuerpo es su prompt de sistema: qué revisa, en qué orden y cómo informa (hallazgos por gravedad, con `archivo:línea` y la regla de `CLAUDE.md` que incumple).
3. **Revisa** la skill o el agente contra el código: que las rutas, scripts de `package.json` y comandos existen de verdad.
4. **CLAUDE.md, no el CHANGELOG:** el CHANGELOG solo cuenta cambios en la app. Añade la skill o el agente nuevo a «Flujo de trabajo de una historia» de `CLAUDE.md`, si forma parte del flujo, o a la lista «Otras skills» con una línea: para qué sirve y cuándo usarla.
5. **Commit y resumen para Sol.** Los commits de borrador en la rama de trabajo se pueden hacer y subir en cualquier momento (ver «Cómo trabajar con Sol» en `CLAUDE.md`), con Conventional Commits: `chore: skill <nombre> para …`. **Enséñale a Sol el resumen y espera su ok antes de abrir el pull request.**
6. **Explica a Sol** cómo usarla (`/<nombre>` o pidiéndolo con palabras) y sugiere la siguiente candidata de la lista.

## Antes de terminar

- [ ] La carpeta y el `name` coinciden y están en `kebab-case`.
- [ ] La `description` dice qué hace y cuándo usarla.
- [ ] Las rutas y comandos citados existen en el repositorio.
- [ ] No contradice ninguna regla de `CLAUDE.md`.
- [ ] Registrada en `CLAUDE.md` (flujo u «Otras skills»), no en el CHANGELOG.
- [ ] Sol ha dado su ok antes de abrir el pull request.
