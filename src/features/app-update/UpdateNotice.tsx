import { useEffect, useRef, useState } from 'react'
import { useAppUpdate } from './use-app-update'

// Aviso de que hay una versión nueva de la app (#76): una ventana en el centro, para que
// se vea. «Más tarde» la cierra sin cortar lo que se esté haciendo, y vuelve a salir la
// próxima vez que se vuelva a la app.
export function UpdateNotice() {
  const { updateAvailable, update } = useAppUpdate()
  const [updating, setUpdating] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const open = updateAvailable && !dismissed

  // `showModal()` oscurece el fondo, no deja usar lo de detrás y hace que los lectores de
  // pantalla (VoiceOver) anuncien la ventana.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Tras «Más tarde», vuelve a salir al volver a la app.
  useEffect(() => {
    const showAgain = () => {
      if (document.visibilityState === 'visible') setDismissed(false)
    }
    document.addEventListener('visibilitychange', showAgain)
    return () => document.removeEventListener('visibilitychange', showAgain)
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="update-dialog"
      aria-labelledby="update-dialog-text"
      // Se cierra con «Más tarde» o con la tecla Escape: las dos cuentan como «Más tarde».
      onClose={() => setDismissed(true)}
      // Mientras se actualiza, no se puede cerrar.
      onCancel={(event) => {
        if (updating) event.preventDefault()
      }}
    >
      <p id="update-dialog-text">Hay una versión nueva de la app.</p>
      <div className="update-dialog-actions">
        <button
          type="button"
          className="button-secondary"
          onClick={() => setDismissed(true)}
          disabled={updating}
        >
          Más tarde
        </button>
        <button
          type="button"
          onClick={() => {
            setUpdating(true)
            void update()
          }}
          disabled={updating}
        >
          {updating ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
    </dialog>
  )
}
