import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { errorCode, type ErrorCode } from '../../domain/errors'
import { describeWeekend } from '../../domain/frequency'
import type { LocalDate } from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { moveWeekendTask } from '../../storage/tasks'

// US-42 · Mover una tarea de fin de semana a otro finde, dentro de su tarjeta. Se elige de
// una lista de los próximos findes, así que siempre es un sábado y nunca uno pasado.
export function MoveWeekendForm({
  taskId,
  taskName,
  options,
  onSaved,
  onClose,
}: {
  taskId: string
  /** El nombre de la tarea, en el idioma elegido: para que se sepa de cuál es el formulario. */
  taskName: string
  /** Los sábados de los findes que se pueden elegir (`moveWeekendOptions()`). */
  options: LocalDate[]
  /** Se ha movido al finde de ese sábado (ya guardado). */
  onSaved: (saturday: LocalDate) => void
  onClose: () => void
}) {
  const { language, t } = useLanguage()
  const [chosen, setChosen] = useState(options[0])
  // La lista puede cambiar con el formulario abierto (se marca la tarea, o pasa la medianoche):
  // si el finde elegido ya no está, se usa el primero, el mismo que muestra la lista.
  const saturday = options.includes(chosen) ? chosen : options[0]
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<ErrorCode | null>(null)
  const select = useRef<HTMLSelectElement>(null)
  const fieldId = `move-weekend-${taskId}`

  // Al abrirlo, se empieza por la lista (también con el teclado o VoiceOver).
  useEffect(() => select.current?.focus(), [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      await moveWeekendTask(taskId, saturday)
      onSaved(saturday)
      onClose()
    } catch (moveError) {
      setSaveError(errorCode(moveError, 'saveFailed'))
      setSaving(false)
    }
  }

  return (
    <form className="stack due-on-form" aria-label={t.tasks.moveWeekendForm(taskName)} onSubmit={handleSubmit}>
      <label htmlFor={fieldId}>{t.tasks.moveWeekendTo}</label>
      <select
        id={fieldId}
        ref={select}
        value={saturday}
        onChange={(event) => setChosen(event.target.value)}
        disabled={saving}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {describeWeekend(option, language)}
          </option>
        ))}
      </select>
      {saveError && <ErrorMessage>{t.errors[saveError]}</ErrorMessage>}
      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>
          {t.tasks.cancel}
        </button>
        <button type="submit" disabled={saving}>
          {saving ? t.tasks.saving : t.tasks.save}
        </button>
      </div>
    </form>
  )
}
