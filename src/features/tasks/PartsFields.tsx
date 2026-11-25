import type { Key } from 'react'
import { LineIcon } from '../../components/LineIcon'
import { MAX_PARTS, weightsTotal, type PartsDraft, type PartsErrors } from '../../domain/new-task'
import { useLanguage } from '../../i18n/language-context'
import { FieldError } from './FieldError'

// Las partes de una tarea y su peso, con lo que suman, «Quitar» y «Añadir parte»: al crearla
// (US-33 y US-34) y al cambiarlas en una que ya existe (US-51). El formulario guarda las
// partes (`draft`) y decide qué hace cada botón.
export function PartsFields({
  idPrefix,
  legend,
  hint,
  draft,
  partKeys,
  errors,
  disabled,
  onAdd,
  onRemove,
  onRename,
  onWeight,
}: {
  /** Para los ids de los campos (únicos en la página). */
  idPrefix: string
  legend: string
  /** Una ayuda bajo el título, si hay partes. */
  hint?: string
  draft: PartsDraft
  /** Una clave por parte, para que React no confunda los campos al quitar una. */
  partKeys: Key[]
  errors: PartsErrors | null
  disabled: boolean
  onAdd: () => void
  onRemove: (index: number) => void
  onRename: (index: number, name: string) => void
  onWeight: (index: number, weight: string) => void
}) {
  const { t } = useLanguage()
  const total = weightsTotal(draft)
  // Si el campo no vale (para enlazar cada error con su campo).
  const invalid = (message: string | undefined) => (message ? true : undefined)

  return (
    <fieldset className="stack" disabled={disabled}>
      <legend>{legend}</legend>
      {hint && draft.partNames.length > 0 && <p className="muted">{hint}</p>}
      {draft.partNames.map((partName, index) => {
        const id = `${idPrefix}-part-${partKeys[index]}`
        const error = errors?.parts?.[index]
        const weightError = errors?.partWeights?.[index]
        return (
          <div key={partKeys[index]} className="stack">
            <label htmlFor={id}>{t.newTask.part(index + 1)}</label>
            <div className="part-row">
              <input
                id={id}
                value={partName}
                onChange={(event) => onRename(index, event.target.value)}
                aria-invalid={invalid(error)}
                aria-describedby={error ? `${id}-error` : undefined}
              />
              <button
                type="button"
                className="button-secondary"
                aria-label={t.newTask.removePart(index + 1)}
                onClick={() => onRemove(index)}
              >
                {t.newTask.remove}
              </button>
            </div>
            <FieldError id={`${id}-error`} message={error} />
            <div className="weight-row">
              <label htmlFor={`${id}-weight`}>{t.newTask.weight}</label>
              <input
                id={`${id}-weight`}
                // Lo que lee VoiceOver: «Peso» solo no diría de qué parte es.
                aria-label={t.newTask.weightOfPart(index + 1)}
                inputMode="numeric"
                value={draft.partWeights[index]}
                onChange={(event) => onWeight(index, event.target.value)}
                aria-invalid={invalid(weightError)}
                aria-describedby={weightError ? `${id}-weight-error` : undefined}
              />
              <span aria-hidden="true">%</span>
            </div>
            <FieldError id={`${id}-weight-error`} message={weightError} />
          </div>
        )
      })}
      <button
        type="button"
        className="button-link add-part"
        onClick={onAdd}
        disabled={draft.partNames.length >= MAX_PARTS}
      >
        <LineIcon name="plus" />
        {t.newTask.addPart}
      </button>
      {draft.partNames.length > 0 && (
        <p
          id={`${idPrefix}-weights-total`}
          // VoiceOver anuncia la suma (o el aviso) al cambiar, sin salir del campo del peso.
          aria-live="polite"
          className={total === 100 ? 'muted' : 'error'}
          // No es un campo: se marca aparte para llevar el foco aquí si es lo único que falla.
          data-invalid={errors?.weightsTotal ? true : undefined}
          tabIndex={errors?.weightsTotal ? -1 : undefined}
        >
          {errors?.weightsTotal ?? t.newTask.total(total)}
        </p>
      )}
    </fieldset>
  )
}
