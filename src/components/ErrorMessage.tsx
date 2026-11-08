import type { ReactNode } from 'react'

/** Un aviso de error. Con `role="alert"`, los lectores de pantalla lo leen en cuanto sale. */
export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p className="error" role="alert">
      {children}
    </p>
  )
}
