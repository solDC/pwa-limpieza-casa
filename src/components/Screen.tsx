import type { ReactNode } from 'react'

/** Una pantalla de la app, con su título «Limpieza de casa». */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="app">
      <h1>Limpieza de casa</h1>
      {children}
    </main>
  )
}
