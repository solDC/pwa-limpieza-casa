import { useEffect, useState } from 'react'
import { useAppUpdate } from './use-app-update'

// Aviso de que hay una versión nueva de la app (#76), abajo y siempre a la vista.
export function UpdateNotice() {
  const { updateAvailable, update } = useAppUpdate()
  const [updating, setUpdating] = useState(false)

  // Mientras se ve, la página deja sitio abajo para que el aviso no tape lo último
  // (por ejemplo, «Cerrar sesión»).
  useEffect(() => {
    document.body.classList.toggle('has-update-notice', updateAvailable)
  }, [updateAvailable])

  // La región `status` está siempre en la página, vacía si no hay versión nueva: los
  // lectores de pantalla (VoiceOver en el iPhone) solo leen lo que aparece dentro de una
  // región que ya existía.
  return (
    <div className={updateAvailable ? 'update-notice' : undefined} role="status">
      {updateAvailable && (
        <>
          <p>Hay una versión nueva de la app.</p>
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
        </>
      )}
    </div>
  )
}
