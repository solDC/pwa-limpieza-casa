import { useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { errorCode, type ErrorCode } from '../../domain/errors'
import { canMarkDone, describeDue, type Round } from '../../domain/frequency'
import {
  describeFrequency,
  partDisplayName,
  taskDisplayName,
  type LocalDate,
  type Task,
} from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { AlreadyDoneError, completeTask } from '../../storage/tasks'

// La tarjeta de una tarea: su frecuencia, cuándo toca (US-28 y US-29), sus partes con su
// peso y el botón para marcarla como hecha (US-30).
export function TaskItem({
  task,
  round,
  today,
  onCompleted,
  onStale,
}: {
  task: Task
  /** La vuelta que se muestra (las puntuales ya hechas no llegan aquí). */
  round: Round
  today: LocalDate
  onCompleted: (taskId: string, completedOn: LocalDate) => void
  /** La lista no está al día (se marcó en otro dispositivo): hay que volver a cargarla. */
  onStale: () => void
}) {
  const { language, t } = useLanguage()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)

  async function handleComplete() {
    setSaving(true)
    setError(null)
    try {
      // Solo se muestra como hecha cuando la base de datos lo ha guardado.
      onCompleted(task.id, await completeTask(task, round))
    } catch (saveError) {
      setError(errorCode(saveError, 'saveFailed'))
      if (saveError instanceof AlreadyDoneError) onStale()
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="card">
      <h3>{taskDisplayName(task, language)}</h3>
      <p className="muted">{describeFrequency(task.frequency, language)}</p>
      <p className="due">{describeDue(task.frequency, round, today, language)}</p>
      {task.parts.length > 0 && (
        <p>
          {task.parts
            .map((part) => `${partDisplayName(part, language)} ${part.weight} %`)
            .join(' · ')}
        </p>
      )}
      {canMarkDone(task, round, today) && (
        <button type="button" onClick={handleComplete} disabled={saving}>
          {saving ? t.tasks.saving : t.tasks.markDone}
        </button>
      )}
      {error && <ErrorMessage>{t.errors[error]}</ErrorMessage>}
    </li>
  )
}
