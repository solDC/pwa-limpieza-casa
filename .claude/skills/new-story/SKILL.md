---
name: new-story
description: Convierte una idea o necesidad de Sol en una historia de usuario de este proyecto (formato «Como…, quiero…, para…», criterios de aceptación comprobables, prioridad y número), comprobando antes que encaja con las historias y los conceptos de docs/user-stories.md. Úsala cuando Sol describa algo que quiere en la app («quiero que…», «estaría bien poder…»), pida «crea una historia», «añade una HU» o «apunta esto en el backlog», o cuando haga falta revisar si una historia está bien escrita.
---

# new-story

Escribe historias nuevas para `docs/user-stories.md`. No las implementa (eso es `implement-story`) ni toca GitHub (eso es `sync-issues`).

**Nada se escribe en el repositorio sin el ok de Sol** (ver «Cómo trabajar con Sol» en `CLAUDE.md`).

## 1. Entender la idea

1. Lee `docs/user-stories.md` entero: el MVP, la tabla de resumen, «Conceptos» (tareas, partes, vueltas, frecuencias), las historias y el backlog. Mira «Estado» en `CLAUDE.md` para saber qué está hecho.
2. **Pregunta antes de escribir** lo que falte para que la historia no sea ambigua. Pocas preguntas, concretas y con una propuesta cada una. Por ejemplo:
   - Qué problema resuelve y en qué situación lo usa Sol (¿en el iPhone con la app instalada?, ¿en el ordenador?).
   - Casos límite: qué pasa si no hay conexión, si se hace dos veces, si acaba el plazo, si se cancela.
   - Valores concretos: fechas, porcentajes, textos de botones.
   - Si es imprescindible para la demo (**Must have**) o se puede recortar (**Nice to have**). Propón una prioridad, pero decide Sol.

## 2. Comprobar que encaja

Antes de escribirla, revisa y cuenta a Sol lo que encuentres:

- **¿Ya existe?** Una historia parecida en el MVP o en el backlog. Si es así, propón ampliarla o recuperarla del backlog en lugar de crear otra.
- **¿Encaja con «Conceptos»?** Si necesita un concepto nuevo o cambiar uno (un estado de vuelta, un tipo de frecuencia), propón también el cambio en «Conceptos».
- **¿Afecta a otras historias?** Si absorbe o sustituye alguna, dilo, para apuntarlo en «Historias anteriores».
- **Limitaciones técnicas** que conviene saber antes (por ejemplo: los iconos de la pantalla de inicio no pueden estar animados; el enlace del email se abre en Safari y no en la app instalada del iPhone). Si las hay, propón una alternativa.
- **Dependencias:** qué historias tienen que estar hechas antes (marcar como hecha necesita que existan las tareas).

### INVEST

Toda historia tiene que cumplir **INVEST**. Compruébalo antes de enseñarla y di a Sol qué letra no cumple y cómo arreglarlo:

| Letra | Significa | En este proyecto |
|---|---|---|
| **I** | Independiente | Se puede hacer sin esperar a otra. Si depende de otra, la dependencia se escribe en una nota en cursiva («*Depende de la US-30.*») y ningún criterio necesita algo que aún no existe |
| **N** | Negociable | Dice qué necesita Sol, no cómo programarlo |
| **V** | Valiosa | Sol ve el cambio en la app. Si ya está cubierta por otra historia hecha, no hace falta |
| **E** | Estimable | No depende de decisiones pendientes: si las hay, se preguntan antes o se apuntan en una nota y la historia va al backlog hasta resolverlas |
| **S** | Pequeña (*small*) | Cabe en una rama y un pull request. Si junta varias cosas con lógica distinta (por ejemplo, cada tipo de frecuencia), se divide |
| **T** | Testable | Cada criterio se puede comprobar con una prueba. Nada de «unos segundos» o «que se vea bien» sin concretar |

Una **épica** es una idea demasiado grande para una historia (por ejemplo, el rediseño de la interfaz). Se escribe con «Épica:» en el título, lleva la etiqueta `epic` en GitHub y se divide en historias INVEST antes de implementarla.

## 3. Escribir el borrador

Con el formato de `docs/user-stories.md`:

```markdown
### US-xx · Título corto en español (Must have)
Como <tipo de usuario>,
quiero <qué quiere hacer>,
para <para qué le sirve>.
- Criterio de aceptación 1.
- Criterio de aceptación 2.
```

- **Número:** el siguiente libre, mirando la tabla de resumen **y** el backlog (no reutilices números de historias cerradas).
- **Todo en español:** la historia (*Como…, quiero…, para…*), el título y los criterios.
- **Criterios comprobables:** cada uno describe algo que se ve o se puede hacer en la app, y se puede convertir en una prueba e2e («Al marcar todas las partes, la vuelta queda completada»). Nada de «que sea rápido» o «que sea bonito» sin concretar.
- Pocos criterios (de 2 a 5). Si salen muchos, probablemente son dos historias: propón dividirla.
- **No hay criterios opcionales.** Si una parte de la idea es un extra deseable, va en **una historia aparte** con prioridad **Nice to have**, que depende de la principal.
- **Sección:** la que corresponda (Cuenta, Tareas…) o «Backlog» si Sol la quiere para más adelante.

## 4. Enseñárselo a Sol y esperar su ok

Enséñale el borrador completo, la prioridad propuesta, la sección y lo que encontraste en el paso 2. **No escribas nada en el repositorio hasta que diga que sí.** Si pide cambios, ajústalo y vuelve a enseñárselo.

## 5. Añadirla al documento

Con el ok de Sol:

- La historia, en su sección de `docs/user-stories.md`.
- Su fila en la tabla de resumen (ID, historia, prioridad, estado «Pendiente», issue «—»), o en «Backlog» si es para más adelante.
- Los cambios en «Conceptos» o en «Historias anteriores», si los hay.
- No va en el CHANGELOG: no cambia la app.

Después, propón seguir con **`sync-issues`** para crear su issue y poner el enlace en la tabla.

## Revisar historias existentes

Si Sol pide revisar historias ya escritas, aplica los pasos 2 y 3, con INVEST, como lista de comprobación y **propón** los cambios (criterios ambiguos, que no se pueden probar, duplicados, conceptos que no encajan). No reescribas nada sin su ok.

## Antes de terminar

- [ ] Sol ha respondido a las preguntas y ha dado su ok al borrador.
- [ ] La historia no duplica otra y encaja con «Conceptos».
- [ ] Cumple INVEST (o es una épica, marcada como tal).
- [ ] Cada criterio se puede comprobar con una prueba, y ninguno es opcional.
- [ ] Número, prioridad y sección correctos; tabla de resumen al día.
- [ ] Propuesto el paso siguiente: `sync-issues`.
