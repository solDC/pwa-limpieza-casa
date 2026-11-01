# PWA limpieza casa

Aplicación web progresiva (PWA) para organizar las tareas de mantenimiento del hogar. Muestra lo que toca hoy, lo que se ha retrasado y cuánto llevas de cada tarea. Se instala en el móvil o en el ordenador y funciona sin conexión.

🚧 **MVP en desarrollo.** De momento solo está la base del proyecto.

## Qué hace el MVP

- **Inicio:** lo que toca hoy, lo retrasado y lo que está a medias, con su progreso.
- **Tareas:** crear, editar y borrar, con partes opcionales y progreso parcial («Cristales: 2 de 4»).
- **Frecuencias:** por calendario («todos los sábados»), por intervalo («cada 30 días desde la última vez», editable en cada tarea) o puntual.
- **Marcar como hecho** una tarea entera o una parte, eligiendo cuándo se hizo (hoy, ayer u otra fecha), con botón de deshacer.
- **Historial** de lo hecho, con la fecha real.
- **Datos de ejemplo** de un hogar real, con Cati, la gata, que se pueden cargar o borrar.
- **Instalable y sin conexión**, como una PWA.

**Fuera del MVP:** voz, inteligencia artificial, cuentas de usuario, compartir el hogar entre varias personas y recomendaciones.

## Cómo se modelan las tareas

La **tarea** es la pieza central y significa «algo que hay que mantener». Puede ser:

- **Una acción:** «Limpiar los cristales».
- **Un espacio:** «Baño», que incluye todo lo que conlleva limpiarlo.

Cada tarea puede tener **partes**, aunque no es obligatorio. Las partes pueden ser sitios (salón, cocina) o trabajos concretos (inodoro, ducha, espejo).

**Progreso:**
- Con partes, es el número de partes hechas en la ronda actual frente al total.
- Sin partes, la tarea está hecha o no.
- El progreso de una ronda no se pierde aunque cambie el día. La ronda se cierra cuando se completan todas las partes.

**Frecuencia**, a elegir en cada tarea:

| Tipo | Ejemplo | Cómo se calcula la próxima fecha |
|---|---|---|
| Calendario | Todos los fines de semana · el día 1 de cada mes | Siguiente fecha del calendario |
| Intervalo | Cada 30 días (editable) | Desde la última vez que se terminó |
| Puntual | Una sola vez | Sin repetición |

**Historial:** cada registro guarda dos fechas, la de cuándo se hizo (`performedAt`) y la de cuándo se apuntó (`createdAt`). Llegar a la fecha prevista nunca marca una tarea como hecha.

## Tecnología

| Pieza | Elección | Motivo |
|---|---|---|
| Interfaz | React + TypeScript | Componentes pequeños, con tipos que evitan errores |
| Compilación | Vite | Rápido y sencillo |
| PWA | vite-plugin-pwa | Genera el manifiesto y el service worker (funcionamiento sin conexión) |
| Datos | IndexedDB, en el navegador | Sin servidor, funciona sin conexión |
| Pruebas | Vitest | Para el motor de frecuencias y el progreso |
| Despliegue | Docker: Node compila y nginx sirve | Arranca con un solo comando |

La lógica de tareas, frecuencias y progreso va en `src/domain/`. Esa carpeta no depende de React ni del navegador, así que se prueba de forma aislada.

## Estructura del proyecto

```
.
├── public/                 Iconos y favicon de la PWA
├── src/
│   ├── domain/             Modelo de tareas, motor de frecuencias y progreso (sin React)
│   ├── storage/            Guardado en IndexedDB
│   ├── demo/               Datos de ejemplo, separados de los datos reales
│   ├── features/
│   │   ├── inicio/         Pantalla de Inicio
│   │   ├── tareas/         Lista, detalle y edición de tareas
│   │   └── historial/      Registro de lo hecho
│   ├── ui/                 Componentes visuales comunes
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── index.html
├── vite.config.ts          Configuración de Vite, de la PWA y de las pruebas
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── package.json
```

## Cómo ejecutarlo

### Requisitos

- **Node.js 22.12 o posterior.** Compruébalo con `node --version`. Si no lo tienes, instálalo desde nodejs.org o con `brew install node`.
- **Docker Desktop**, solo para la opción con Docker.

### En desarrollo

```
npm install
npm run dev
```

Abre la dirección que aparece en la terminal, normalmente http://localhost:5173.

### Pruebas

```
npm test
```

### Con Docker

```
docker compose up --build
```

La app queda en http://localhost:8080. Durante la compilación, Docker también ejecuta las pruebas, y si alguna falla no se crea la imagen.

Docker usa `npm ci`, que necesita el archivo `package-lock.json`. Ese archivo se genera la primera vez que ejecutas `npm install` y hay que subirlo al repo.

### Instalarla como app

En Chrome o Edge, abre la app y pulsa el icono de instalar en la barra de direcciones.

El service worker, que es lo que permite instalarla y usarla sin conexión, solo funciona en `localhost` o con HTTPS. Desde otro dispositivo de la red (por ejemplo `http://192.168.x.x:8080`) se ve, pero no se puede instalar. Para instalarla en el móvil habría que publicarla con HTTPS.
