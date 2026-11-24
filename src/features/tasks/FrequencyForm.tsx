import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import {
  changeFrequencyWeekends,
  frequencyDraftOf,
  validateFrequencyChange,
} from '../../domain/change-frequency'
import { errorCode, type ErrorCode } from '../../domain/errors'
import type { Round } from '../../domain/frequency'
import type { FrequencyDraft } from '../../domain/new-task'
import type { Frequency, LocalDate, Task } from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { changeTaskFrequency } from '../../storage/tasks'
import { FrequencyFields } from './FrequencyFields'

// US-53 · Cambiar cada cuánto toca una tarea, dentro de su tarjeta: las cuatro frecuencias y
// lo que pide cada una, como al crearla (US-33). Sin cambiar nada, «Guardar» lo cierra.
export function FrequencyForm({
  task,
  taskName,
  round,
  today,
  onSaved,
  onClose,
}: {
  task: Task
  /** El nombre de la tarea, en el idioma elegido: para que se sepa de cuál es el formulario. */
  taskName: string
  /** La vuelta que se muestra: si está a medias, la nueva no puede ser la misma. */
  round: Round
  today: LocalDate
  /** Se ha guardado: la frecuencia, desde qué día cuenta y, en las de cada N días, si toca hoy. */
  onSaved: (frequency: Frequency, frequencySince: LocalDate, nextDueOn: LocalDate | null) => void
  onClose: () => void
}) {
  const { language, t } = useLanguage()
  const [draft, setDraft] = useState<FrequencyDraft>(() => frequencyDraftOf(task))
  // Los errores salen al intentar guardar, no mientras se elige.
  const [showErrors, setShowErrors] = useState(false)
  const validation = validateFrequencyChange(task, draft, language, today)
  const errors = showErrors && validation.status === 'invalid' ? validation.errors : null
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<ErrorCode | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const weekends = changeFrequencyWeekends(task, round, today)
  // La fecha de una puntual se cambia con «Cambiar fecha» (US-38): aquí solo al pasar a puntual.
  const showDueOn = task.frequency.kind !== 'oneOff'

  // Al abrirlo, se empieza por la frecuencia que tiene (también con el teclado o VoiceOver).
  useEffect(() => formRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus(), [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaveError(null)
    if (validation.status === 'unchanged') return onClose()
    if (validation.status === 'invalid') {
      setShowErrors(true)
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
      return
    }
    setShowErrors(false)
    setSaving(true)
    try {
      const saved = await changeTaskFrequency(task.id, validation.frequency)
      onSaved(validation.frequency, saved.frequencySince, saved.nextDueOn)
      onClose()
    } catch (saveFailed) {
      setSaveError(errorCode(saveFailed, 'saveFailed'))
      setSaving(false)
    }
  }

  return (
    <form
      ref={formRef}
      className="stack due-on-form"
      aria-label={t.tasks.frequencyForm(taskName)}
      onSubmit={handleSubmit}
      noValidate
    >
      <FrequencyFields
        idPrefix={`frequency-${task.id}`}
        draft={draft}
        errors={errors}
        weekends={weekends}
        today={today}
        showFirstDueOn={false}
        showDueOn={showDueOn}
        disabled={saving}
        onChange={(changes) => setDraft({ ...draft, ...changes })}
      />
      <p className="muted">{t.tasks.frequencyChangeHint}</p>
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
