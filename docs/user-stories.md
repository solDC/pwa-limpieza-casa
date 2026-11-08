# Historias de usuario del MVP

Formato: *As a [user type], I want [feature], so that [benefit].* Debajo de cada historia, los criterios de aceptación.

Cada historia tiene su issue en GitHub, enlazado en la tabla de resumen. Al añadir una historia nueva, se crea su issue y se añade aquí el enlace.

**Prioridad:**
- **Must have:** imprescindible para la demo.
- **Nice to have:** conviene tenerla, pero se puede recortar si falta tiempo. Una historia no tiene criterios opcionales: lo opcional va en una historia aparte con esta prioridad.

## El MVP acotado

Una app para mi casa, con las tareas que uso de verdad ya creadas al entrar. Se mantienen la base de datos y el inicio de sesión porque ya estaban hechos. Lo esencial: ver qué toca, marcarlo como hecho y guardar un histórico de cada vuelta (completada, parcial o no completada).

## Resumen

| ID | Historia | Prioridad | Estado | Issue |
|---|---|---|---|---|
| US-01 | Entrar con enlace mágico | Must have | Hecha | [#2](https://github.com/solDC/pwa-limpieza-casa/issues/2) |
| US-02 | Hogar creado automáticamente | Must have | Hecha | [#3](https://github.com/solDC/pwa-limpieza-casa/issues/3) |
| US-03 | Cerrar sesión | Nice to have | Hecha | [#4](https://github.com/solDC/pwa-limpieza-casa/issues/4) |
| US-26 | Entrar con código desde la app instalada | Must have | Hecha | [#29](https://github.com/solDC/pwa-limpieza-casa/issues/29) |
| US-27 | Mis tareas por defecto | Must have | Hecha | [#36](https://github.com/solDC/pwa-limpieza-casa/issues/36) |
| US-28 | Frecuencias | Must have | Pendiente | [#37](https://github.com/solDC/pwa-limpieza-casa/issues/37) |
| US-29 | Qué toca | Must have | Pendiente | [#38](https://github.com/solDC/pwa-limpieza-casa/issues/38) |
| US-30 | Marcar como hecha | Must have | Pendiente | [#39](https://github.com/solDC/pwa-limpieza-casa/issues/39) |
| US-31 | Histórico de cada vuelta | Must have | Pendiente | [#40](https://github.com/solDC/pwa-limpieza-casa/issues/40) |
| US-32 | Cancelar una tarea | Nice to have | Pendiente | [#41](https://github.com/solDC/pwa-limpieza-casa/issues/41) |
| US-33 | Añadir una tarea | Nice to have | Pendiente | [#42](https://github.com/solDC/pwa-limpieza-casa/issues/42) |
| US-34 | Elegir el peso de las partes | Nice to have | Pendiente | [#43](https://github.com/solDC/pwa-limpieza-casa/issues/43) |
| US-38 | Cambiar la fecha de una tarea | Must have | Pendiente | [#54](https://github.com/solDC/pwa-limpieza-casa/issues/54) |

## Conceptos

- **Tarea:** algo que hay que mantener. Puede ser **una acción** («Aspirar cosas de Cati», «Cristales y espejos») o **un lugar** de la casa («Baño», «Jardín», «Planta de arriba»). Puede tener **partes**, que a su vez pueden ser **lugares** («Superficies»: cocina, salón, dormitorio) o **acciones** («Baño»: inodoro, ducha, espejo), cada una con su **peso** en porcentaje; los pesos suman 100 %.
- **Vuelta:** cada vez que toca hacer una tarea. Empieza cuando toca y se cierra con uno de estos estados:

  | Estado | Cuándo |
  |---|---|
  | **Completada** | Se han hecho la tarea entera o todas sus partes |
  | **Parcial (X %)** | Se acaba el plazo con algunas partes hechas; X es la suma de sus pesos |
  | **No completada** | Se acaba el plazo sin hacer nada |

- **Frecuencias:**

  | Tipo | Ejemplo | Cuándo toca | Cuándo se acaba el plazo |
  |---|---|---|---|
  | **Semanal, en fin de semana** | Superficies | Cada sábado y domingo | El domingo por la noche |
  | **Fin de semana cada 15 días** | Aspirar cosas de Cati | Un fin de semana sí y otro no, empezando el 5-6 de diciembre de 2026 | El domingo por la noche |
  | **Cada N días desde la última vez** | Baño (3), Cristales y espejos (30) | N días después del día en que se terminó la última vez | Nunca: si no se hace, aparece como retrasada (X días) hasta que se hace. No hay «no completada» |
  | **Puntual** | Cepillar suelo, Limpiar juntas | Desde que se crea | Nunca: pendiente hasta que se hace, y después desaparece |

- Los días son **fechas locales sin hora**. Llegar a la fecha prevista **nunca** marca una tarea como hecha.

## Cuenta

### US-01 · Entrar con enlace mágico (Must have)
As a new user,
I want to sign in with a link sent to my email,
so that I can use the app without creating or remembering a password.
- Escribo mi email y recibo un enlace; al abrirlo entro en la app.
- La sesión se mantiene al cerrar y volver a abrir la app.

### US-02 · Hogar creado automáticamente (Must have)
As a new user,
I want my household to be created automatically the first time I sign in,
so that I can start adding tasks right away.
- Al primer inicio de sesión se crean el hogar y mi pertenencia a él.
- Solo veo los datos de mi hogar, garantizado por RLS.

### US-03 · Cerrar sesión (Nice to have)
As a user,
I want to sign out,
so that nobody else can see my household on a shared device.

### US-26 · Entrar con código desde la app instalada (Must have)
As a user with the app installed on my iPhone,
I want to sign in by typing the code from the email,
so that I can sign in inside the installed app, where the email link doesn't work.
- El email trae el enlace y también un código de 6 dígitos.
- En la pantalla «Revisa tu correo» puedo escribir el código y entrar sin salir de la app.
- El enlace sigue funcionando igual que antes: no hace falta escribir el código.
- Si el código es incorrecto o ha caducado, la app lo dice y deja intentarlo de nuevo o pedir otro email.

*Por qué:* en iOS, una app instalada en la pantalla de inicio guarda su sesión aparte de Safari, y el enlace del email se abre en Safari. El código es una alternativa al enlace, no un paso más.

## Tareas

### US-27 · Mis tareas por defecto (Must have)
As the person who looks after my home,
I want my usual cleaning tasks to be there when I sign in,
so that I can start using the app without setting anything up.
- Al crearse mi hogar se crean estas tareas, con su frecuencia:

  | Tarea | Partes (peso) | Frecuencia |
  |---|---|---|
  | Superficies | Cocina (50 %), Salón (25 %), Dormitorio (25 %) | Semanal, en fin de semana |
  | Baño | — | Cada 3 días desde la última vez |
  | Aspirar cosas de Cati | — | Fin de semana cada 15 días, desde el 5-6 de diciembre de 2026 |
  | Cristales y espejos | — | Cada 30 días desde la última vez |
  | Cepillar suelo | — | Puntual |
  | Limpiar juntas | — | Puntual |
- Mi hogar, que ya existe, también las recibe.
- Se crean una sola vez: si cancelo una, no vuelve a aparecer.

### US-28 · Frecuencias (Must have)
As a user,
I want each task to be due according to its own rhythm,
so that the app tells me what to do when it's really time to do it.
- Las cuatro frecuencias funcionan como dice la tabla de «Conceptos».
- En «cada N días», la próxima fecha se cuenta desde el día en que se terminó la tarea, no desde la fecha prevista.
- La primera vez, una tarea de «cada N días» toca desde el día en que se crea.

### US-29 · Qué toca (Must have)
As a user,
I want to see on the home screen what is due and what is late,
so that I know what to do without searching.
- En Inicio veo las tareas que tocan hoy (las de fin de semana, el sábado y el domingo) y las pendientes puntuales.
- Las retrasadas muestran cuántos días de retraso llevan.
- Las tareas con partes muestran su progreso en la vuelta actual («Cocina hecha · 50 %»).
- Las que no tocan todavía se ven aparte, con la fecha en que tocarán.

### US-30 · Marcar como hecha (Must have)
As a user,
I want to mark a task, or one of its parts, as done,
so that the app knows what I have already cleaned.
- Puedo marcar una tarea entera; si tiene partes, también cada parte por separado.
- Al marcar todas las partes, la vuelta queda completada.
- Al completar una vuelta, la tarea deja de aparecer en «Qué toca» y se calcula cuándo vuelve a tocar.
- Se apunta como día de hecho el día en que la marco.
- Si falla el guardado (sin conexión o un error), la app lo dice y no la muestra como hecha.

### US-31 · Histórico de cada vuelta (Must have)
As a user,
I want to see the history of every round of every task,
so that I know how well I'm keeping up with the cleaning.
- Hay una pantalla «Histórico» con cada vuelta cerrada, de la más reciente a la más antigua: tarea, fechas y estado.
- El estado es **Completada**, **Parcial (X %)** o **No completada**, como dice la tabla de «Conceptos».
- Las vueltas de fin de semana que acaban el domingo sin terminar quedan como parcial o no completada sin que yo haga nada.
- El porcentaje parcial es la suma de los pesos de las partes hechas.

### US-32 · Cancelar una tarea (Nice to have)
As a user,
I want to cancel a task I no longer do,
so that it stops appearing without losing its history.
- La app pide confirmación antes de cancelar.
- Una tarea cancelada deja de aparecer en «Qué toca».
- Su histórico se conserva y se sigue viendo en «Histórico».

### US-33 · Añadir una tarea (Nice to have)
As a user,
I want to add a new task with its frequency and optional parts,
so that the app covers new things I need to keep up with.
- No se puede guardar una tarea sin nombre o sin frecuencia (una de las cuatro de «Conceptos»).
- Las partes son opcionales.
- Si tiene partes, todas cuentan lo mismo: los pesos se reparten a partes iguales (elegirlos es la US-34).

### US-34 · Elegir el peso de las partes (Nice to have)
As a user,
I want to choose how much each part of a task counts,
so that the partial percentage reflects the real effort of each part.
- Al crear una tarea con partes, puedo poner el peso de cada una en porcentaje; si no lo cambio, se reparten a partes iguales.
- No se puede guardar la tarea si los pesos no suman 100 %.

*Depende de la US-33 (añadir una tarea).*

### US-38 · Cambiar la fecha de una tarea (Must have)
Como usuario,
quiero poner o cambiar cuándo toca una tarea,
para que la app se adapte a mis planes.
- En una tarea puntual puedo ponerle una fecha, cambiarla o quitarla; sin fecha se ve como «Sin fecha» y nunca tiene retraso.
- Una puntual con fecha que llega a esa fecha sin hacerse aparece como retrasada.
- En una tarea de cada N días puedo cambiar cuándo toca la próxima vez; las siguientes se cuentan desde el día en que se termine, como siempre.
- En una tarea de fin de semana puedo mover su vuelta a otro finde, adelantándola o retrasándola. En las de cada 15 días se mueve todo el calendario: las siguientes son cada 15 días desde el finde nuevo.
- Solo se puede elegir hoy o una fecha futura.

*Depende de la US-30: para cambiar una fecha hace falta poder guardar cambios en las tareas.*

## Historias anteriores

Las historias US-04 a US-25 eran del MVP original, más amplio. Así quedan con el MVP acotado:

| Qué pasa | Historias |
|---|---|
| **Absorbidas** por las nuevas | US-05 Partes, US-09 a US-11 Frecuencias → US-28 · US-12 y US-13 Marcar → US-30 · US-16 a US-18 Qué toca → US-29 · US-25 Aviso si falla el guardado → US-30 |
| **Sustituidas** | US-04 Crear → US-33 · US-07 Borrar → US-32 (cancelar, para conservar el histórico) · US-20 Historial → US-31 · US-22 y US-23 Datos de ejemplo → US-27 (mis tareas por defecto) |
| **Al backlog** | US-06, US-08, US-14, US-15, US-19, US-21 y US-35 (abajo) |
| **Ya cumplida** | US-24 Instalar la app: la PWA ya se puede instalar |

## Backlog

Para una versión futura.

### US-06 · Editar una tarea · [#7](https://github.com/solDC/pwa-limpieza-casa/issues/7)
As a user,
I want to edit a task's name, parts and frequency,
so that it reflects how I actually look after my home.
- Editar una tarea no borra el progreso de la vuelta actual ni el histórico.

### US-08 · Ver todas mis tareas · [#9](https://github.com/solDC/pwa-limpieza-casa/issues/9)
As a user,
I want to see all my tasks with their frequency and next due date,
so that I have an overview of everything in my home.

### US-14 · Elegir cuándo lo hice · [#15](https://github.com/solDC/pwa-limpieza-casa/issues/15)
As a user,
I want to say when I actually did it (today, yesterday or another date),
so that the history and next dates are accurate even if I log it late.
- No se admiten fechas futuras.
- Se guarda la fecha en que se hizo y, aparte, la fecha en que se apuntó.

### US-15 · Deshacer · [#16](https://github.com/solDC/pwa-limpieza-casa/issues/16)
As a user,
I want to undo the last thing I marked,
so that I can fix a mistake immediately.
- Tras marcar aparece un aviso con el botón «Deshacer» durante unos segundos.

### US-19 · Pantalla vacía · [#20](https://github.com/solDC/pwa-limpieza-casa/issues/20)
As a new user,
I want a helpful empty state when I have no tasks,
so that I know how to start (create a task or load the demo).

### US-21 · Historial de una tarea · [#22](https://github.com/solDC/pwa-limpieza-casa/issues/22)
As a user,
I want to see the history of a single task,
so that I can see how often I really do it.

### US-35 · Rediseño de la interfaz · [#44](https://github.com/solDC/pwa-limpieza-casa/issues/44)
As a user,
I want the app to have a visual design I like,
so that I enjoy using it every day.
- Una paleta de colores nueva, elegida por Sol, sustituye al verde actual.
- Todas las pantallas (Entrar, Revisa tu correo, Inicio y las nuevas) usan el diseño nuevo.
- El icono de la app (una casa con un trapito) usa el diseño nuevo y sustituye al check, en el iPhone, en Android y en la pestaña del navegador.
- Se ve bien en el móvil y en el ordenador.

*Para concretar antes de implementarla: colores, tipografía y estilo. Es un trabajo de diseño que puede acabar en varias historias. El icono de la pantalla de inicio no puede estar animado.*

### US-36 · Tener varias casas y cambiar entre ellas · [#50](https://github.com/solDC/pwa-limpieza-casa/issues/50)
As a user,
I want to have more than one home and switch between them,
so that I can keep track of the cleaning of each one.
- Puedo crear otra casa, con un nombre; se crea con las tareas por defecto de la US-27.
- Puedo cambiar de casa desde el Inicio, y la app recuerda la última que usé.
- Cada casa tiene sus propias tareas y su histórico.

*Para usar otras tareas en una casa nueva: cancelar las que no sirvan (US-32) y añadir las nuevas (US-33).*

### US-37 · Archivar una casa · [#51](https://github.com/solDC/pwa-limpieza-casa/issues/51)
As a user,
I want to archive a home I no longer use, and recover it if I need it again,
so that it stops appearing without losing its history.
- La app pide confirmación antes de archivar.
- Una casa archivada deja de aparecer al cambiar de casa, pero conserva sus tareas y su histórico.
- Puedo ver mis casas archivadas y recuperar cualquiera.
- No puedo archivar mi única casa activa.

*Depende de la US-36. Cuando se pueda compartir una casa (ver «Visión»), solo quien la creó podrá archivarla; las demás personas solo podrán salir de ella.*

## Visión

Ideas para más adelante, todavía sin historia.

- **Compartir la casa con otras personas:** invitar a alguien por email; las dos personas ven las mismas tareas, pueden marcarlas y el histórico dice quién hizo cada cosa; quien creó la casa puede quitar a otras personas. La base de datos ya está preparada: todo cuelga del hogar y un hogar puede tener varios miembros.
