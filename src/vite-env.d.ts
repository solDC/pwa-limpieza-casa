/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

// Variables de entorno que usa la app. Son públicas: acaban en el navegador.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
