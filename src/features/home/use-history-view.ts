import { useEffect, useState } from 'react'

// US-56 · El histórico (US-31) como una entrada del historial del navegador: así el botón atrás
// (el de Android, el del navegador o el del ratón) vuelve de él a «Tus tareas», y desde «Tus
// tareas» sale de la app, como siempre. La dirección de la página no cambia: la entrada se
// marca en su estado (`history.state`).

const HISTORY_VIEW = 'history'

function isHistoryEntry(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { view?: unknown }).view === HISTORY_VIEW
}

/**
 * Si se ve el histórico, y cómo abrirlo y cerrarlo. Al recargar la página en el histórico, se
 * sigue en él: la entrada del historial sigue ahí, y si no, desde «Tus tareas» habría que
 * pulsar atrás dos veces para salir.
 */
export function useHistoryView() {
  const [showHistory, setShowHistory] = useState(() => isHistoryEntry(window.history.state))

  useEffect(() => {
    const update = (event: PopStateEvent) => setShowHistory(isHistoryEntry(event.state))
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  function openHistory() {
    window.history.pushState({ ...(window.history.state as object | null), view: HISTORY_VIEW }, '')
    setShowHistory(true)
  }

  /** «Volver» hace lo mismo que el botón atrás, para no dejar una entrada de más en el historial. */
  function closeHistory() {
    if (isHistoryEntry(window.history.state)) window.history.back()
    else setShowHistory(false)
  }

  return { showHistory, openHistory, closeHistory }
}
