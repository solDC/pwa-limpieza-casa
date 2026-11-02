import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Único punto de la app que crea el cliente de Supabase.
// La URL y la clave anon son públicas: la seguridad la ponen las reglas RLS de la base de datos.

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).')
  }
  client ??= createClient(url, anonKey, {
    auth: {
      // El enlace mágico vuelve a la app con la sesión en la URL; el cliente la recoge,
      // la guarda en el navegador y la renueva sola.
      flowType: 'implicit',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  return client
}
