# Entorno de desarrollo.
# Node 22 sobre Debian (glibc), lo más parecido a la imagen con la que compila Vercel.
# El código no se copia: docker-compose.yml monta la carpeta del proyecto,
# así que los cambios se ven al momento sin reconstruir la imagen.
FROM node:22-slim

# git hace falta dentro del contenedor para usar el control de versiones
# desde VS Code (dev container) y desde Claude Code.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Las dependencias se instalan dentro de la imagen, para Linux.
# Se reinstalan solo cuando cambian package.json o package-lock.json.
COPY package.json package-lock.json ./
RUN npm ci

# Navegador Chromium y sus librerías del sistema, para las pruebas de extremo a extremo
# (Playwright). Se instala la versión que corresponde a @playwright/test en package-lock.json:
# si se actualiza Playwright, hay que reconstruir la imagen.
RUN npx playwright install --with-deps chromium

EXPOSE 5173

# --host hace que Vite escuche fuera del contenedor (si no, solo responde dentro).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
