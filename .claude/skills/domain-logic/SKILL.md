---
name: domain-logic
description: Escribir o cambiar lógica pura en src/domain/ — fechas de días ('YYYY-MM-DD'), motor de frecuencias (calendario, intervalo, puntual), próxima fecha, retraso, rondas y progreso de partes — con sus pruebas unitarias en tests/unit/domain/ y los casos límite de fechas. Úsala para US-09, US-10, US-11, US-13, US-16, US-17, US-18 o cualquier cálculo de «qué toca», «cuántos días de retraso» o «2 de 4».
---

# Lógica de dominio (TypeScript puro)

`src/domain/` es el corazón de la app y la única parte que se prueba sin navegador ni base de datos. Recibe datos y devuelve datos.

## Reglas que no se negocian

- **Nada de imports** de React, `@supabase/supabase-js`, `storage/`, `features/`, `components/` ni APIs del navegador (`window`, `localStorage`, `Intl` de la zona del usuario…). Comprueba antes de terminar:
  ```
  grep -rnE "from '(react|@supabase|\.\./(storage|features|components))" src/domain/ || echo ok
  ```
- **«Hoy» se recibe como parámetro** (`today: LocalDate`), nunca se calcula dentro con `new Date()`. Así las pruebas fijan el día y el resultado no depende de cuándo se ejecuten.
- **Los días son `'YYYY-MM-DD'`**, no `Date` con hora. Define (si no existe ya) en `src/domain/local-date.ts`:
  ```ts
  /** Día local sin hora, 'YYYY-MM-DD'. Igual que el tipo date de PostgreSQL. */
  export type LocalDate = string & { readonly __brand: 'LocalDate' }
  ```
  con funciones como `parseLocalDate`, `addDays`, `daysBetween`, `dayOfWeek`, `compareLocalDates`. Haz la aritmética en UTC (`Date.UTC(y, m - 1, d)` y `getUTC…`), que no tiene cambio de hora, y convierte de vuelta a `'YYYY-MM-DD'`. Nunca `new Date('2026-03-29')` + `getDate()` local.
- Llegar a la fecha prevista **nunca** marca una tarea como hecha: el dominio calcula estados («toca hoy», «retrasada N días»), no crea completions.
- Funciones puras y sin estado; tipos exportados en `camelCase`; nombres en inglés; comentarios en español.
- Prefiere uniones discriminadas para las variantes:
  ```ts
  export type Frequency =
    | { kind: 'calendar'; … }
    | { kind: 'interval'; everyDays: number }
    | { kind: 'once' }
  ```
  y `switch` exhaustivo (con `const _exhaustive: never = frequency`), para que TypeScript avise si se añade un tipo.

## Semántica del producto (README, «Cómo se modelan las tareas»)

- **Intervalo:** la próxima fecha = última vez que se **terminó** (ronda cerrada) + N días, no la fecha prevista + N (US-10).
- **Calendario:** la siguiente fecha del calendario a partir de la última ronda cerrada (o de la creación si no hay ninguna).
- **Puntual:** sin repetición; una vez hecha, no vuelve.
- **Partes:** progreso = partes hechas en la ronda actual / total. La ronda se cierra al completar todas, y es entonces cuando cuenta como «terminada» para calcular la siguiente fecha. El progreso no se pierde al cambiar de día (US-13).
- **Sin partes:** hecha o no hecha.
- La fecha que cuenta es `performedAt` (cuándo se hizo), no `createdAt` (cuándo se apuntó) (US-14).
- No se admiten fechas futuras como `performedAt`.

Si algo no está claro en estas reglas (por ejemplo, «el día 31 de cada mes» en febrero), **no lo decidas en silencio**: pregunta o propón una opción, déjalo en un comentario y en el CHANGELOG.

## Pruebas unitarias

- Misma ruta: `src/domain/frequency.ts` → `tests/unit/domain/frequency.test.ts`.
- Vitest (`describe`, `it`, `expect`), nombres en español, con el ID de la historia cuando aplique.
- Fechas escritas como literales `'2026-02-28'`, nunca con `new Date()`.
- **Casos límite obligatorios** cuando haya fechas:
  - fin de mes (31 → 1, 30 de abril, «día 31» en meses de 30 días);
  - febrero en año bisiesto (`'2028-02-29'`) y no bisiesto (`'2027-02-28'`), y el 29-F + 1 año;
  - fin de año (`'2026-12-31'` + 1);
  - cambio de hora en España (`'2026-03-29'` y `'2026-10-25'`): `addDays` y `daysBetween` dan exactamente 1;
  - intervalo hecho antes y después de la fecha prevista (US-10);
  - retraso de 0, 1 y muchos días;
  - ronda con partes a medias que cruza de día.
- Usa `it.each` para tablas de casos.

```
npm test
npm run build   # tsc estricto
```
