import { useEffect, useRef, useState } from 'react'
import { errorCode, type ErrorCode } from '../../domain/errors'
import { hasOlderHistory, historyDays, historyPage, type HistoryDay, type HistoryTask } from '../../domain/history'
import type { LocalDate } from '../../domain/task'
import { listHistory } from '../../storage/history'
import { listTasks } from '../../storage/tasks'

export type HistoryState =
  | { status: 'loading' }
  | { status: 'error'; error: ErrorCode }
  | {
      status: 'loaded'
      /** Las páginas cargadas, de 4 semanas cada una, de la más reciente a la más antigua. */
      days: HistoryDay[]
      /** Si puede haber más antes («Ver más»). */
      hasMore: boolean
      loadingMore: boolean
      moreError: ErrorCode | null
    }

/**
 * US-31 · El histórico de las tareas del hogar: primero las últimas 4 semanas hasta `today`, y
 * `loadMore` carga las 4 anteriores. `today` es el de cuando se abre: las páginas siguientes
 * siguen a la primera aunque cambie el día con la pantalla abierta.
 */
export function useHistory(today: LocalDate) {
  const [state, setState] = useState<HistoryState>({ status: 'loading' })
  const [openedOn] = useState(today)
  const tasks = useRef<HistoryTask[]>([])
  const pages = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const { from, to } = historyPage(openedOn, 0)
    Promise.all([listTasks(), listHistory(from, to)])
      .then(([loadedTasks, { rounds, parts }]) => {
        if (!mounted.current) return
        tasks.current = loadedTasks
        pages.current = 1
        setState({
          status: 'loaded',
          days: historyDays(loadedTasks, rounds, parts, from, to, openedOn),
          hasMore: hasOlderHistory(loadedTasks, from),
          loadingMore: false,
          moreError: null,
        })
      })
      .catch((error: unknown) => {
        if (mounted.current) setState({ status: 'error', error: errorCode(error, 'historyLoad') })
      })
    return () => {
      mounted.current = false
    }
  }, [openedOn])

  function loadMore() {
    if (state.status !== 'loaded' || state.loadingMore) return
    const { from, to } = historyPage(openedOn, pages.current)
    setState({ ...state, loadingMore: true, moreError: null })
    listHistory(from, to)
      .then(({ rounds, parts }) => {
        if (!mounted.current) return
        pages.current += 1
        const older = historyDays(tasks.current, rounds, parts, from, to, openedOn)
        setState((current) =>
          current.status === 'loaded'
            ? {
                ...current,
                days: [...current.days, ...older],
                hasMore: hasOlderHistory(tasks.current, from),
                loadingMore: false,
              }
            : current,
        )
      })
      .catch((error: unknown) => {
        if (!mounted.current) return
        setState((current) =>
          current.status === 'loaded'
            ? { ...current, loadingMore: false, moreError: errorCode(error, 'historyLoad') }
            : current,
        )
      })
  }

  return { state, openedOn, loadMore }
}
