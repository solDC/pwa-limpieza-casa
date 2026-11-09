import { useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Cada cuánto se busca una versión nueva mientras la app está abierta. */
const CHECK_EVERY_MS = 60 * 60 * 1000

/**
 * Versión nueva de la app (#76). La app se guarda en el dispositivo (service worker) y
 * solo buscaba versiones nuevas al cargar la página: una pestaña abierta, o la app
 * instalada del iPhone al volver del segundo plano, se quedaba con la vieja.
 *
 * Ahora busca también al volver a la app y cada hora. Si hay una versión nueva, no
 * recarga sola (podría cortar a quien está guardando algo): avisa, y `update()` la carga.
 */
export function useAppUpdate(): { updateAvailable: boolean; update: () => Promise<void> } {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const {
    needRefresh: [updateAvailable],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      registrationRef.current = registration
      const check = () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', check)
      window.setInterval(check, CHECK_EVERY_MS)
    },
  })

  async function update() {
    // Normalmente la página funciona con la copia guardada: la versión nueva espera, se le
    // pide que se active y la librería recarga cuando toma el control.
    if (navigator.serviceWorker.controller) return updateServiceWorker(true)
    // La primera vez que se abre la app, ninguna página depende de la copia guardada, así
    // que la versión nueva ya se ha activado sola (o se activa en cuanto termine): basta
    // con recargar cuando esté activa.
    const pending = registrationRef.current?.waiting ?? registrationRef.current?.installing
    if (pending) {
      pending.addEventListener('statechange', () => {
        if (pending.state === 'activated') window.location.reload()
      })
      await updateServiceWorker(true)
    } else {
      window.location.reload()
    }
  }

  return { updateAvailable, update }
}
