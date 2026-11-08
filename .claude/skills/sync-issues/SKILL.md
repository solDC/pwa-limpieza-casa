---
name: sync-issues
description: Sincroniza los issues de GitHub con las historias de docs/user-stories.md en este proyecto (crear los de historias nuevas, actualizar su texto, cerrar las que salen del MVP o pasarlas al backlog, y enlazarlos en la tabla). Úsala cuando se añadan, quiten o cambien historias, cuando cambie el alcance del MVP o cuando pidan «sincroniza los issues», «crea los issues» o «actualiza los issues».
---

# sync-issues

`docs/user-stories.md` manda: los issues de GitHub tienen que contar lo mismo que ese archivo. Cada historia tiene su issue, enlazado en la tabla de resumen.

**No cambies ningún issue sin el ok de Sol** (ver «Cómo trabajar con Sol» en `CLAUDE.md`).

## 1. Leer las dos fuentes

1. `docs/user-stories.md` en `main` actualizado (o en la rama que diga Sol): la tabla de resumen (ID, título, prioridad, issue) y, para cada historia, su texto *As a… I want… so that…* y sus criterios de aceptación. Lee también las secciones de historias fuera del MVP o del backlog, si las hay.
2. Los issues del repositorio `solDC/pwa-limpieza-casa`, abiertos y cerrados, con las herramientas de GitHub de la sesión o con `gh issue list --state all --limit 200`. Los de historias tienen la etiqueta `user-story` y el título `US-xx · Título`.

## 2. Comparar y preparar la lista de cambios

Para cada historia, una de estas acciones:

| Situación | Acción |
|---|---|
| Historia sin issue | **Crear** el issue |
| El título, el texto, los criterios o la prioridad no coinciden | **Actualizar** el issue |
| Historia absorbida o sustituida por otra | **Cerrar** como *not planned*, con un comentario que diga cuál la sustituye |
| Historia que pasa al backlog (para una versión futura) | **Dejar abierta** con la etiqueta `backlog` y quitar `must have`/`nice to have` |
| Historia hecha (está en «Estado» de `CLAUDE.md` y su pull request está fusionado) | No tocar: se cerró con `Closes #…` |
| Etiqueta de prioridad antigua (`must`, `should`) | **Cambiarla** por `must have` o `nice to have` |
| Issue de historia que ya no aparece en el documento | **Preguntar** a Sol qué hacer |

## 3. Enseñar la lista a Sol y esperar su ok

Una tabla con cada issue afectado, la acción y el motivo. No hagas nada hasta que Sol diga que sí; si quiere cambiar alguna acción, ajústala y vuelve a enseñarla.

## 4. Aplicar los cambios

Con el ok de Sol:

- **Issue nuevo:** título `US-xx · Título`; etiquetas `user-story` y `must have` o `nice to have`; cuerpo con este formato:

  ```markdown
  **Prioridad:** Must have · **Área:** <sección de docs/user-stories.md>

  > As a …,
  > I want …,
  > so that ….

  ## Criterios de aceptación

  - [ ] …

  ## Definición de hecho

  - [ ] Pruebas automáticas que cubren los criterios de aceptación
  - [ ] Las pruebas, la compilación y la CI pasan
  - [ ] `CHANGELOG.md` actualizado

  Detalle en [`docs/user-stories.md`](https://github.com/solDC/pwa-limpieza-casa/blob/main/docs/user-stories.md).
  ```

- **Cerrar:** estado *closed* con motivo *not planned*, después del comentario que explica por qué y qué historia la sustituye.
- **Backlog:** si la etiqueta `backlog` no existe, se crea al añadirla.
- Los comentarios y cuerpos que escribas en GitHub acaban con el pie de atribución que pida la sesión.

## 5. Enlazar en el documento

En la tabla de resumen de `docs/user-stories.md`, la columna «Issue» con el enlace de cada historia (`[#29](https://github.com/solDC/pwa-limpieza-casa/issues/29)`). Este cambio de documentación sigue el flujo normal: rama, ok de Sol y `open-pr`. No va en el CHANGELOG, porque no cambia la app.

## Antes de terminar

- [ ] Sol ha dado su ok a la lista de cambios antes de tocar GitHub.
- [ ] Cada historia del documento tiene su issue, con el mismo título, texto, criterios y prioridad.
- [ ] Las que salen del MVP están cerradas como *not planned* con su comentario, o abiertas con `backlog`.
- [ ] La tabla de `docs/user-stories.md` enlaza todos los issues.
