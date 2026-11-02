# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Cada entrada explica qué cambió y por qué; no es un volcado automático de los mensajes de commit.

Los tipos de [Conventional Commits](https://www.conventionalcommits.org/) corresponden a estas secciones: `feat:` → Added, `fix:` → Fixed, `refactor:`/`chore:` → Changed. Lo que se quita va en Removed.

## [Unreleased]

### Added
- **US-26 · Entrar con código desde la app instalada** (#29). El email para entrar trae ahora, además del enlace, un código de 6 dígitos, y la pantalla «Revisa tu correo» deja escribirlo. Motivo: en el iPhone, la app instalada guarda su sesión aparte de Safari y el enlace del email se abre en Safari, así que con el enlace no se podía entrar en la app instalada. El enlace sigue funcionando igual; el código es una alternativa, no un paso más. Si el código es incorrecto o ha caducado, la app lo dice y deja intentarlo de nuevo.
- Plantilla del email en español (`supabase/templates/sign-in.html`), con el enlace y el código, para el primer email de un usuario nuevo y para los siguientes. En local la usa `supabase/config.toml`; en la nube hay que pegarla en Authentication → Email Templates (ver README).
- **US-26 · Entrar con código desde la app instalada** (#29), en `docs/user-stories.md` y como issue, con prioridad Must: en iPhone, la app instalada no recibe la sesión del enlace del email porque iOS lo abre en Safari.
- **US-01 · Entrar con enlace mágico** (#2). Pantalla para escribir el email; Supabase envía un enlace y al abrirlo se entra en la app. La sesión se guarda en el navegador y se mantiene al cerrar y volver a abrir la app. Si el enlace ha caducado o ya se usó, la app lo dice y deja pedir otro. Los errores (demasiados intentos, sin conexión) se explican en español.
- **US-02 · Hogar creado automáticamente** (#3). Primera migración de la base de datos (`supabase/migrations/…_households.sql`): tablas `households` y `household_members`, con RLS para que cada usuario solo vea su hogar. Al registrarse, una función de la base de datos crea el hogar («Mi casa») y la pertenencia del usuario como propietario. Los hogares no se pueden crear ni borrar desde la app, solo leer y cambiar el nombre. La migración también crea el hogar de los usuarios que ya existieran.
- Pantalla de Inicio provisional: muestra con qué email has entrado y tu hogar, hasta que llegue «Qué toca hoy» (US-16).
- **Supabase en local** (`supabase/config.toml`), con la CLI de Supabase como dependencia del proyecto (`npx supabase …`). Da la misma base de datos, autenticación y API que la nube, y un buzón de pruebas (Mailpit) donde llegan los enlaces mágicos sin enviar emails de verdad. El script `npm run env:local` crea el `.env` con sus valores.
- **Docker dentro del dev container** (*docker-in-docker*), necesario para arrancar Supabase local desde VS Code, y los puertos de Supabase, de la versión compilada y del buzón de pruebas redirigidos al Mac.
- **Pruebas de integración de la base de datos** (`tests/integration/households.test.ts`): comprueban el hogar automático y que un usuario no puede ver, modificar ni meterse en el hogar de otro, ni leer nada sin sesión. Se conectan a PostgreSQL y se hacen pasar por cada usuario.
- **Pruebas e2e de US-01 y US-02** (`tests/e2e/us-01-sign-in.spec.ts`): el flujo completo, del email al enlace y a la app, leyendo el enlace del buzón de pruebas, en escritorio y en móvil.
- La CI arranca Supabase local y ejecuta también las pruebas de integración y las e2e con inicio de sesión.
- Regla en `CLAUDE.md`: cada pull request de una historia incluye «Cómo probarlo a mano», para la prueba de aceptación en el despliegue de prueba de Vercel.
- **Pruebas automáticas en tres niveles, en la carpeta `tests/`:** unitarias (`unit/`) y de integración con la base de datos (`integration/`) con Vitest, y de extremo a extremo (`e2e/`) con **Playwright**, que usan la app en un navegador real, en escritorio y en móvil. Sirven para comprobar cada historia de usuario y para detectar regresiones al añadir funcionalidades. Las reglas están en `tests/README.md` y en `CLAUDE.md`.
- Primera prueba e2e (`app-shell.spec.ts`): la app compilada carga, el manifiesto de la PWA es correcto y el service worker queda activo.
- **Integración continua** (`.github/workflows/ci.yml`): en cada pull request y en cada cambio en `main`, GitHub instala las dependencias, pasa las pruebas, compila y ejecuta las pruebas e2e. Un pull request en rojo avisa de que algo se ha roto antes de fusionarlo.
- Chromium en la imagen de Docker (y por tanto en el dev container), para poder ejecutar las pruebas e2e en local con el mismo entorno.
- Un issue de GitHub por historia de usuario (US-01 = #2 … US-25 = #26), con sus criterios de aceptación y una definición de hecho que exige pruebas.
- **Dev container** (`.devcontainer/devcontainer.json`), requisito de la clase. Construye el mismo `Dockerfile` que `docker-compose.yml`, así que solo hay una imagen que mantener y `docker compose up` sigue funcionando igual. No reutiliza el servicio de Compose directamente porque las versiones recientes de Docker Compose rechazan el Dockerfile temporal que genera la extensión Dev Containers (error «additional privileges requested»).
- Vite escucha en todas las interfaces (`server.host` en `vite.config.ts`). Sin esto, dentro del dev container solo respondía al «localhost» del propio contenedor y la app no cargaba en el navegador del Mac.
- `git` en la imagen de desarrollo, necesario para el control de versiones desde VS Code y Claude Code dentro del contenedor.
- `docs/user-stories.md` con las historias de usuario del MVP y su prioridad (Must/Should), para acotar qué es imprescindible en la demo, y dos decisiones pendientes (datos de ejemplo e historial al borrar una tarea).
- `CLAUDE.md` con el contexto del proyecto, la arquitectura y las reglas para la IA (convenciones, secretos, cómo mantener este changelog).
- `CHANGELOG.md` para documentar los cambios y las decisiones importantes.
- `.nvmrc` con la versión de Node, para quien desarrolle sin Docker.
- `.env.example` con las variables que necesitará Supabase, sin valores reales.

### Changed
- **La app se llama «Limpieza de casa»** (antes «Limpieza casa»): título de la pestaña, pantallas y nombre de la app instalada. El nombre corto bajo el icono sigue siendo «Limpieza».
- `src/ui/` pasa a llamarse `src/components/`, el nombre habitual en proyectos React con Vite, para los componentes que comparten varias pantallas. Los de una sola pantalla siguen en su carpeta de `features/`.
- Los issues de las historias se enlazan en la tabla de `docs/user-stories.md`, en lugar de deducir el número («US-n es el #n+1»), que dejó de cumplirse porque los pull requests también usan números de GitHub.
- Scripts de pruebas separados: `npm test` (unitarias, sin dependencias), `npm run test:integration` (base de datos, necesita Supabase local) y `npm run test:e2e`. `npm run test:all` ejecuta todo.
- **Las pruebas van en `tests/` y no junto al código**, como pide la estructura de proyecto del curso. Las unitarias reflejan la ruta del código (`src/domain/x.ts` → `tests/unit/domain/x.test.ts`).
- **Flujo de trabajo con ramas por historia** (*GitHub Flow*): cada historia se desarrolla en una rama `feature/…` creada desde `main` y entra con un pull request. No hay rama `development`: Vercel ya crea una dirección de prueba para cada rama, y una rama intermedia compartiría la base de datos de producción.
- **Vitest actualizado de la versión 3 a la 5** para corregir dos vulnerabilidades críticas (en `tinypool`) y dos moderadas (en `@vitest/mocker`). Se hace ahora porque todavía no hay pruebas que puedan romperse con el cambio de versión. Quedan 10 vulnerabilidades bajas y moderadas en dependencias de compilación de `vite-plugin-pwa` (`workbox-build`): solo actúan al compilar, no llegan a la app publicada y no tienen arreglo hasta que el plugin publique una versión nueva.
- **Arquitectura: de datos en el navegador a base de datos en la nube.** Los datos pasan de IndexedDB a **Supabase** (PostgreSQL), y la app se desplegará en **Vercel**. Motivo: queremos usuarios reales y que toda la actividad quede guardada en un servidor, no en un solo navegador. Así los datos no se pierden si se borra el navegador y se podrán usar desde varios dispositivos.
- **La app necesitará conexión a internet.** Consecuencia directa del cambio anterior: con los datos en la nube, apuntar una tarea sin conexión obligaría a guardarla en una cola y sincronizarla después, y eso es bastante más complejo. Para el MVP la app seguirá siendo instalable, pero sin internet mostrará un aviso. El uso sin conexión pasa al backlog.
- **Inicio de sesión con enlace mágico por email, sin contraseña** (Supabase Auth). Es lo más sencillo para el usuario y evita gestionar contraseñas.
- **El modelo de datos incluye el hogar desde el principio** (`households` y `household_members`), aunque al inicio cada usuario tenga uno solo. Así, compartir la casa con otras personas (en el backlog) no obligará a rehacer la base de datos.
- **Docker pasa a ser el entorno de desarrollo.** Antes compilaba la app y la servía con nginx, pero en producción habrá Vercel, no nginx. Ahora `docker compose up` arranca Vite en http://localhost:5173 con el código montado, así que los cambios se ven al momento. La imagen usa Node 22 sobre Debian (`node:22-slim`), lo más parecido a donde compila Vercel.
- **Versión de Node fijada en 22** (`engines: "22.x"` en `package.json` y `.nvmrc`). Con `>=22.12`, Vercel elegiría la versión más nueva disponible y el entorno de desarrollo y el de producción podrían ser distintos.
- Nombres técnicos en inglés, siguiendo la convención del proyecto: `src/features/inicio`, `tareas` e `historial` pasan a `home`, `tasks` y `history`, y las variables CSS (`--color-fondo` → `--color-background`, etc.). La documentación y los textos de la app siguen en español.
- `.gitignore`: `.env.example` ya no se ignora (la regla `.env.*` lo incluía) y se añaden `Thumbs.db` y los temporales de la CLI de Supabase.

### Fixed
- **El enlace mágico llevaba a producción en lugar de al despliegue de prueba.** La app pedía volver a su dirección sin barra final (`https://dominio`), que no encaja con las Redirect URLs de Supabase (`https://dominio/**`), y Supabase mandaba a la Site URL sin avisar. Ahora pide volver a `https://dominio/`. En local no se notaba porque Supabase siempre acepta `localhost`; una prueba e2e comprueba ahora la dirección de vuelta del enlace, y el Supabase local usa el mismo formato de Redirect URLs que producción.

### Removed
- `nginx.conf` y la etapa de nginx del Dockerfile: Vercel sirve la app en producción y ya no hace falta.

## [0.1.0] - 2026-11-01

### Added
- Base del proyecto: React + TypeScript + Vite, PWA con vite-plugin-pwa, Vitest, Docker con nginx, README y `.gitignore`.
