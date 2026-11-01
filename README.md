# PWA limpieza casa

Aplicación web progresiva (PWA) para organizar las tareas de mantenimiento del hogar. Muestra lo que toca hoy, lo que se ha retrasado y cuánto llevas de cada tarea. Se instala en el móvil o en el ordenador, y cada usuario tiene su cuenta con sus datos guardados en la nube.

🚧 **MVP en desarrollo.** De momento solo está la base del proyecto. Se ha decidido pasar de guardar los datos en el navegador a una base de datos en Supabase con despliegue en Vercel; la migración aún no está hecha (ver `CHANGELOG.md`).

## Qué hace el MVP

- **Cuenta de usuario:** inicio de sesión con un enlace mágico que llega por email, sin contraseña.
- **Inicio:** lo que toca hoy, lo retrasado y lo que está a medias, con su progreso.
- **Tareas:** crear, editar y borrar, con partes opcionales y progreso parcial («Cristales: 2 de 4»).
- **Frecuencias:** por calendario («todos los sábados»), por intervalo («cada 30 días desde la última vez», editable en cada tarea) o puntual.
- **Marcar como hecho** una tarea entera o una parte, eligiendo cuándo se hizo (hoy, ayer u otra fecha), con botón de deshacer.
- **Historial** de lo hecho, con la fecha real.
- **Datos de ejemplo** de un hogar real, con Cati, la gata, que se pueden cargar o borrar.
- **Instalable** como una PWA. Necesita conexión a internet.

## Backlog (fuera del MVP)

- **Compartir el hogar** con otras personas. La base de datos ya está pensada para ello: todo cuelga del hogar, no del usuario.
- **Uso sin conexión,** con sincronización al recuperar la conexión.

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

**Historial:** cada registro guarda cuándo se hizo (`performed_at`), cuándo se apuntó (`created_at`) y quién lo hizo. Llegar a la fecha prevista nunca marca una tarea como hecha.

## Tecnología

| Pieza | Elección | Motivo |
|---|---|---|
| Interfaz | React + TypeScript | Componentes pequeños, con tipos que evitan errores |
| Compilación | Vite | Rápido y sencillo |
| PWA | vite-plugin-pwa | Genera el manifiesto y el service worker para poder instalarla |
| Datos | Supabase (PostgreSQL) | Base de datos en la nube, con reglas de seguridad por usuario (Row Level Security) |
| Usuarios | Supabase Auth | Inicio de sesión con enlace mágico, sin contraseñas que gestionar |
| Pruebas | Vitest | Para el motor de frecuencias y el progreso |
| Despliegue | Vercel | Publica la app con HTTPS, necesario para instalarla en el móvil |
| Desarrollo | Docker | El mismo entorno (versión de Node) que en producción |

La app no tiene servidor propio: el navegador habla directamente con Supabase, y las reglas de la base de datos garantizan que cada usuario solo ve sus datos.

La lógica de tareas, frecuencias y progreso va en `src/domain/`. Esa carpeta no depende de React, de Supabase ni del navegador, así que se prueba de forma aislada.

## Estructura del proyecto

```
.
├── public/                 Iconos y favicon de la PWA
├── src/
│   ├── domain/             Modelo de tareas, motor de frecuencias y progreso (TypeScript puro)
│   ├── storage/            Acceso a Supabase
│   ├── demo/               Datos de ejemplo, separados de los datos reales
│   ├── features/
│   │   ├── home/           Pantalla de Inicio
│   │   ├── tasks/          Lista, detalle y edición de tareas
│   │   └── history/        Registro de lo hecho
│   ├── ui/                 Componentes visuales comunes
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── index.html
├── vite.config.ts          Configuración de Vite, de la PWA y de las pruebas
├── .env.example            Variables de entorno necesarias, sin valores reales
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── CLAUDE.md               Contexto y reglas para la IA
├── CHANGELOG.md            Cambios y decisiones del proyecto
└── package.json
```

Los nombres técnicos (carpetas, archivos, código) van en inglés; la documentación y los textos de la app, en español.

## Cómo ejecutarlo

### Requisitos

- **Node.js 22.12 o posterior.** Compruébalo con `node --version`. Si no lo tienes, instálalo desde nodejs.org o con `brew install node`.
- **Docker Desktop**, para la opción con Docker.

### En desarrollo

```
npm install
npm run dev
```

Abre la dirección que aparece en la terminal, normalmente http://localhost:5173.

Cuando la app use Supabase, antes habrá que copiar `.env.example` como `.env` y rellenar los valores del proyecto de Supabase.

### Pruebas

```
npm test
```

### Con Docker

```
docker compose up --build
```

La app queda en http://localhost:8080. Durante la compilación, Docker también ejecuta las pruebas, y si alguna falla no se crea la imagen.

> Pendiente: ahora Docker compila la app y la sirve con nginx. Se adaptará para que sea el entorno de desarrollo, con la misma versión de Node que Vercel.

### Instalarla como app

En Chrome o Edge, abre la app y pulsa el icono de instalar en la barra de direcciones.

El service worker, que es lo que permite instalarla, solo funciona en `localhost` o con HTTPS. Una vez desplegada en Vercel, que usa HTTPS, se podrá instalar también en el móvil.

## Contribuir

- Lee `CLAUDE.md`: tiene la arquitectura, las convenciones y lo que no se debe hacer nunca.
- Commits con [Conventional Commits](https://www.conventionalcommits.org/): tipo en inglés y descripción en español (`feat: marcar una parte como hecha`).
- Cada cambio que afecte a alguien se apunta en `CHANGELOG.md`, en el mismo commit, explicando qué y por qué.
- Antes de subir un cambio: `npm test` y `npm run build` deben pasar.
- Nunca subas `.env` ni claves reales.
