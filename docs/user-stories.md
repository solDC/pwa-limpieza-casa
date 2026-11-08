# Historias de usuario del MVP

Formato: *Como [tipo de usuario], quiero [qué], para [para qué].* Debajo de cada historia, los criterios de aceptación.

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
Como usuario nuevo,
quiero entrar con un enlace que me llega por email,
para usar la app sin crear ni recordar una contraseña.
- Escribo mi email y recibo un enlace; al abrirlo entro en la app.
- La sesión se mantiene al cerrar y volver a abrir la app.

### US-02 · Hogar creado automáticamente (Must have)
Como usuario nuevo,
quiero que mi hogar se cree solo la primera vez que entro,
para empezar a usar la app enseguida.
- Al primer inicio de sesión se crean el hogar y mi pertenencia a él.
- Solo veo los datos de mi hogar, garantizado por RLS.

### US-03 · Cerrar sesión (Nice to have)
Como usuario,
quiero cerrar sesión,
para que nadie más vea mi hogar en un dispositivo compartido.

### US-26 · Entrar con código desde la app instalada (Must have)
Como usuario con la app instalada en el iPhone,
quiero entrar escribiendo el código del email,
para entrar en la app instalada, donde el enlace del email no funciona.
- El email trae el enlace y también un código de 6 dígitos.
- En la pantalla «Revisa tu correo» puedo escribir el código y entrar sin salir de la app.
- El enlace sigue funcionando igual que antes: no hace falta escribir el código.
- Si el código es incorrecto o ha caducado, la app lo dice y deja intentarlo de nuevo o pedir otro email.

*Por qué:* en iOS, una app instalada en la pantalla de inicio guarda su sesión aparte de Safari, y el enlace del email se abre en Safari. El código es una alternativa al enlace, no un paso más.

## Tareas

### US-27 · Mis tareas por defecto (Must have)
Como persona que cuida de mi casa,
quiero que mis tareas de limpieza habituales estén ahí al entrar,
para empezar a usar la app sin configurar nada.
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
Como usuario,
quiero que cada tarea toque según su propio ritmo,
para que la app me diga qué hacer cuando de verdad toca.
- Las cuatro frecuencias funcionan como dice la tabla de «Conceptos».
- En «cada N días», la próxima fecha se cuenta desde el día en que se terminó la tarea, no desde la fecha prevista.
- La primera vez, una tarea de «cada N días» toca desde el día en que se crea.

### US-29 · Qué toca (Must have)
Como usuario,
quiero ver en el Inicio qué toca y qué está retrasado,
para saber qué hacer sin buscar.
- En Inicio veo las tareas que tocan hoy (las de fin de semana, el sábado y el domingo) y las pendientes puntuales.
- Las retrasadas muestran cuántos días de retraso llevan.
- Las tareas con partes muestran su progreso en la vuelta actual («Cocina hecha · 50 %»).
- Las que no tocan todavía se ven aparte, con la fecha en que tocarán.

### US-30 · Marcar como hecha (Must have)
Como usuario,
quiero marcar como hecha una tarea, o una de sus partes,
para que la app sepa qué he limpiado ya.
- Puedo marcar una tarea entera; si tiene partes, también cada parte por separado.
- Al marcar todas las partes, la vuelta queda completada.
- Al completar una vuelta, la tarea deja de aparecer en «Qué toca» y se calcula cuándo vuelve a tocar.
- Se apunta como día de hecho el día en que la marco.
- Si falla el guardado (sin conexión o un error), la app lo dice y no la muestra como hecha.

### US-31 · Histórico de cada vuelta (Must have)
Como usuario,
quiero ver el histórico de cada vuelta de cada tarea,
para saber cómo voy con la limpieza.
- Hay una pantalla «Histórico» con cada vuelta cerrada, de la más reciente a la más antigua: tarea, fechas y estado.
- El estado es **Completada**, **Parcial (X %)** o **No completada**, como dice la tabla de «Conceptos».
- Las vueltas de fin de semana que acaban el domingo sin terminar quedan como parcial o no completada sin que yo haga nada.
- El porcentaje parcial es la suma de los pesos de las partes hechas.

### US-32 · Cancelar una tarea (Nice to have)
Como usuario,
quiero cancelar una tarea que ya no hago,
para que deje de aparecer sin perder su histórico.
- La app pide confirmación antes de cancelar.
- Una tarea cancelada deja de aparecer en «Qué toca».
- Su histórico se conserva y se sigue viendo en «Histórico».

