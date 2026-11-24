import { formatDayMonth } from '../../domain/dates'
import type { FrequencyDraft, FrequencyErrors } from '../../domain/new-task'
import type { Frequency, LocalDate } from '../../domain/task'
import { useLanguage } from '../../i18n/language-context'
import { FieldError } from './FieldError'

const frequencyKinds: Frequency['kind'][] = ['weekendWeekly', 'weekendBiweekly', 'interval', 'oneOff']

/**
 * Cada cuánto toca una tarea, con lo que pide cada frecuencia: los días en las de cada N días
 * (y, al crearla, el día en que toca la primera vez, US-50), el primer finde en las de cada 15
 * días y la fecha opcional de las puntuales (US-38). En el formulario de tarea nueva (US-33) y
 * en el de «Cambiar frecuencia» (US-53).
 */
export function FrequencyFields({
  idPrefix,
  draft,
  errors,
  weekends,
  today,
  showFirstDueOn,
  showDueOn,
  disabled,
  onChange,
}: {
  /** Para que los campos de cada formulario tengan su propio id. */
  idPrefix: string
  draft: FrequencyDraft
  errors: FrequencyErrors | null
  /** Los sábados de los findes que se ofrecen para empezar una de cada 15 días. */
  weekends: LocalDate[]
  today: LocalDate
  /** Si se pide el día en que toca la primera vez una de cada N días (al crearla). */
  showFirstDueOn: boolean
  /** Si se pide la fecha de una puntual. */
  showDueOn: boolean
  disabled: boolean
  onChange: (changes: Partial<FrequencyDraft>) => void
}) {
  const { language, t } = useLanguage()
  // Si el formulario ya no vale (para enlazar cada error con su campo).
  const invalid = (message: string | undefined) => (message ? true : undefined)
  const id = (field: string) => `${idPrefix}-${field}`

  function chooseFrequency(kind: Frequency['kind']) {
    onChange({
      frequencyKind: kind,
      // Sale elegido el primero de los dos findes que se ofrecen.
      biweeklyStartOn:
        kind === 'weekendBiweekly' ? (draft.biweeklyStartOn ?? weekends[0]) : draft.biweeklyStartOn,
    })
  }

  return (
    <>
      <fieldset
        className="stack"
        aria-invalid={invalid(errors?.frequency)}
        aria-describedby={errors?.frequency ? id('frequency-error') : undefined}
        tabIndex={errors?.frequency ? -1 : undefined}
        disabled={disabled}
      >
        <legend>{t.newTask.frequency}</legend>
        {frequencyKinds.map((kind) => (
          <label key={kind} className="choice">
            <input
              type="radio"
              name={id('frequency')}
              checked={draft.frequencyKind === kind}
              onChange={() => chooseFrequency(kind)}
            />
            {t.newTask[kind]}
          </label>
        ))}
        <FieldError id={id('frequency-error')} message={errors?.frequency} />
      </fieldset>

      {draft.frequencyKind === 'interval' && (
        <>
          <label htmlFor={id('interval-days')}>{t.newTask.intervalDays}</label>
          <input
            id={id('interval-days')}
            inputMode="numeric"
            value={draft.intervalDays}
            onChange={(event) => onChange({ intervalDays: event.target.value })}
            aria-invalid={invalid(errors?.intervalDays)}
            aria-describedby={errors?.intervalDays ? id('interval-days-error') : undefined}
            disabled={disabled}
          />
          <FieldError id={id('interval-days-error')} message={errors?.intervalDays} />
          {/* US-50 · El día en que toca la primera vez: hoy, si no se cambia. */}
          {showFirstDueOn && (
            <>
              <label htmlFor={id('first-due-on')}>{t.newTask.firstDueOn}</label>
              <input
                id={id('first-due-on')}
                type="date"
                min={today}
                value={draft.firstDueOn ?? today}
                onChange={(event) => onChange({ firstDueOn: event.target.value })}
                aria-invalid={invalid(errors?.firstDueOn)}
                aria-describedby={errors?.firstDueOn ? id('first-due-on-error') : undefined}
                disabled={disabled}
              />
              <FieldError id={id('first-due-on-error')} message={errors?.firstDueOn} />
            </>
          )}
        </>
      )}

      {/* US-38 · La fecha de una puntual, opcional: sin ella, queda «Sin fecha». */}
      {draft.frequencyKind === 'oneOff' && showDueOn && (
        <>
          <label htmlFor={id('due-on')}>{t.newTask.dueOn}</label>
          <input
            id={id('due-on')}
            type="date"
            min={today}
            value={draft.dueOn ?? ''}
            onChange={(event) => onChange({ dueOn: event.target.value || null })}
            aria-invalid={invalid(errors?.dueOn)}
            aria-describedby={errors?.dueOn ? id('due-on-error') : undefined}
            disabled={disabled}
          />
          <FieldError id={id('due-on-error')} message={errors?.dueOn} />
        </>
      )}

      {draft.frequencyKind === 'weekendBiweekly' && (
        <fieldset
          className="stack"
          aria-invalid={invalid(errors?.biweeklyStartOn)}
          aria-describedby={errors?.biweeklyStartOn ? id('biweekly-error') : undefined}
          disabled={disabled}
        >
          <legend>{t.newTask.firstWeekend}</legend>
          {weekends.map((saturday) => (
            <label key={saturday} className="choice">
              <input
                type="radio"
                name={id('biweekly-start')}
                checked={draft.biweeklyStartOn === saturday}
                onChange={() => onChange({ biweeklyStartOn: saturday })}
              />
              {t.newTask.weekendOf(formatDayMonth(saturday, language))}
            </label>
          ))}
          <FieldError id={id('biweekly-error')} message={errors?.biweeklyStartOn} />
        </fieldset>
      )}
    </>
  )
}
