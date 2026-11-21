import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { errorCode, type ErrorCode } from '../../domain/errors'
import type { LocalDate } from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { AlreadyDoneError } from '../../storage/tasks'
import { FieldError } from './FieldError'

// La fecha de una tarea que ya existe, dentro de su tarjeta. Solo hoy o un día futuro.
// - US-38 · En una puntual: ponerla, cambiarla o quitarla (con `remove`).
// - US-41 · En una de cada N días: cambiar cuándo toca la próxima vez. Siempre tiene una.
export function DueOnForm({
  taskId,
  taskName,
  dueOn,
  min,
  validate,
  save,
  remove,
  onSaved,
  onClose,
  onStale,
}: {
  taskId: string
  /** El nombre de la tarea, en el idioma elegido: para que se sepa de cuál es el formulario. */
  taskName: string
  /** La fecha que tiene ahora (`null`, sin fecha). */
  dueOn: LocalDate | null
  /** El primer día que se puede elegir. */
  min: LocalDate
  /** El aviso de la fecha escrita ('' si está vacía), o `undefined` si vale. */
  validate: (value: string) => string | undefined
  /** Guarda la fecha nueva. */
  save: (dueOn: LocalDate) => Promise<void>
  /** Quita la fecha (al pulsar «Quitar fecha» o al guardarla vacía). Sin ella, no se puede quitar. */
  remove?: () => Promise<void>
  /** Se ha guardado la fecha nueva (o `null`, si se ha quitado). */
  onSaved: (dueOn: LocalDate | null) => void
  onClose: () => void
  /** La lista no está al día (la tarea ya se hizo en otro dispositivo): hay que volver a cargarla. */
  onStale: () => void
}) {
  const { t } = useLanguage()
  const [value, setValue] = useState(dueOn ?? '')
  const [showError, setShowError] = useState(false)
  // Qué se está guardando: la fecha escrita o quitarla. El «Guardando…» sale en ese botón.
  const [saving, setSaving] = useState<'save' | 'remove' | null>(null)
  const [saveError, setSaveError] = useState<ErrorCode | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const fieldId = `due-on-${taskId}`
  // El aviso sale al intentar guardar, y después se pone al día solo al corregir la fecha.
  const error = showError ? validate(value) : undefined

  // Al abrirlo, se empieza por la fecha (también con el teclado o VoiceOver).
  useEffect(() => input.current?.focus(), [])

  async function run(target: 'save' | 'remove', newDueOn: LocalDate | null) {
    setSaving(target)
    setSaveError(null)
    try {
      if (newDueOn === null) await remove?.()
      else await save(newDueOn)
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
    if (validate(value)) {
      setShowError(true)
      input.current?.focus()
      return
    }
    void run('save', value || null)
  }

  return (
    <form className="stack due-on-form" aria-label={t.tasks.dueOnForm(taskName)} onSubmit={handleSubmit} noValidate>
      <label htmlFor={fieldId}>{t.tasks.dueOn}</label>
      <input
        id={fieldId}
        ref={input}
        type="date"
        min={min}
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
        {remove && dueOn !== null && (
          <button
            type="button"
            className="button-secondary"
            onClick={() => void run('remove', null)}
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
