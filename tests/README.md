# Pruebas

Las pruebas automáticas comprueban que la app hace lo que dicen las historias de usuario y que, al añadir algo nuevo, no se rompe lo que ya funcionaba (pruebas de regresión). Se ejecutan solas en GitHub en cada pull request.

## Tres niveles

| Carpeta | Qué prueba | Herramienta | Comando |
|---|---|---|---|
| `unit/` | La lógica pura de `src/domain/`: frecuencias, próximas fechas, progreso. Rápidas y sin red. | Vitest | `npm test` |
| `integration/` | La base de datos: tablas, reglas de seguridad (RLS) y funciones. Necesitan Supabase en local. | Vitest | `npm run test:integration` |
| `e2e/` | La app entera en un navegador, como la usaría una persona: los criterios de aceptación de cada historia. | Playwright | `npm run test:e2e` |

`npm run test:all` ejecuta todo.

Las de integración y casi todas las e2e necesitan **Supabase en local** arrancado (`npx supabase start`) y el `.env` creado (`npm run env:local`). Ver el README.

## Convenciones

- **Unitarias:** reflejan la ruta del código que prueban. `src/domain/frequency.ts` → `tests/unit/domain/frequency.test.ts`.
- **E2E:** un archivo por historia, con su ID: `tests/e2e/us-01-sign-in.spec.ts`. Cada criterio de aceptación es al menos una prueba (`test(...)`), y el nombre de la prueba dice qué comprueba, en español.
- **Integración:** un archivo por tabla o grupo de tablas: `tests/integration/households.test.ts`. Se conectan a PostgreSQL directamente y usan `asUser()` (en `helpers/database.ts`) para hacerse pasar por un usuario y comprobar que las reglas de seguridad funcionan. Todo lo que hacen como usuario se deshace al terminar.
- **E2E con inicio de sesión:** el enlace mágico se lee del buzón de pruebas de Supabase local con `waitForMagicLink()` (en `e2e/helpers/mailbox.ts`). Cada prueba usa un email único (`uniqueEmail()`), así no se mezclan los usuarios.
- Una historia no está terminada hasta que sus criterios de aceptación tienen prueba.
- Si se encuentra un fallo, primero se escribe la prueba que lo reproduce y luego se arregla.

## Cómo ejecutarlas

Dentro del dev container (o en tu ordenador con Node 22):

```
npm test
npm run test:integration
npm run test:e2e
```

Desde fuera, con Docker:

```
docker compose exec app npm test
docker compose exec app npm run test:e2e
```

(Con Docker Compose, Supabase local debe estar arrancado en tu ordenador.)

Las pruebas e2e compilan la app y la sirven en http://localhost:4173 (la versión compilada, la más parecida a Vercel). Si una falla, `npx playwright show-report` abre un informe con capturas y una traza paso a paso.