### US-33 · Añadir una tarea (Nice to have)
Como usuario,
quiero añadir una tarea nueva, con su frecuencia y, si quiero, sus partes,
para que la app incluya otras cosas que tengo que mantener.
- No se puede guardar una tarea sin nombre o sin frecuencia (una de las cuatro de «Conceptos»).
- Las partes son opcionales.
- Si tiene partes, todas cuentan lo mismo: los pesos se reparten a partes iguales (elegirlos es la US-34).

### US-34 · Elegir el peso de las partes (Nice to have)
Como usuario,
quiero elegir cuánto cuenta cada parte de una tarea,
para que el porcentaje parcial refleje el esfuerzo real de cada parte.
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
Como usuario,
quiero cambiar el nombre, las partes y la frecuencia de una tarea,
para que refleje cómo cuido de verdad mi casa.
- Editar una tarea no borra el progreso de la vuelta actual ni el histórico.

### US-08 · Ver todas mis tareas · [#9](https://github.com/solDC/pwa-limpieza-casa/issues/9)
Como usuario,
quiero ver todas mis tareas con su frecuencia y cuándo tocan,
para tener una visión de conjunto de mi casa.

### US-14 · Elegir cuándo lo hice · [#15](https://github.com/solDC/pwa-limpieza-casa/issues/15)
Como usuario,
quiero decir cuándo la hice de verdad (hoy, ayer u otro día),
para que el histórico y las próximas fechas sean correctos aunque lo apunte tarde.
- No se admiten fechas futuras.
- Se guarda la fecha en que se hizo y, aparte, la fecha en que se apuntó.

### US-15 · Deshacer · [#16](https://github.com/solDC/pwa-limpieza-casa/issues/16)
Como usuario,
quiero deshacer lo último que he marcado,
para corregir un error al momento.
- Tras marcar aparece un aviso con el botón «Deshacer» durante unos segundos.

### US-19 · Pantalla vacía · [#20](https://github.com/solDC/pwa-limpieza-casa/issues/20)
Como usuario nuevo,
quiero una pantalla que me oriente cuando no tengo tareas,
para saber cómo empezar.

### US-21 · Historial de una tarea · [#22](https://github.com/solDC/pwa-limpieza-casa/issues/22)
Como usuario,
quiero ver el histórico de una sola tarea,
para ver cada cuánto la hago de verdad.

### US-35 · Rediseño de la interfaz · [#44](https://github.com/solDC/pwa-limpieza-casa/issues/44)
Como usuario,
quiero que la app tenga un diseño que me guste,
para disfrutar usándola cada día.
- Una paleta de colores nueva, elegida por Sol, sustituye al verde actual.
- Todas las pantallas (Entrar, Revisa tu correo, Inicio y las nuevas) usan el diseño nuevo.
- El icono de la app (una casa con un trapito) usa el diseño nuevo y sustituye al check, en el iPhone, en Android y en la pestaña del navegador.
- Se ve bien en el móvil y en el ordenador.

*Para concretar antes de implementarla: colores, tipografía y estilo. Es un trabajo de diseño que puede acabar en varias historias. El icono de la pantalla de inicio no puede estar animado.*

### US-36 · Tener varias casas y cambiar entre ellas · [#50](https://github.com/solDC/pwa-limpieza-casa/issues/50)
Como usuario,
quiero tener más de una casa y cambiar entre ellas,
para llevar la limpieza de cada una.
- Puedo crear otra casa, con un nombre; se crea con las tareas por defecto de la US-27.
- Puedo cambiar de casa desde el Inicio, y la app recuerda la última que usé.
- Cada casa tiene sus propias tareas y su histórico.

*Para usar otras tareas en una casa nueva: cancelar las que no sirvan (US-32) y añadir las nuevas (US-33).*

### US-37 · Archivar una casa · [#51](https://github.com/solDC/pwa-limpieza-casa/issues/51)
Como usuario,
quiero archivar una casa que ya no uso, y recuperarla si la vuelvo a necesitar,
para que deje de aparecer sin perder su histórico.
- La app pide confirmación antes de archivar.
- Una casa archivada deja de aparecer al cambiar de casa, pero conserva sus tareas y su histórico.
- Puedo ver mis casas archivadas y recuperar cualquiera.
- No puedo archivar mi única casa activa.

*Depende de la US-36. Cuando se pueda compartir una casa (ver «Visión»), solo quien la creó podrá archivarla; las demás personas solo podrán salir de ella.*

## Visión

Ideas para más adelante, todavía sin historia.

- **Compartir la casa con otras personas:** invitar a alguien por email; las dos personas ven las mismas tareas, pueden marcarlas y el histórico dice quién hizo cada cosa; quien creó la casa puede quitar a otras personas. La base de datos ya está preparada: todo cuelga del hogar y un hogar puede tener varios miembros.
