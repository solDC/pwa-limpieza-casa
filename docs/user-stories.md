# Historias de usuario del MVP

Formato: *Como [tipo de usuario], quiero [qué], para [para qué].* Debajo de cada historia, los criterios de aceptación.

Cada historia tiene su issue en GitHub, enlazado en la tabla de resumen. Al añadir una historia nueva, se crea su issue y se añade aquí el enlace.

**Prioridad:**
- **Must have:** imprescindible para la demo.
- **Nice to have:** conviene tenerla, pero se puede recortar si falta tiempo. Una historia no tiene criterios opcionales: lo opcional va en una historia aparte con esta prioridad.

## El MVP acotado

Una app para mi casa, con las tareas que uso de verdad ya creadas al entrar. Se mantienen la base de datos y el inicio de sesión porque ya estaban hechos. Lo esencial: ver qué toca y marcarlo como hecho, entero o por partes, y poder cambiar cuándo toca. El histórico de cada vuelta queda en el backlog.

## Resumen

| ID | Historia | Prioridad | Estado | Issue |
|---|---|---|---|---|
| US-01 | Entrar con enlace mágico | Must have | Hecha | [#2](https://github.com/solDC/pwa-limpieza-casa/issues/2) |
| US-02 | Hogar creado automáticamente | Must have | Hecha | [#3](https://github.com/solDC/pwa-limpieza-casa/issues/3) |
| US-03 | Cerrar sesión | Nice to have | Hecha | [#4](https://github.com/solDC/pwa-limpieza-casa/issues/4) |
| US-26 | Entrar con código desde la app instalada | Must have | Hecha | [#29](https://github.com/solDC/pwa-limpieza-casa/issues/29) |
| US-27 | Mis tareas por defecto | Must have | Hecha | [#36](https://github.com/solDC/pwa-limpieza-casa/issues/36) |
| US-28 | Frecuencias | Must have | Hecha | [#37](https://github.com/solDC/pwa-limpieza-casa/issues/37) |
| US-29 | Qué toca | Must have | Hecha | [#38](https://github.com/solDC/pwa-limpieza-casa/issues/38) |
| US-30 | Marcar una tarea como hecha | Must have | Hecha | [#39](https://github.com/solDC/pwa-limpieza-casa/issues/39) |
| US-39 | Marcar una parte como hecha | Must have | Pendiente | [#57](https://github.com/solDC/pwa-limpieza-casa/issues/57) |
| US-32 | Cancelar una tarea | Nice to have | Pendiente | [#41](https://github.com/solDC/pwa-limpieza-casa/issues/41) |
| US-33 | Añadir una tarea | Must have | Hecha | [#42](https://github.com/solDC/pwa-limpieza-casa/issues/42) |
| US-34 | Elegir el peso de las partes | Nice to have | Pendiente | [#43](https://github.com/solDC/pwa-limpieza-casa/issues/43) |
| US-38 | Poner fecha a una tarea puntual | Must have | Pendiente | [#54](https://github.com/solDC/pwa-limpieza-casa/issues/54) |
| US-41 | Cambiar cuándo toca la próxima vez | Must have | Pendiente | [#59](https://github.com/solDC/pwa-limpieza-casa/issues/59) |
| US-42 | Mover una tarea de fin de semana a otro finde | Must have | Pendiente | [#60](https://github.com/solDC/pwa-limpieza-casa/issues/60) |
| US-46 | Marcar como hecha en un día anterior | Nice to have | Pendiente | [#65](https://github.com/solDC/pwa-limpieza-casa/issues/65) |
| US-48 | Las tareas nuevas no empiezan con retraso | Nice to have | Hecha | [#71](https://github.com/solDC/pwa-limpieza-casa/issues/71) |

## Conceptos

- **Tarea:** algo que hay que mantener. Puede ser **una acción** («Aspirar cosas de Cati», «Cristales y espejos») o **un lugar** de la casa («Baño», «Jardín», «Planta de arriba»). Puede tener **partes**, que a su vez pueden ser **lugares** («Superficies»: cocina, salón, dormitorio) o **acciones** («Baño»: inodoro, ducha, espejo), cada una con su **peso** en porcentaje; los pesos suman 100 %.
- **Vuelta:** cada vez que toca hacer una tarea. Empieza cuando toca y se cierra con uno de estos estados:

  | Estado | Cuándo |
  |---|---|
  | **Completada** | Se han hecho la tarea entera o todas sus partes |
  | **Parcial (X %)** | Se acaba el plazo con algunas partes hechas; X es la suma de sus pesos |
  | **No completada** | Se acaba el plazo sin hacer nada |
  | **Cancelada** | Se cancela la tarea con la vuelta en curso (US-40) |
  | **Saltada** | Me la salto a propósito, por ejemplo un finde que no estoy en casa (US-49) |

- **Frecuencias:**

  | Tipo | Ejemplo | Cuándo toca | Cuándo se acaba el plazo |
  |---|---|---|---|
  | **Semanal, en fin de semana** | Superficies | Cada sábado y domingo | El viernes siguiente, incluido: de lunes a viernes se puede hacer, como retrasada (el lunes, 1 día) |
  | **Fin de semana cada 15 días** | Aspirar cosas de Cati | Un fin de semana sí y otro no, empezando el 5-6 de diciembre de 2026 | El viernes siguiente, incluido, como las semanales |
  | **Cada N días desde la última vez** | Baño (3), Cristales y espejos (30) | N días después del día en que se terminó la última vez | Nunca: si no se hace, aparece como retrasada (X días) hasta que se hace. No hay «no completada» |
  | **Puntual** | Cepillar suelo, Limpiar juntas | Sin fecha: pendiente hasta que se hace, y después desaparece | Nunca: sin fecha no tiene retraso |

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
Como usuario,
quiero entrar escribiendo el código del email,
para entrar desde cualquier dispositivo sin abrir otra ventana, también en la app instalada del iPhone, donde el enlace del email no funciona.
- El email trae un código de 6 dígitos (primero, y también en el asunto) y el enlace.
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
- Las tareas retrasadas dicen cuántos días de retraso llevan («Retrasada 3 días»; con 1, «Retrasada 1 día»).
- Las de fin de semana tocan el sábado y el domingo. Si no se han hecho, de lunes a viernes salen como retrasadas, contando desde el lunes (el lunes, 1 día), y el sábado empieza la vuelta nueva.
- En las de cada N días, el retraso se cuenta desde el día siguiente al que tocaban. Las puntuales nunca van con retraso.
- En «Tus tareas», primero salen las retrasadas (las de más retraso arriba), luego las que tocan hoy, luego las puntuales y al final las que tocan más adelante, por fecha.

*El progreso de las tareas con partes («Cocina hecha · 50 %») llega con la US-39, que es cuando se pueden marcar.*

### US-30 · Marcar una tarea como hecha (Must have)
Como usuario,
quiero marcar como hecha una tarea entera,
para que la app sepa qué he limpiado ya.
- Puedo marcar como hecha una tarea entera; su vuelta queda completada.
- Al completar una vuelta, la tarea muestra cuándo vuelve a tocar (las puntuales desaparecen).
- Se apunta como día de hecho el día en que la marco.
- Si falla el guardado (sin conexión o un error), la app lo dice y no la muestra como hecha.

### US-39 · Marcar una parte como hecha (Must have)
Como usuario,
quiero marcar como hecha una sola parte de una tarea,
para avanzar poco a poco y que la app sepa cuánto llevo.
- Puedo marcar cada parte por separado, y veo el progreso de la vuelta (la suma de los pesos de las partes hechas, por ejemplo 50 %).
- Al marcar todas las partes, la vuelta queda completada.
- Si falla el guardado, la app lo dice y no muestra la parte como hecha.

*Depende de la US-30.*

### US-32 · Cancelar una tarea (Nice to have)
Como usuario,
quiero cancelar una tarea que ya no hago,
para que deje de aparecer sin perder su histórico.
- La app pide confirmación antes de cancelar.
- Una tarea cancelada deja de aparecer en «Qué toca».

*Que su histórico siga viéndose es la US-40 (backlog).*

### US-33 · Añadir una tarea (Must have)
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

### US-38 · Poner fecha a una tarea puntual (Must have)
Como usuario,
quiero ponerle una fecha a una tarea puntual, cambiarla o quitarla,
para planificarla si quiero.
- Puedo ponerle una fecha, cambiarla o quitarla; sin fecha se ve como «Sin fecha» y nunca tiene retraso.
- Si llega esa fecha sin hacerse, aparece como retrasada.
- Solo se puede elegir hoy o una fecha futura.

*Depende de la US-30.*

### US-41 · Cambiar cuándo toca la próxima vez (Must have)
Como usuario,
quiero cambiar cuándo toca la próxima vez una tarea de cada N días,
para adaptarla a mis planes.
- Puedo cambiar el día en que toca la próxima vez; solo hoy o una fecha futura.
- Después, las siguientes se cuentan desde el día en que se termine, como siempre.

*Depende de la US-30.*

### US-42 · Mover una tarea de fin de semana a otro finde (Must have)
Como usuario,
quiero mover una tarea de fin de semana a otro finde,
para adelantarla o retrasarla.
- Puedo mover la vuelta a otro finde, a partir del actual.
- En las de cada 15 días se mueve todo el calendario: las siguientes son cada 15 días desde el finde nuevo.
- En las semanales solo se mueve esa vuelta; las siguientes siguen siendo cada finde.

*Depende de la US-30.*

### US-46 · Marcar como hecha en un día anterior (Nice to have)
Como usuario,
quiero elegir el día en que hice una tarea al marcarla,
para que la app cuente bien aunque me acuerde de marcarla tarde.
- Al marcar una tarea, puedo dejar «hoy» o elegir un día anterior.
- No puedo elegir un día futuro, ni anterior al inicio de la vuelta en curso (en las de fin de semana, su sábado; en las de cada N días, el día en que se hizo la anterior).
- La próxima vez que toca se cuenta desde el día elegido.

*Depende de la US-30.*

### US-48 · Las tareas nuevas no empiezan con retraso (Nice to have)
Como usuario,
quiero que una tarea recién creada no salga retrasada por una vuelta que empezó antes de crearla,
para que la lista solo me avise de lo que de verdad he dejado sin hacer.
- Una tarea de fin de semana creada de lunes a viernes empieza el sábado siguiente: hasta entonces dice «Toca: finde del…», sin retraso.
- Creada en sábado o domingo, toca ese mismo fin de semana.
- En las de cada 15 días, la primera vuelta es la primera de su calendario que empieza el día en que se crea o después.
- Si alguien se da de alta entre semana, sus tareas por defecto de fin de semana no salen retrasadas.

## Historias anteriores

Las historias US-04 a US-25 eran del MVP original, más amplio. Así quedan con el MVP acotado:

| Qué pasa | Historias |
|---|---|
| **Absorbidas** por las nuevas | US-05 Partes, US-09 a US-11 Frecuencias → US-28 · US-12 y US-13 Marcar → US-30 · US-16 a US-18 Qué toca → US-29 · US-25 Aviso si falla el guardado → US-30 |
| **Sustituidas** | US-04 Crear → US-33 · US-07 Borrar → US-32 (cancelar, para conservar el histórico) · US-20 Historial → US-31 · US-22 y US-23 Datos de ejemplo → US-27 (mis tareas por defecto) |
| **Descartadas** al revisarlas con INVEST | US-06 Editar una tarea (absorbida por la US-33 y las US-38, US-41 y US-42) · US-08 Ver todas mis tareas (cumplida con «Tus tareas», US-27 y US-28) · US-14 Elegir cuándo lo hice · US-15 Deshacer · US-19 Pantalla vacía (con las tareas por defecto no hay hogar vacío) · US-21 Historial de una tarea |
| **Ya cumplida** | US-24 Instalar la app: la PWA ya se puede instalar |

## Backlog

Para una versión futura.

### US-35 · Épica: Rediseño de la interfaz · [#44](https://github.com/solDC/pwa-limpieza-casa/issues/44)
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

### US-31 · Histórico de cada vuelta · [#40](https://github.com/solDC/pwa-limpieza-casa/issues/40)
Como usuario,
quiero ver el histórico de cada vuelta de cada tarea,
para saber cómo voy con la limpieza.
- Hay una pantalla «Histórico» con cada vuelta cerrada, de la más reciente a la más antigua: tarea, fechas y estado.
- El estado es **Completada**, **Parcial (X %)** o **No completada**, como dice la tabla de «Conceptos».
- Las vueltas de fin de semana que llegan al sábado siguiente sin terminar (el plazo acaba el viernes) quedan como parcial o no completada sin que yo haga nada.
- El porcentaje parcial es la suma de los pesos de las partes hechas.

*La primera vuelta de una tarea es la primera que empieza después de crearla (US-48), así que no hay vueltas anteriores a la tarea en el histórico.*

### US-40 · Ver en el histórico las tareas canceladas · [#58](https://github.com/solDC/pwa-limpieza-casa/issues/58)
Como usuario,
quiero que al cancelar una tarea su vuelta en curso y todas las anteriores sigan en el histórico,
para no perder lo que hice.
- Al cancelar una tarea, su vuelta en curso se cierra con el estado **Cancelada** y aparece en el histórico.
- Las vueltas anteriores de esa tarea siguen en el histórico, con su estado.
- En el histórico se ve que esa tarea está cancelada.

*Depende de la US-31 y de la US-32.*

### US-43 · Deshacer una tarea marcada como hecha · [#62](https://github.com/solDC/pwa-limpieza-casa/issues/62)
Como usuario,
quiero deshacer una tarea que he marcado como hecha por error,
para que la app no crea que la he limpiado.
- Una tarea hecha muestra cuándo se hizo y un botón «Deshacer» («Hecha el dom 8 nov · Deshacer»), hasta que se vuelve a marcar.
- Al deshacer, la tarea vuelve a estar como antes de marcarla, con su «Toca:» anterior; las puntuales vuelven a aparecer.
- Si falla el guardado, la app lo dice y la tarea sigue como hecha.

*Depende de la US-30.*

### US-44 · Deshacer una parte marcada como hecha · [#63](https://github.com/solDC/pwa-limpieza-casa/issues/63)
Como usuario,
quiero deshacer una parte que he marcado como hecha por error,
para que el progreso de la vuelta sea el real.
- Una parte hecha de la vuelta en curso tiene un botón «Deshacer».
- Al deshacer, la parte vuelve a estar sin hacer y el progreso de la vuelta baja su peso.
- Si la vuelta estaba completada por tener todas las partes hechas, al deshacer una deja de estarlo.
- Si falla el guardado, la app lo dice y la parte sigue como hecha.

*Depende de la US-39.*

### US-45 · Recuperar una tarea cancelada · [#64](https://github.com/solDC/pwa-limpieza-casa/issues/64)
Como usuario,
quiero recuperar una tarea que cancelé,
para volver a hacerla sin crearla de nuevo.
- Puedo ver mis tareas canceladas y recuperar cualquiera.
- Una tarea recuperada vuelve a aparecer con su frecuencia, sus partes y su histórico.
- Su próxima vuelta se calcula como si se acabara de crear: las de «cada N días», desde el día en que se recupera.
- Si falla el guardado, la app lo dice y la tarea sigue cancelada.

*Depende de la US-32.*

### US-47 · Avisos de error visibles · [#67](https://github.com/solDC/pwa-limpieza-casa/issues/67)
Como usuario de la app en el móvil,
quiero que los errores al guardar salgan en un aviso que se vea bien,
para darme cuenta de que algo no se ha guardado.
- Si no se puede guardar una tarea, aparece un aviso flotante con el nombre de la tarea y el motivo, visible aunque haya bajado en la lista.
- El aviso se queda en pantalla hasta que lo cierro con «Cerrar».
- Si la tarea ya estaba hecha en otro dispositivo y desaparece de la lista (una puntual), el aviso se ve igual.
- Si al marcar una tarea acaba de cambiar el día (por ejemplo, el viernes justo a medianoche), el aviso dice que ha cambiado el día, no que la fecha del dispositivo esté mal, y la lista se pone al día con el día nuevo.
- Si no se puede guardar porque la sesión ha caducado, el aviso dice que vuelva a entrar, no que revise la conexión.

*Depende de la US-30. Solo para errores: cuando se guarda bien, ya cambia la tarea en la lista.*

*El aviso de versión nueva de la app (#76) ya es una ventana en el centro de la pantalla, con el fondo oscurecido. En esta historia se convierte en un componente común (`src/components/`), que reutilizan los avisos de error con lo que piden los criterios de arriba.*

### US-49 · Saltarse una vuelta · [#72](https://github.com/solDC/pwa-limpieza-casa/issues/72)
Como usuario,
quiero saltarme a propósito una vuelta de una tarea, por ejemplo un finde que no estoy en casa,
para que no salga como retrasada.
- Una tarea que toca o va con retraso tiene un botón «Saltar esta vez», que pide confirmación.
- Al saltarla, la tarea muestra cuándo vuelve a tocar, como si se hubiera hecho; las puntuales no se pueden saltar (para eso está cancelarla, US-32).
- En las de cada N días, la siguiente se cuenta desde el día en que se salta.
- Si falla el guardado, la app lo dice y la tarea sigue como estaba.

*Depende de la US-30. Cuando exista el histórico (US-31), esa vuelta sale como «Saltada», no como «No completada».*

## Visión

Ideas para más adelante, todavía sin historia.

- **Compartir la casa con otras personas:** invitar a alguien por email; las dos personas ven las mismas tareas, pueden marcarlas y el histórico dice quién hizo cada cosa; quien creó la casa puede quitar a otras personas. La base de datos ya está preparada: todo cuelga del hogar y un hogar puede tener varios miembros.
