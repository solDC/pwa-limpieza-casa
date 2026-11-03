---
name: open-pr
description: Revisar que un cambio está listo y abrir (o preparar) su pull request a main — comprobaciones (npm test, integración, build, e2e), CHANGELOG y documentación al día, sin secretos, y una descripción en español con «Cómo probarlo a mano» paso a paso para el móvil, el aviso de migraciones nuevas y el enlace al issue. Úsala cuando pidan «abre el PR», «prepara el pull request», «¿está listo para fusionar?» o al terminar una historia.
---

# Preparar el pull request

Solo se abre el pull request si lo piden. Si solo piden revisar, haz los pasos 1–3 e informa.

## 1. Comprobaciones (deben pasar todas)

```
npm test
npm run test:integration   # necesita npx supabase start y npm run env:local
npm run build
npm run test:e2e
```

Si alguna no se puede ejecutar en este entorno (por ejemplo, sin Docker para Supabase), **dilo claramente** en la respuesta y en el pull request; no lo des por bueno. Nunca desactives ni te saltes una prueba.

## 2. Revisión del diff

Compara con `main` (`git diff main...HEAD --stat` y el diff completo) y comprueba:

- [ ] **Historia completa:** cada criterio de aceptación de `docs/user-stories.md` tiene al menos un `test(...)` en `tests/e2e/us-XX-….spec.ts`.
- [ ] **Base de datos:** cada tabla nueva tiene RLS, políticas, permisos por rol y prueba de integración de aislamiento entre hogares (skill `db-migration`). Ninguna migración ya fusionada en `main` ha cambiado: `git diff main...HEAD --name-status -- supabase/migrations/` solo debe mostrar `A` (añadidas).
- [ ] **Capas:** `src/domain/` no importa React, Supabase ni el navegador; solo `src/storage/` importa `@supabase/supabase-js`:
  ```
  grep -rln "@supabase/supabase-js" src/ | grep -v '^src/storage/' || echo ok
  ```
- [ ] **Fechas de días** como `'YYYY-MM-DD'` / `date`, no timestamps.
- [ ] **Secretos:** ni `.env` ni claves en el diff; `service_role` no aparece; variables nuevas añadidas a `.env.example`.
- [ ] **Datos de ejemplo** separados de los reales.
- [ ] **CHANGELOG.md** tiene la entrada en `[Unreleased]`, en la sección correcta y en el mismo commit que el cambio.
- [ ] `CLAUDE.md` («Estado», «Modelo de datos») y `README.md` actualizados si corresponde.
- [ ] Textos visibles y comentarios en español; nombres técnicos en inglés.
- [ ] Commits con Conventional Commits (tipo en inglés, descripción en español).

Arregla lo que falle antes de seguir.

## 3. Subir la rama

`git push -u origin <rama>`.

## 4. Descripción del pull request (en español)

Título: el de la historia en Conventional Commits, por ejemplo `feat: crear una tarea (US-04)`.

```markdown
## Qué cambia

- Resumen para Sol, en dos o tres viñetas: qué puede hacer ahora el usuario.
- Decisiones tomadas y por qué (si las hay).

Closes #N   <!-- issue de la tabla de docs/user-stories.md; uno por historia -->

## ⚠️ Migración nueva      <!-- solo si hay archivos nuevos en supabase/migrations/ -->

Este pull request añade `supabase/migrations/<archivo>.sql` (<qué crea>).
Antes de fusionar, y para que funcione el despliegue de prueba, aplícala en la nube desde esta rama:

    git fetch
    git switch <rama>
    npm install
    npx supabase db push --linked

## Cómo probarlo a mano

En el despliegue de prueba de Vercel de este pull request, a ser posible en el móvil:

1. Abre <dirección del despliegue de prueba> y entra con tu email.
   → Deberías ver …
2. Pulsa «…».
   → Deberías ver …
3. (Caso de error o límite: campo vacío, fecha futura, sin conexión…)
   → La app debería decir «…».

## Pruebas automáticas

- `tests/e2e/us-XX-….spec.ts`: un caso por criterio de aceptación.
- `tests/unit/…` / `tests/integration/…`: qué cubren.
- Resultado de `npm test`, `npm run test:integration`, `npm run build` y `npm run test:e2e` (o qué no se pudo ejecutar aquí y por qué).
```

Reglas de «Cómo probarlo a mano»:
- Pasos **numerados y concretos**, con el texto exacto de botones y mensajes tal como aparecen en la app.
- Cada paso dice **qué debería verse**.
- Incluye al menos un caso de error y, si es una historia de móvil (US-24, US-26), el paso en el iPhone con la app instalada.
- Si la historia necesita datos previos (una tarea con partes), explica cómo crearlos.

Sigue la plantilla de pull request del repositorio si existe (`.github/pull_request_template.md`) y añade el pie de atribución que indique el entorno.
