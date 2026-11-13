---
name: implement-story
description: Implementa una historia de usuario de este proyecto (US-xx de docs/user-stories.md) de principio a fin, siguiendo CLAUDE.md, desde los criterios de aceptación hasta el código por capas, las pruebas, la revisión y el CHANGELOG. Úsala cuando pidan «implementa la US-04», «empieza la siguiente historia», «haz la historia de…» o trabajar en un issue de una historia.
---

# implement-story

El flujo principal del proyecto. Coordina las otras piezas:

```
implement-story → new-migration (si cambia la base de datos) → write-tests → agentes code-reviewer y docs-reviewer → resumen y ok de Sol → open-pr
```

Las reglas están en `CLAUDE.md`; aquí está el orden en que se aplican.

## 1. Elegir y entender la historia

1. **Si no se ha dicho cuál**, propón la siguiente: la primera **Must have** de la tabla de `docs/user-stories.md` que no esté hecha (mira «Estado» en `CLAUDE.md` y el `CHANGELOG.md`) y cuyas dependencias sí lo estén (por ejemplo, US-30 necesita las tareas de US-27).
2. **Lee:**
   - La historia y sus criterios de aceptación en `docs/user-stories.md`, y su issue (enlazado en la tabla; con las herramientas de GitHub si están disponibles).
   - «Cómo se modelan las tareas» en `README.md` y «Modelo de datos» en `CLAUDE.md`.
   - «Conceptos» en `docs/user-stories.md` (tareas, partes, vueltas, frecuencias) y las notas en cursiva bajo la historia, por si depende de otra.
   - El código que ya existe y que vas a tocar.
3. **Dudas antes que suposiciones.** Si un criterio es ambiguo o depende de una decisión pendiente, pregunta a Sol antes de programar. No cambies los criterios por tu cuenta.
4. **Plan breve** para Sol, y espera su visto bueno:
   - Cambios en la base de datos (tablas, columnas).
   - Lógica de `src/domain/`, funciones de `src/storage/`, pantallas y componentes de `src/features/`.
   - Qué prueba cubrirá cada criterio de aceptación.
   - Lo que **no** se hará porque pertenece a otra historia.

## 2. Rama

Cada historia va **siempre** en su rama `feature/us-xx-<nombre-en-ingles>`, creada desde `main` actualizado. Aunque el entorno asigne otra rama a la sesión (por ejemplo, `claude/…` en las sesiones en la nube), no se usa para la historia:

```bash
git fetch origin main
```

```bash
git switch -c feature/us-xx-<nombre-en-ingles> origin/main
```

## 3. Implementar por capas

De abajo arriba, cada capa probada antes de pasar a la siguiente:

1. **Base de datos** (si hace falta): skill `new-migration`. Incluye su prueba de aislamiento entre hogares.
2. **`src/domain/`**: tipos y lógica pura (frecuencias, próximas fechas, progreso). Sin React, Supabase ni APIs del navegador. «Hoy» llega como parámetro `'YYYY-MM-DD'`. Escribe las pruebas unitarias con `write-tests`, mejor antes que el código.
3. **`src/storage/`**: una función por operación, en el archivo de su tabla (`src/storage/tasks.ts`), con `getSupabase()` de `supabase-client.ts`. Traduce filas `snake_case` a tipos de `domain/` en `camelCase` y nunca devuelve filas crudas. Errores con mensajes en español para el usuario (como en `households.ts`).
4. **`src/features/<pantalla>/`**: componentes `PascalCase.tsx` y hooks `use-*.ts`. Usa `domain/` para la lógica y `storage/` para los datos; nunca Supabase directamente.
   - Textos en español. Formularios con `<label>` y botones con texto, para que se puedan usar (y probar) por su nombre.
   - Pensado primero para el móvil.
   - Estados de carga, error (sin conexión, error de Supabase) y lista vacía.
   - Un componente va a `src/components/` solo si ya lo usan dos pantallas.
5. **Conectarlo** en `src/App.tsx` o en la pantalla que corresponda.

Haz solo lo que pide la historia. Si aparece algo útil pero ajeno, apúntalo para Sol (backlog u otra historia) en lugar de hacerlo.

## 4. Pruebas

Con la skill `write-tests`: al menos una prueba e2e por criterio de aceptación en `tests/e2e/us-xx-<nombre>.spec.ts`, más las unitarias y de integración que falten.

## 5. Comprobar

Con Supabase local arrancado (`npx supabase start`, `npm run env:local`):

```bash
npm test
```

```bash
npm run test:integration
```

```bash
npm run build
```

```bash
npm run test:e2e
```

Todas deben pasar. Si alguna no se puede ejecutar, dilo claramente; no la des por buena.

## 6. Documentar

En el mismo commit que el código:

- **`CHANGELOG.md`**, en `## [Unreleased]` → `### Added`: `**US-xx · Título** (#issue).` y qué puede hacer ahora el usuario, qué decisiones se tomaron y por qué. Mira las entradas de US-01 y US-02 como modelo.
- **`CLAUDE.md`**, línea «Estado»: añade la historia a las hechas.
- **`README.md`**, si cambia cómo se instala, se configura o se usa.
- **`docs/user-stories.md`**, solo si Sol ha aclarado o cambiado un criterio.

## 7. Revisión

Encarga dos revisiones de la rama, cada una a su agente y a la vez: **`code-reviewer`** (el código, las pruebas y la base de datos) y **`docs-reviewer`** (la documentación, después de hacer el paso 6). Con sus informes:

- Arregla los bloqueantes y los importantes. Si es un fallo, primero la prueba que lo reproduce (`write-tests`).
- Las sugerencias, coméntalas con Sol.
- Vuelve a ejecutar las pruebas del paso 5 tras los arreglos.

## 8. Resumen para Sol y esperar su ok

Antes del pull request, enséñale a Sol:

- Qué se ha hecho, criterio por criterio de aceptación, y con qué prueba se cubre cada uno.
- El resultado de las pruebas y la compilación (paso 5), y las que no se pudieron ejecutar.
- Qué encontró cada revisor (`code-reviewer` y `docs-reviewer`, por separado) y qué se arregló. **Todas** las sugerencias que quedan, una a una y con una recomendación, para que decida: no basta con dejarlas en el pull request.
- Lo que queda fuera porque pertenece a otra historia.

**No abras el pull request hasta que Sol diga que sí.** Los commits de borrador en la rama de trabajo sí se pueden hacer y subir en cualquier momento (ver «Cómo trabajar con Sol» en `CLAUDE.md`). Con su ok, sigue con la skill `open-pr`, que deja la rama lista y abre el pull request. Esta skill termina aquí.

## Antes de terminar

- [ ] Cada criterio de aceptación está implementado y tiene su prueba e2e.
- [ ] Las capas respetan las reglas de dependencias de `CLAUDE.md`.
- [ ] Los días son `'YYYY-MM-DD'`, nunca `Date` con hora.
- [ ] `npm test`, `npm run test:integration`, `npm run build` y `npm run test:e2e` pasan, o se ha dicho cuáles no se pudieron ejecutar.
- [ ] Ni `code-reviewer` ni `docs-reviewer` dejan bloqueantes o importantes sin resolver.
- [ ] CHANGELOG y «Estado» de `CLAUDE.md` actualizados, para ir en el mismo commit que el código.
- [ ] Sol ha dado su ok al resumen (paso 8) antes de pasar a `open-pr`.
- [ ] Nada fuera del alcance de la historia.
