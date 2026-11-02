import { useEffect, useState } from 'react'
import { onSessionChange, type Session } from '../../storage/auth'

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session }

/** Sesión actual. Se mantiene al cerrar y volver a abrir la app (US-01). */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  useEffect(
    () =>
      onSessionChange((session) => {
        setState(session ? { status: 'signed-in', session } : { status: 'signed-out' })
      }),
    [],
  )

  return state
}
