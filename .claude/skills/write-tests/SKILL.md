---
name: write-tests
description: Escribe las pruebas automáticas de este proyecto en el nivel que toque (unitarias de src/domain/, integración de la base de datos con RLS, e2e de una historia US-xx) siguiendo tests/README.md. Úsala al implementar una historia, al crear una migración o tabla, al cambiar lógica de src/domain/, al encontrar un fallo (primero la prueba que lo reproduce) o cuando pidan «escribe las pruebas», «añade tests» o «cubre los criterios de aceptación».
---

# write-tests

Escribe las pruebas que necesita un cambio, en el nivel adecuado y con las convenciones del proyecto. Las reglas completas están en `tests/README.md` y en la sección «Pruebas» de `CLAUDE.md`; aquí está cómo aplicarlas.

## 1. Decide qué niveles hacen falta

Mira qué ha cambiado (`git diff origin/main...HEAD --stat` y los archivos sin confirmar) y elige:

| Si cambia… | Nivel | Dónde |
|---|---|---|
| Lógica de `src/domain/` | Unitarias | `tests/unit/domain/<misma-ruta>.test.ts` |
| Una tabla, política RLS o función de `supabase/migrations/` | Integración | `tests/integration/<tabla-o-grupo>.test.ts` |
| Algo que ve el usuario o un criterio de aceptación de una historia | E2E | `tests/e2e/us-xx-<nombre>.spec.ts` |
| Un fallo | El nivel más bajo que lo reproduzca | Junto a las pruebas de ese código |

Un cambio puede necesitar varios niveles: una historia nueva con tabla nueva suele llevar los tres. No pruebes en e2e lo que se puede probar en unitarias: las e2e son lentas y van a lo que ve el usuario.

## 2. Si es un fallo: primero la prueba

1. Escribe la prueba que reproduce el fallo, con un comentario que diga qué pasaba y por qué (ver el ejemplo «Regresión:» en `tests/e2e/us-01-sign-in.spec.ts`).
2. Ejecútala y **comprueba que falla** por el motivo esperado. Si pasa, no reproduce el fallo: revísala.
3. Solo entonces, el arreglo. Después la prueba debe pasar.

## 3. Escribe las pruebas

Comunes a todos los niveles:
- Nombres de `describe`, `it` y `test` **en español**, diciendo qué se comprueba («un usuario no puede cambiar el nombre del hogar de otro»). Variables y funciones en inglés.
- Cabecera con un comentario: historia e issue (`// US-02 · Hogar creado automáticamente (#3)`). El número de issue está en la tabla de `docs/user-stories.md`.
- Cada prueba es independiente: no depende del orden ni de datos de otra.
- Nunca `.skip`, `.only` ni bajar una aserción para que pase. Si una prueba falla, se arregla el código o se entiende por qué.

### Unitarias (Vitest, `npm test`)

- Misma ruta que el código: `src/domain/frequency.ts` → `tests/unit/domain/frequency.test.ts`.
- `domain/` recibe datos y devuelve datos: la prueba también. Nada de Supabase, React ni navegador.
- **No dependas del reloj real.** «Hoy» se pasa como parámetro (`'2026-03-31'`), no se lee con `new Date()`. Si el código lo lee, es un fallo de diseño: dilo.
- Los días son `'YYYY-MM-DD'`. Casos límite obligatorios cuando hay fechas:
  - fin de mes (31 → mes de 30 días, 31 de enero + 1 mes),
  - febrero en año bisiesto y no bisiesto (2028-02-29, 2027-02-28),
  - cambio de año,
  - cambio de hora (último domingo de marzo y de octubre): el resultado no debe moverse un día,
  - que llegar a la fecha prevista **no** marca la tarea como hecha.
- Usa `it.each` para tablas de casos en lugar de copiar pruebas.

### Integración (Vitest, `npm run test:integration`)

Necesitan Supabase local: `npx supabase start` y `npm run env:local`. Sigue el modelo de `tests/integration/households.test.ts` y usa los helpers de `tests/integration/helpers/database.ts`:
- `connect()`, `createUser(db)` en `beforeAll`; `deleteUsers(db, [...])` y `db.end()` en `afterAll`.
- `asUser(db, userId, (query) => …)` para actuar como un usuario (o `null` para sin sesión); lo que hace se deshace al terminar.

Por **cada tabla nueva**, como mínimo (usa dos usuarios, por ejemplo `ana` y `bruno`):
- un usuario ve y modifica sus datos;
- **no** ve los datos de otro hogar (`select` devuelve solo los suyos);
- **no** modifica ni borra los de otro hogar (`rowCount` 0 o `permission denied`);
- **no** inserta datos en el hogar de otro;
- sin sesión no lee nada;
- lo que la app no debe poder hacer (según los permisos de la migración) falla con `permission denied`.

### E2E (Playwright, `npm run test:e2e`)

- Un archivo por historia: `tests/e2e/us-xx-<nombre-en-ingles>.spec.ts`, con un `test.describe` por historia.
- **Al menos una prueba por criterio de aceptación** de `docs/user-stories.md`. Copia el criterio casi literal como nombre de la prueba, para que se vea qué cubre cada una.
- Se ejecutan contra la versión compilada (puerto 4173), en escritorio y en móvil (`playwright.config.ts`): la prueba debe valer en los dos.
- Busca elementos como los ve una persona: `getByRole`, `getByLabel`, `getByText`. Nada de clases CSS ni `data-` salvo que no haya otra forma.
- Inicio de sesión: `uniqueEmail()` y `waitForMagicLink(email)` de `tests/e2e/helpers/mailbox.ts`. Si varias historias necesitan entrar, mueve la función `signIn` de `us-01-sign-in.spec.ts` a un helper en lugar de copiarla.
- Si la prueba depende de la fecha, fija el reloj del navegador con `page.clock` en lugar de depender del día real.

## 4. Ejecuta

```bash
npm test
```

```bash
npm run test:integration
```

```bash
npm run test:e2e
```

Ejecuta los niveles que hayas tocado. Si Supabase local no está disponible, dilo claramente en lugar de dar las pruebas por buenas. Si una e2e falla, `npx playwright show-report` muestra capturas y la traza.

## Antes de terminar

- [ ] Cada criterio de aceptación de la historia tiene al menos una prueba e2e.
- [ ] Cada tabla nueva tiene su prueba de que otro hogar no puede leer ni modificar sus datos.
- [ ] La lógica nueva de `src/domain/` tiene pruebas unitarias con los casos límite de fechas.
- [ ] Si era un fallo, la prueba falló antes del arreglo y pasa después.
- [ ] Nombres en español, sin `.skip` ni `.only`.
- [ ] Las pruebas que tocan pasan, y se ha dicho cuáles no se pudieron ejecutar y por qué.
