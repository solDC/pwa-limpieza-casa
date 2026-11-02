# PWA limpieza casa

Aplicación web progresiva (PWA) para organizar las tareas de mantenimiento del hogar. Muestra lo que toca hoy, lo que se ha retrasado y cuánto llevas de cada tarea. Se instala en el móvil o en el ordenador, y cada usuario tiene su cuenta con sus datos guardados en la nube.

🚧 **MVP en desarrollo.** Ya se puede entrar con un enlace mágico y cada usuario tiene su hogar (US-01 y US-02). El resto de historias, en [`docs/user-stories.md`](docs/user-stories.md).

## Qué hace el MVP

El detalle, con las historias de usuario y su prioridad, está en [`docs/user-stories.md`](docs/user-stories.md).

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
| Pruebas | Vitest | Pruebas unitarias del motor de frecuencias y el progreso, y de la base de datos |
| Pruebas en navegador | Playwright | Comprueban cada historia de usuario usando la app como una persona |
| Integración continua | GitHub Actions | Pasa todas las pruebas en cada pull request, para detectar regresiones |
| Despliegue | Vercel | Publica la app con HTTPS, necesario para instalarla en el móvil |
| Desarrollo | Dev container + Docker | El mismo entorno (versión de Node) para todos y que en producción |

La app no tiene servidor propio: el navegador habla directamente con Supabase, y las reglas de la base de datos garantizan que cada usuario solo ve sus datos.

La lógica de tareas, frecuencias y progreso va en `src/domain/`. Esa carpeta no depende de React, de Supabase ni del navegador, así que se prueba de forma aislada.

## Estructura del proyecto

```
.
├── .devcontainer/          Dev container para VS Code (usa el mismo Dockerfile)
├── .github/workflows/      Integración continua: pruebas en cada pull request
├── docs/                   Historias de usuario del MVP
├── public/                 Iconos y favicon de la PWA
├── supabase/
│   ├── config.toml         Configuración de Supabase en local
│   └── migrations/         Cambios de la base de datos (tablas, reglas de seguridad), en orden
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
├── tests/                  Pruebas automáticas (ver tests/README.md)
│   ├── unit/               Lógica pura (Vitest)
│   ├── integration/        Base de datos y reglas de seguridad (Vitest)
│   └── e2e/                La app en un navegador, una prueba por historia (Playwright)
├── index.html
├── vite.config.ts          Configuración de Vite, de la PWA y de Vitest
├── playwright.config.ts    Configuración de las pruebas en navegador
├── .env.example            Variables de entorno necesarias, sin valores reales
├── Dockerfile              Entorno de desarrollo (Node 22, como Vercel)
├── docker-compose.yml      Arranca el entorno de desarrollo
├── .nvmrc                  Versión de Node, para quien desarrolle sin Docker
├── CLAUDE.md               Contexto y reglas para la IA
├── CHANGELOG.md            Cambios y decisiones del proyecto
└── package.json
```

Los nombres técnicos (carpetas, archivos, código) van en inglés; la documentación y los textos de la app, en español.

## Cómo ejecutarlo

### Requisitos

- **Docker Desktop.** Es la forma recomendada: el entorno es el mismo para todos y usa la misma versión de Node que Vercel.
- **VS Code con la extensión Dev Containers**, para trabajar dentro del contenedor desde el editor (opción recomendada).
- **Node.js 22**, solo si quieres desarrollar sin Docker. Compruébalo con `node --version`.

### En desarrollo, con dev container (recomendado)

El proyecto trae un dev container (`.devcontainer/`) que construye la misma imagen que `docker-compose.yml` (el `Dockerfile` del proyecto): VS Code abre el editor dentro del contenedor, con Node 22 y las dependencias instaladas.

1. Abre Docker Desktop.
2. Abre la carpeta del proyecto en VS Code y pulsa **Reopen in Container** (o `Cmd + Shift + P` → **Dev Containers: Reopen in Container**).
3. La primera vez tarda unos minutos.
4. En la terminal de VS Code, arranca la app con `npm run dev`. VS Code abre http://localhost:5173 en tu navegador.

La terminal de VS Code ya está dentro del contenedor, así que los comandos se escriben sin `docker compose exec app`:

```
npm test
npm run test:e2e
npm run build
npm install nombre-del-paquete
```

Si cambian las dependencias (por ejemplo, al bajar cambios del repo), ejecuta `npm install` en la terminal de VS Code.

No arranques a la vez el dev container y `docker compose up`: los dos usan el puerto 5173.

#### Supabase en local

La app necesita Supabase. En desarrollo se usa una copia local, dentro del dev container, con las mismas tablas y reglas que la de la nube, y que no envía emails de verdad.

1. Arranca Supabase. La primera vez descarga sus imágenes y tarda unos minutos:

   ```
   npx supabase start
   ```

2. Crea el `.env` con la dirección y la clave del Supabase local:

   ```
   npm run env:local
   ```

3. Arranca la app con `npm run dev` y entra con cualquier email.
4. El enlace mágico no llega a tu correo: llega al **buzón de pruebas**, en http://localhost:54324. Ábrelo desde ahí.

Las tablas se pueden ver en **Supabase Studio**, en http://localhost:54323.

