# Historias de usuario del MVP

Formato: *As a [user type], I want [feature], so that [benefit].* Debajo de cada historia, los criterios de aceptación.

**Prioridad:**
- **Must:** imprescindible para la demo.
- **Should:** conviene tenerla, pero se puede recortar si falta tiempo.

## Resumen

| ID | Historia | Prioridad | Issue |
|---|---|---|---|
| US-01 | Entrar con enlace mágico | Must | [#2](https://github.com/solDC/pwa-limpieza-casa/issues/2) |
| US-02 | Hogar creado automáticamente | Must | [#3](https://github.com/solDC/pwa-limpieza-casa/issues/3) |
| US-03 | Cerrar sesión | Should | [#4](https://github.com/solDC/pwa-limpieza-casa/issues/4) |
| US-04 | Crear una tarea | Must | [#5](https://github.com/solDC/pwa-limpieza-casa/issues/5) |
| US-05 | Dividir una tarea en partes | Must | [#6](https://github.com/solDC/pwa-limpieza-casa/issues/6) |
| US-06 | Editar una tarea | Must | [#7](https://github.com/solDC/pwa-limpieza-casa/issues/7) |
| US-07 | Borrar una tarea | Should | [#8](https://github.com/solDC/pwa-limpieza-casa/issues/8) |
| US-08 | Ver todas mis tareas | Must | [#9](https://github.com/solDC/pwa-limpieza-casa/issues/9) |
| US-09 | Frecuencia por calendario | Must | [#10](https://github.com/solDC/pwa-limpieza-casa/issues/10) |
| US-10 | Frecuencia por intervalo | Must | [#11](https://github.com/solDC/pwa-limpieza-casa/issues/11) |
| US-11 | Tarea puntual | Should | [#12](https://github.com/solDC/pwa-limpieza-casa/issues/12) |
| US-12 | Marcar una tarea entera | Must | [#13](https://github.com/solDC/pwa-limpieza-casa/issues/13) |
| US-13 | Marcar una parte | Must | [#14](https://github.com/solDC/pwa-limpieza-casa/issues/14) |
| US-14 | Elegir cuándo lo hice | Must | [#15](https://github.com/solDC/pwa-limpieza-casa/issues/15) |
| US-15 | Deshacer | Must | [#16](https://github.com/solDC/pwa-limpieza-casa/issues/16) |
| US-16 | Qué toca hoy | Must | [#17](https://github.com/solDC/pwa-limpieza-casa/issues/17) |
| US-17 | Qué se ha retrasado | Must | [#18](https://github.com/solDC/pwa-limpieza-casa/issues/18) |
| US-18 | Qué está a medias | Must | [#19](https://github.com/solDC/pwa-limpieza-casa/issues/19) |
| US-19 | Pantalla vacía | Should | [#20](https://github.com/solDC/pwa-limpieza-casa/issues/20) |
| US-20 | Ver lo que he hecho | Must | [#21](https://github.com/solDC/pwa-limpieza-casa/issues/21) |
| US-21 | Historial de una tarea | Should | [#22](https://github.com/solDC/pwa-limpieza-casa/issues/22) |
| US-22 | Cargar el ejemplo | Should | [#23](https://github.com/solDC/pwa-limpieza-casa/issues/23) |
| US-23 | Quitar el ejemplo | Should | [#24](https://github.com/solDC/pwa-limpieza-casa/issues/24) |
| US-24 | Instalar la app | Should | [#25](https://github.com/solDC/pwa-limpieza-casa/issues/25) |
| US-25 | Sin conexión | Must | [#26](https://github.com/solDC/pwa-limpieza-casa/issues/26) |

## Cuenta

### US-01 · Entrar con enlace mágico (Must)
As a new user,
I want to sign in with a link sent to my email,
so that I can use the app without creating or remembering a password.
- Escribo mi email y recibo un enlace; al abrirlo entro en la app.
- La sesión se mantiene al cerrar y volver a abrir la app.

### US-02 · Hogar creado automáticamente (Must)
As a new user,
I want my household to be created automatically the first time I sign in,
so that I can start adding tasks right away.
- Al primer inicio de sesión se crean el hogar y mi pertenencia a él.
- Solo veo los datos de mi hogar, garantizado por RLS.

### US-03 · Cerrar sesión (Should)
As a user,
I want to sign out,
so that nobody else can see my household on a shared device.

## Tareas

### US-04 · Crear una tarea (Must)
As a user,
I want to create a task with a name and a frequency,
so that the app knows what I need to keep up with and when.
- La tarea puede ser una acción («Cristales») o un espacio («Baño»).
- No puedo guardar una tarea sin nombre o sin frecuencia.

### US-05 · Dividir una tarea en partes (Must)
As a user,
I want to optionally split a task into parts (rooms or specific jobs),
so that I can do it bit by bit instead of all at once.
- Las partes son opcionales y se pueden añadir, renombrar o quitar.

### US-06 · Editar una tarea (Must)
As a user,
I want to edit a task's name, parts and frequency,
so that it reflects how I actually look after my home.
- Editar una tarea no borra el progreso de la ronda actual ni el historial.

### US-07 · Borrar una tarea (Should)
As a user,
I want to delete a task I no longer need,
so that my list only shows what matters.
- La app pide confirmación antes de borrar.

### US-08 · Ver todas mis tareas (Must)
As a user,
I want to see all my tasks with their frequency and next due date,
so that I have an overview of everything in my home.

## Frecuencias

### US-09 · Frecuencia por calendario (Must)
As a user,
I want to schedule a task on fixed calendar days (e.g. every Saturday, the 1st of each month),
so that it fits my weekly or monthly routine.

### US-10 · Frecuencia por intervalo (Must)
As a user,
I want a task to be due a number of days after I last finished it, with an editable interval,
so that the schedule adapts when I do it early or late.
- La próxima fecha se calcula desde la última vez que se terminó, no desde la fecha prevista.

### US-11 · Tarea puntual (Should)
As a user,
I want to create a one-off task,
so that I can track something that doesn't repeat.

## Marcar como hecho

### US-12 · Marcar una tarea entera (Must)
As a user,
I want to mark a task as done,
so that it disappears from today's list and its next date is calculated.

### US-13 · Marcar una parte (Must)
As a user,
I want to mark individual parts as done and see the progress (e.g. 2 of 4),
so that I get credit for partial work.
- El progreso se mantiene aunque cambie el día.
- Al completar todas las partes, la ronda se cierra y se calcula la siguiente fecha.

### US-14 · Elegir cuándo lo hice (Must)
As a user,
I want to say when I actually did it (today, yesterday or another date),
so that the history and next dates are accurate even if I log it late.
- No se admiten fechas futuras.
- Se guarda la fecha en que se hizo y, aparte, la fecha en que se apuntó.

### US-15 · Deshacer (Must)
As a user,
I want to undo the last thing I marked,
so that I can fix a mistake immediately.
- Tras marcar aparece un aviso con el botón «Deshacer» durante unos segundos.

## Inicio

### US-16 · Qué toca hoy (Must)
As a user,
I want to see on the home screen the tasks due today,
so that I know what to do without searching.

### US-17 · Qué se ha retrasado (Must)
As a user,
I want to see overdue tasks and how many days late they are,
so that I can catch up on what I've been putting off.

### US-18 · Qué está a medias (Must)
As a user,
I want to see tasks in progress with their progress bar,
so that I can finish what I started.

### US-19 · Pantalla vacía (Should)
As a new user,
I want a helpful empty state when I have no tasks,
so that I know how to start (create a task or load the demo).

## Historial

### US-20 · Ver lo que he hecho (Must)
As a user,
I want to see a chronological history of what was done, with the real date,
so that I can check when I last did something.

### US-21 · Historial de una tarea (Should)
As a user,
I want to see the history of a single task,
so that I can see how often I really do it.

## Datos de ejemplo

### US-22 · Cargar el ejemplo (Should, muy útil para la demo)
As a new user,
I want to load a sample household (including Cati's tasks),
so that I can try the app without setting everything up.

### US-23 · Quitar el ejemplo (Should)
As a user,
I want to remove the sample data without affecting my own tasks,
so that I can start using the app for real.

## PWA y conexión

### US-24 · Instalar la app (Should)
As a user,
I want to install the app on my phone or computer,
so that I can open it like a native app.

### US-25 · Sin conexión (Must)
As a user,
I want a clear message when there's no internet connection,
so that I don't think something was saved when it wasn't.
- Si un guardado falla, la app lo dice y no muestra la acción como hecha.

## Decisiones pendientes

1. **Datos de ejemplo frente a la regla «no mezclar con los datos reales» de `CLAUDE.md`.** Con Supabase, los datos de ejemplo se guardan en el hogar del usuario. Propuesta: marcarlos (por ejemplo, con una columna `is_demo`) para que US-23 los borre sin tocar las tareas propias.
2. **Qué pasa con el historial al borrar una tarea (US-07).** Opciones: borrarlo junto con la tarea o conservarlo y archivar la tarea en lugar de borrarla.
