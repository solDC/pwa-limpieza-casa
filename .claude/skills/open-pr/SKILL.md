---
name: open-pr
description: Prepara y abre un pull request a main en este proyecto con las comprobaciones de CLAUDE.md (pruebas, compilación, CHANGELOG, secretos, migraciones) y la descripción que Sol necesita para probarlo a mano en el móvil. Úsala al terminar una historia o un arreglo, o cuando pidan «abre el PR», «crea el pull request» o «sube esto para revisar».
---

# open-pr

Último paso de `implement-story` (y de cualquier arreglo). Un pull request en este proyecto no es solo código: Sol lo prueba a mano en el despliegue de prueba de Vercel antes de fusionarlo, así que la descripción tiene que bastar para hacerlo sin preguntar nada.

**No fusiones nunca el pull request**: lo fusiona Sol cuando lo ha probado y la CI está en verde.

## 1. Comprobaciones antes de abrirlo

1. **Rama:** no estás en `main`. La rama se llama `feature/us-xx-…` (una historia), `fix/…` (un arreglo), `docs/…` o `chore/…`. La rama que asigna el entorno a la sesión (por ejemplo, `claude/…` en las sesiones en la nube) no se usa para pull requests.
2. **Al día con `main`:**

   ```bash
   git fetch origin main
   ```

   ```bash
   git log --oneline HEAD..origin/main
   ```

   Si hay commits nuevos en `main`, intégralos (`git merge origin/main`), resuelve conflictos y vuelve a probar. No reescribas la historia de una rama que ya está en GitHub.
3. **Pruebas y compilación**, con Supabase local arrancado (`npx supabase start`, `npm run env:local`):

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

   Si alguna falla, no abras el PR: arréglalo antes. Si alguna no se puede ejecutar, ábrelo como **borrador** y dilo en la descripción.
4. **Revisión:** si el agente `code-reviewer` no ha revisado la versión actual de la rama, encárgaselo ahora. Sin bloqueantes ni importantes pendientes.
5. **CHANGELOG:** `git diff origin/main...HEAD -- CHANGELOG.md` tiene entradas para lo que cambia, en la sección correcta.
6. **Secretos:** nada de `.env`, claves ni tokens en el diff:

   ```bash
   git diff --name-only origin/main...HEAD
   ```

   Si hay una variable de entorno nueva, está en `.env.example` y en la descripción (hay que añadirla en Vercel).
7. **Migraciones:**

   ```bash
   git diff --name-only origin/main...HEAD -- supabase/migrations/
   ```

   Si hay alguna, la descripción lleva el aviso de aplicarla (paso 2).

## 2. Descripción

Título: el commit principal en Conventional Commits, en español (`feat: marcar una tarea como hecha (US-30)`).

Cuerpo en español, con estas secciones (el modelo es el PR #28 de US-01 y US-02). Omite las que no apliquen:

```markdown
Closes #<issue>

## Qué incluye
Lo que puede hacer ahora el usuario, por historia (### US-xx · Título), y las decisiones
tomadas. Las tablas nuevas, con qué protege su RLS.

## Pruebas automáticas
| Tipo | Archivo | Qué comprueba |
|---|---|---|
Y el resultado real: «Comprobado en local: 12/12 de integración y 16/16 e2e».
Lo que no se pudo ejecutar, dicho claramente.

## ⚠️ Antes de fusionar: migración nueva
Aplicarla en la nube desde la terminal del dev container, en esta rama:
    git fetch
    git switch <rama>
    npm install
    npx supabase db push --linked
Si no es compatible con la versión de main, explicar qué se rompe y en qué orden hacerlo.
(También aquí: variables nuevas que haya que añadir en Vercel, o cualquier configuración manual.)

## Cómo probarlo a mano
En el despliegue de prueba de Vercel
(https://pwa-limpieza-casa-git-<rama-con-guiones>-sol-dc.vercel.app), mejor desde el móvil:
1. Acción concreta. Qué debería verse, con los textos exactos de la pantalla.
2. …
Un paso o más por criterio de aceptación, incluidos los casos de error.

## Pendiente o riesgos
Lo que no se ha comprobado, limitaciones conocidas y mejoras propuestas para más adelante.
```

Reglas para «Cómo probarlo a mano»:
- Pasos numerados, desde abrir el enlace, con los **textos exactos** de botones y mensajes, como los ve la persona.
- Cubre todos los criterios de aceptación, también los casos de error y la lista vacía.
- Avisa de lo que pueda confundir (emails que tardan o van a spam, límites de Supabase, datos que hay que crear antes).
- La dirección del despliegue de prueba sustituye `/` por `-` en el nombre de la rama (`feature/us-01-sign-in` → `feature-us-01-sign-in`). Si no estás seguro de ella, di que está en el comentario de Vercel del PR.

Termina el cuerpo con las líneas de atribución que indique la sesión, si las hay.

## 3. Resumen y ok de Sol

Antes de abrir el pull request, enséñale a Sol:

- La rama y lo que va a entrar (`git diff --stat origin/main...HEAD` y, si queda algo sin commit, `git status --short`).
- El resultado de las comprobaciones del paso 1, y si hay migración o variables nuevas.
- La descripción del pull request del paso 2, tal como se publicará.

**Espera a que diga que sí.** Si pide cambios, hazlos y vuelve a enseñárselo.

## 4. Commit y subir la rama

Los commits de borrador pueden estar ya hechos y subidos (ver «Cómo trabajar con Sol» en `CLAUDE.md`). Con el ok de Sol, deja la rama lista:

- Commit con Conventional Commits, tipo en inglés y descripción en español: `feat: <qué puede hacer el usuario> (US-xx)`, `fix: …`, `chore: …`. Incluye el código, las pruebas, el CHANGELOG y «Estado» de `CLAUDE.md` en el mismo commit.

```bash
git push -u origin <rama>
```

## 5. Crear el pull request

Base `main`, con las herramientas de GitHub de la sesión (`create_pull_request`) o con `gh pr create`. Borrador si quedó algo sin comprobar.

## 6. Después

- Da a Sol el enlace del PR y un resumen de dos o tres líneas: qué incluye, si hay migración que aplicar y si queda algo pendiente.
- Ofrece vigilar la CI y los comentarios del PR. Si la CI falla, primero reprodúcelo en local; nunca se salta ni se desactiva una prueba para ponerla en verde.
- Si Sol pide cambios en el pull request, propónselos y espera su ok antes de subirlos.
- Si Sol encuentra un fallo al probarlo a mano: primero la prueba que lo reproduce (`write-tests`), luego el arreglo, en la misma rama.

## Antes de terminar

- [ ] Sol ha dado su ok al resumen y a la descripción antes de abrir el pull request.
- [ ] Rama al día con `main` y subida.
- [ ] `npm test`, `npm run test:integration`, `npm run build` y `npm run test:e2e` pasan, o el PR es borrador y dice por qué.
- [ ] `code-reviewer` sin bloqueantes ni importantes pendientes.
- [ ] CHANGELOG actualizado; sin secretos en el diff.
- [ ] Descripción con `Closes #…`, pruebas, aviso de migración (si hay) y «Cómo probarlo a mano».
- [ ] El PR no se ha fusionado.
