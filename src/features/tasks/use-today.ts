import { useEffect, useState } from 'react'
import { localDateIn } from '../../domain/dates'
import type { LocalDate } from '../../domain/task'

/** «Hoy» es siempre el día de Madrid, como en la base de datos. */
const TIME_ZONE = 'Europe/Madrid'

/**
 * El día de hoy en Madrid, al día: en el móvil la app puede quedarse en segundo plano
 * de un día para otro, así que se vuelve a calcular al volver a ella y, mientras está
 * abierta, una vez por minuto.
 */
export function useToday(): LocalDate {
  const [today, setToday] = useState(() => localDateIn(TIME_ZONE, new Date()))

  useEffect(() => {
    const update = () => setToday(localDateIn(TIME_ZONE, new Date()))
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    const timer = window.setInterval(update, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
      window.clearInterval(timer)
    }
  }, [])

  return today
}
