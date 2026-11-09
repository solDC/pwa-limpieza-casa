/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // La versión nueva se carga cuando el usuario pulsa «Actualizar» en el aviso (#76),
      // no sola: ver src/features/app-update/. La app registra el service worker ahí.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Limpieza de casa',
        // El completo también al instalarla: el iPhone lo propone como nombre del icono.
        short_name: 'Limpieza de casa',
        description: 'Organiza las tareas de mantenimiento del hogar',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        theme_color: '#5E7F64',
        background_color: '#F7F3EC',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  // Escucha en todas las interfaces: necesario para que la app se vea desde fuera
  // del dev container (VS Code redirige el puerto 5173 a tu navegador).
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  // Vitest: pruebas unitarias (tests/unit) y de integración (tests/integration).
  // Las de extremo a extremo (tests/e2e) son de Playwright y no pasan por aquí.
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
  },
})
