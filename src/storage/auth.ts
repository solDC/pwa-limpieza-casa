import { AuthApiError, type Session as SupabaseSession } from '@supabase/supabase-js'
import { getSupabase } from './supabase-client'

// Inicio de sesión con enlace mágico (US-01).

export type Session = {
  userId: string
  email: string
}

function toSession(session: SupabaseSession | null): Session | null {
  if (!session) return null
  return { userId: session.user.id, email: session.user.email ?? '' }
}

/** Envía el enlace mágico. Si el email es nuevo, Supabase crea el usuario (y la base de datos, su hogar). */
export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      // Al abrir el enlace, vuelve a la misma dirección desde la que se pidió.
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) throw new Error(describeAuthError(error))
}

/** Avisa cada vez que cambia la sesión, empezando por la actual. Devuelve cómo dejar de escuchar. */
export function onSessionChange(listener: (session: Session | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    listener(toSession(session))
  })
  return () => data.subscription.unsubscribe()
}

/**
 * Si se abrió un enlace caducado o ya usado, Supabase vuelve a la app con el error en la URL.
 * Lo lee, limpia la URL y devuelve un mensaje para mostrar.
 */
export function takeSignInErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const code = params.get('error_code') ?? params.get('error')
  if (!code) return null
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  if (code === 'otp_expired') {
    return 'El enlace ha caducado o ya se ha usado. Pide uno nuevo.'
  }
  return 'No se ha podido entrar con ese enlace. Pide uno nuevo.'
}

function describeAuthError(error: Error): string {
  if (error instanceof AuthApiError && error.status === 429) {
    return 'Has pedido demasiados enlaces seguidos. Espera un poco y vuelve a intentarlo.'
  }
  if (error.name === 'AuthRetryableFetchError' || error.message === 'Failed to fetch') {
    return 'No se ha podido enviar el enlace. Comprueba tu conexión a internet.'
  }
  return 'No se ha podido enviar el enlace. Inténtalo de nuevo.'
}
