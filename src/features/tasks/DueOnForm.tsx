import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { errorCode, type ErrorCode } from '../../domain/errors'
import { dueOnError } from '../../domain/new-task'
import type { LocalDate } from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { AlreadyDoneError, setTaskDueOn } from '../../storage/tasks'
import { FieldError } from './FieldError'

// US-38 · Poner fecha a una tarea puntual que ya existe, cambiarla o quitarla. Se abre
// dentro de su tarjeta. Solo hoy o un día futuro.
export function DueOnForm({
  taskId,
  taskName,
  dueOn,
  today,
  onSaved,
  onClose,
  onStale,
}: {
  taskId: string
  /** El nombre de la tarea, en el idioma elegido: para que se sepa de cuál es el formulario. */
  taskName: string
  /** La fecha que tiene ahora (`null`, sin fecha). */
  dueOn: LocalDate | null
  today: LocalDate
  /** Se ha guardado la fecha nueva (o `null`, si se ha quitado). */
  onSaved: (dueOn: LocalDate | null) => void
  onClose: () => void
  /** La lista no está al día (la tarea ya se hizo en otro dispositivo): hay que volver a cargarla. */
  onStale: () => void
}) {
  const { language, t } = useLanguage()
  const [value, setValue] = useState(dueOn ?? '')
  const [showError, setShowError] = useState(false)
  // Qué se está guardando: la fecha escrita o quitarla. El «Guardando…» sale en ese botón.
  const [saving, setSaving] = useState<'save' | 'remove' | null>(null)
  const [saveError, setSaveError] = useState<ErrorCode | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const fieldId = `due-on-${taskId}`
  // El aviso sale al intentar guardar, y después se pone al día solo al corregir la fecha.
  const error = showError ? dueOnError(value || null, today, language) : undefined

  // Al abrirlo, se empieza por la fecha (también con el teclado o VoiceOver).
  useEffect(() => input.current?.focus(), [])

  async function save(target: 'save' | 'remove', newDueOn: LocalDate | null) {
    setSaving(target)
    setSaveError(null)
    try {
      await setTaskDueOn(taskId, newDueOn)
      onSaved(newDueOn)
      onClose()
    } catch (saveFailure) {
      setSaveError(errorCode(saveFailure, 'saveFailed'))
      setSaving(null)
      if (saveFailure instanceof AlreadyDoneError) onStale()
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const newDueOn = value || null
    if (dueOnError(newDueOn, today, language)) {
      setShowError(true)
      input.current?.focus()
      return
    }
    void save('save', newDueOn)
  }

  return (
    <form className="stack due-on-form" aria-label={t.tasks.dueOnForm(taskName)} onSubmit={handleSubmit} noValidate>
      <label htmlFor={fieldId}>{t.tasks.dueOn}</label>
      <input
        id={fieldId}
        ref={input}
        type="date"
        min={today}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        disabled={saving !== null}
      />
      <FieldError id={`${fieldId}-error`} message={error} />
      {saveError && <ErrorMessage>{t.errors[saveError]}</ErrorMessage>}
      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onClose} disabled={saving !== null}>
          {t.tasks.cancel}
        </button>
        {dueOn !== null && (
          <button
            type="button"
            className="button-secondary"
            onClick={() => void save('remove', null)}
            disabled={saving !== null}
          >
            {saving === 'remove' ? t.tasks.saving : t.tasks.removeDueOn}
          </button>
        )}
        <button type="submit" disabled={saving !== null}>
          {saving === 'save' ? t.tasks.saving : t.tasks.saveDueOn}
        </button>
      </div>
    </form>
  )
}
