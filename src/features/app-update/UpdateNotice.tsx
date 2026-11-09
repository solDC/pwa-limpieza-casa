import { useState } from 'react'
import { useAppUpdate } from './use-app-update'

// Aviso de que hay una versión nueva de la app (#76), abajo y siempre a la vista.
export function UpdateNotice() {
  const { updateAvailable, update } = useAppUpdate()
  const [updating, setUpdating] = useState(false)
  if (!updateAvailable) return null

  return (
    <div className="update-notice" role="status">
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
    </div>
  )
}
