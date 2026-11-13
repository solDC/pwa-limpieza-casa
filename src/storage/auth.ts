import { AuthApiError, AuthError, type Session as SupabaseSession } from '@supabase/supabase-js'
import { AppError, type ErrorCode } from '../domain/errors'
import type { Language } from '../domain/language'
import { getSupabase } from './supabase-client'

// Inicio de sesión con enlace mágico (US-01).

export type Session = {
  userId: string
  email: string
  /** El idioma guardado en la cuenta, que decide el idioma del email para entrar (US-52). */
  language: string | null
}

function toSession(session: SupabaseSession | null): Session | null {
  if (!session) return null
  const language: unknown = session.user.user_metadata?.lang
  return {
    userId: session.user.id,
    email: session.user.email ?? '',
    language: typeof language === 'string' ? language : null,
  }
}

/**
 * Envía el email para entrar. Si el email es nuevo, Supabase crea el usuario (y la base de
 * datos, su hogar) y guarda `language` en su cuenta: la plantilla del email lo usa para
 * salir en ese idioma. En una cuenta que ya existe no lo cambia: eso lo hace
 * `saveAccountLanguage` cuando ya se ha entrado.
 */
export async function sendMagicLink(email: string, language: Language): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      // Al abrir el enlace, vuelve a la misma dirección desde la que se pidió.
      // Con la barra final: las Redirect URLs de Supabase tienen la forma «https://dominio/**»
      // y «https://dominio» (sin barra) no encaja; Supabase mandaría a la Site URL (producción).
      emailRedirectTo: `${window.location.origin}/`,
      data: { lang: language },
    },
  })
  if (error) throw new AppError(describeAuthError(error))
}

/**
 * Entra con el código del email (US-26). Es la alternativa al enlace para la app instalada
 * en el iPhone, que no recibe la sesión del enlace porque iOS lo abre en Safari.
 */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await getSupabase().auth.verifyOtp({ email, token: code, type: 'email' })
  if (error) throw new AppError(describeCodeError(error))
}

/**
 * Cierra la sesión en este dispositivo (US-03). Los demás dispositivos siguen dentro:
 * la historia es para no dejar el hogar abierto en un dispositivo compartido.
 * Sin conexión también se cierra: Supabase borra la sesión del dispositivo aunque no pueda
 * avisar al servidor. Solo da error en casos raros (por ejemplo, si no puede renovar una
 * sesión caducada), y entonces la sesión sigue abierta y se avisa.
 */
export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut({ scope: 'local' })
  if (error) {
    throw new AppError(isNetworkError(error) ? 'signOutNetwork' : 'signOutFailed')
  }
}

/**
 * Guarda en la cuenta el idioma elegido (US-52), para que el próximo email para entrar
 * salga en ese idioma. Si falla, no pasa nada: se vuelve a intentar la próxima vez.
 */
export async function saveAccountLanguage(language: Language): Promise<void> {
  await getSupabase().auth.updateUser({ data: { lang: language } })
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
 * Lo lee, limpia la URL y devuelve qué ha pasado, para mostrarlo.
 */
export function takeSignInErrorFromUrl(): ErrorCode | null {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const code = params.get('error_code') ?? params.get('error')
  if (!code) return null
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return code === 'otp_expired' ? 'linkExpired' : 'linkFailed'
}

function describeCodeError(error: Error): ErrorCode {
  if (isServerError(error)) return 'codeServer'
  if (isNetworkError(error)) return 'codeNetwork'
  if (error instanceof AuthApiError && error.status === 429) return 'codeRateLimit'
  return 'codeWrong'
}

// supabase-js marca igual los fallos de red y los errores del servidor (5xx): los dos son
// «AuthRetryableFetchError». Los distingue el estado: 0 si no hubo respuesta, 5xx si la hubo.
function isServerError(error: Error): boolean {
  return error instanceof AuthError && (error.status ?? 0) >= 500
}

function isNetworkError(error: Error): boolean {
  if (isServerError(error)) return false
  return error.name === 'AuthRetryableFetchError' || error.message === 'Failed to fetch'
}

function describeAuthError(error: Error): ErrorCode {
  if (error instanceof AuthApiError && error.status === 429) return 'emailRateLimit'
  if (isNetworkError(error)) return 'emailNetwork'
  return 'emailFailed'
}