```
npx supabase stop        # parar Supabase (los datos se conservan)
npx supabase db reset    # borrar los datos y volver a aplicar las migraciones
```

### En desarrollo, con Docker desde la terminal

Con esta opción, Supabase local no puede ir dentro del contenedor: habría que arrancarlo en tu ordenador (`npx supabase start`, con Node instalado). Para trabajar con la base de datos, usa el dev container.


```
docker compose up --build
```

Abre http://localhost:5173. Los cambios que hagas en el código se ven al momento, sin reiniciar nada. Para pararlo, `Ctrl+C`.

Con el entorno arrancado, desde otra terminal:

```
docker compose exec app npm test
```

```
docker compose exec app npm run test:e2e
```

```
docker compose exec app npm run build
```

Para añadir una dependencia, instálala dentro del contenedor, así se actualizan `package.json` y `package-lock.json`:

```
docker compose exec app npm install nombre-del-paquete
```

Si alguien ha cambiado las dependencias (por ejemplo, al bajar cambios del repo), reconstruye el entorno con `-V`, que descarta las dependencias antiguas del contenedor:

```
docker compose up --build -V
```

### En desarrollo, sin Docker

```
npm install
npm run dev
```

Abre http://localhost:5173.

```
npm test
```

Para las pruebas en navegador, la primera vez hay que descargar Chromium (en Docker y en el dev container ya viene instalado):

```
npx playwright install chromium
npm run test:e2e
```

### Variables de entorno

La app necesita dos variables, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ver `.env.example`):

- **En desarrollo:** en el archivo `.env`, que nunca se sube a Git. Con Supabase local, lo crea `npm run env:local`.
- **En Vercel:** en el panel del proyecto, **Settings → Environment Variables**.

Sin ellas, la app muestra un aviso de que falta la configuración.

## Puesta en producción

Vercel publica `main` automáticamente. Supabase de la nube necesita estos pasos.

### Una sola vez

1. **Supabase → Authentication → URL Configuration:**
   - **Site URL:** la dirección de producción de Vercel (por ejemplo, `https://pwa-limpieza-casa.vercel.app`).
   - **Redirect URLs:** esa misma dirección con `/**` al final, y la de los despliegues de prueba de Vercel: `https://pwa-limpieza-casa-*-sol-dc.vercel.app/**`.
2. **Vercel → Settings → Environment Variables:** añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para **Production** y **Preview**. Los valores están en **Supabase → Project Settings → API**. Después, vuelve a desplegar.
3. **Enlaza el repo con el proyecto de Supabase**, desde la terminal del dev container. Te pedirá iniciar sesión y la contraseña de la base de datos:

   ```
   npx supabase login
   npx supabase link --project-ref <id-del-proyecto>
   ```

   El id del proyecto es la parte de la URL de Supabase: `https://<id-del-proyecto>.supabase.co`.

### Cada vez que haya una migración nueva

Cuando un pull request añade archivos en `supabase/migrations/`, hay que aplicarlos a la base de datos de la nube **desde la rama de ese pull request y antes de fusionarlo**, para que su despliegue de prueba ya funcione:

1. Cámbiate a la rama del pull request (por ejemplo, `feature/us-01-sign-in`) e instala las dependencias por si han cambiado:

   ```
   git fetch
   git switch feature/us-01-sign-in
   npm install
   ```

   Si VS Code pide reconstruir el dev container, acepta: la rama ha cambiado su configuración.

2. Aplica las migraciones. La CLI las lista y pide confirmación (responde `Y`):

   ```
   npx supabase db push --remote
   ```

Sin `--remote`, la CLI intenta aplicarlas al Supabase local (y falla si no está arrancado). Los comandos de Supabase siempre van con `npx` delante: la CLI está instalada en el proyecto, no en el sistema.

Si responde «Remote database is up to date» sin listar nada, probablemente estás en otra rama (por ejemplo, `main`), donde esa migración aún no existe.

Si la app nueva usa una tabla que aún no existe en la nube, fallará hasta que se aplique la migración.

### Instalarla como app

En Chrome o Edge, abre la app y pulsa el icono de instalar en la barra de direcciones.

El service worker, que es lo que permite instalarla, solo funciona en `localhost` o con HTTPS. Una vez desplegada en Vercel, que usa HTTPS, se podrá instalar también en el móvil.

## Contribuir

- Lee `CLAUDE.md`: tiene la arquitectura, las convenciones y lo que no se debe hacer nunca.
- Commits con [Conventional Commits](https://www.conventionalcommits.org/): tipo en inglés y descripción en español (`feat: marcar una parte como hecha`).
- Cada cambio que afecte a alguien se apunta en `CHANGELOG.md`, en el mismo commit, explicando qué y por qué.
- Cada historia de usuario tiene su issue en GitHub y se desarrolla en su propia rama (`feature/…`), con un pull request a `main`.
- Una historia no está terminada sin pruebas automáticas que cubran sus criterios de aceptación (ver `tests/README.md`).
- Antes de subir un cambio: `npm test`, `npm run build` y `npm run test:e2e` deben pasar. La CI de GitHub lo comprueba en cada pull request.
- Nunca subas `.env` ni claves reales.
