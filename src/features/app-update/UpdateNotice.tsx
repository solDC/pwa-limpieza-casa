import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/language-context'
import { useAppUpdate } from './use-app-update'

/**
 * Si al pulsar «Actualizar» la app no se ha recargado en este tiempo (por ejemplo, porque
 * se ha cortado la red al descargar la versión nueva), los botones vuelven a funcionar:
 * la ventana tapa toda la app y no puede quedarse bloqueada.
 */
const UPDATE_TIMEOUT_MS = 10_000

// Aviso de que hay una versión nueva de la app (#76): una ventana en el centro, para que
// se vea. «Más tarde» la cierra sin cortar lo que se esté haciendo, y vuelve a salir la
// próxima vez que se vuelva a la app.
export function UpdateNotice() {
  const { t } = useLanguage()
  const { updateAvailable, update } = useAppUpdate()
  const [updating, setUpdating] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  // Cuenta las veces que se vuelve a la app: así la ventana se comprueba cada vez, aunque
  // el navegador la haya cerrado por su cuenta (el segundo Escape de Chrome, más abajo).
  const [returns, setReturns] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const open = updateAvailable && !dismissed

  // `showModal()` oscurece el fondo, no deja usar lo de detrás y hace que los lectores de
  // pantalla (VoiceOver) anuncien la ventana. Los navegadores sin <dialog> (iOS anterior a
  // 15.4) no lo tienen: allí no sale el aviso, y la versión nueva llega al cerrar la app.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || typeof dialog.showModal !== 'function') return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open, returns])

  // Tras «Más tarde», vuelve a salir al volver a la app.
  useEffect(() => {
    const showAgain = () => {
      if (document.visibilityState !== 'visible') return
      setDismissed(false)
      setReturns((count) => count + 1)
    }
    document.addEventListener('visibilitychange', showAgain)
    return () => document.removeEventListener('visibilitychange', showAgain)
  }, [])

  async function startUpdate() {
    setUpdating(true)
    // Si todo va bien, la app se recarga antes de que pase este tiempo.
    const giveUp = window.setTimeout(() => setUpdating(false), UPDATE_TIMEOUT_MS)
    try {
      await update()
    } catch {
      window.clearTimeout(giveUp)
      setUpdating(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="update-dialog"
      aria-labelledby="update-dialog-text"
      // La tecla Escape cuenta como «Más tarde». Mientras se actualiza, no la cierra. (Chrome
      // de escritorio la cierra igual si se pulsa dos veces seguidas; no pasa nada, porque la
      // actualización sigue su curso.)
      onCancel={(event) => {
        if (updating) event.preventDefault()
        else setDismissed(true)
      }}
    >
      <p id="update-dialog-text">{t.update.available}</p>
      <div className="update-dialog-actions">
        <button
          type="button"
          className="button-secondary"
          onClick={() => setDismissed(true)}
          disabled={updating}
        >
          {t.update.later}
        </button>
        <button type="button" onClick={() => void startUpdate()} disabled={updating}>
          {updating ? t.update.updating : t.update.update}
        </button>
      </div>
    </dialog>
  )
}
