import { describe, expect, it } from 'vitest'
import { addDays } from '../../../src/domain/dates'
import {
  addPart,
  dueOnError,
  emptyDraft,
  earliestNextDueOn,
  equalWeights,
  MAX_PARTS,
  nextDueOnError,
  nextWeekends,
  removePart,
  renamePart,
  setPartWeight,
  validateNewTask,
  weightsTotal,
  type NewTaskDraft,
} from '../../../src/domain/new-task'

const TODAY = '2026-11-08'

// US-33 · Añadir una tarea (#42)

describe('equalWeights: las partes cuentan lo mismo y suman 100', () => {
  it('sin partes, ningún peso', () => {
    expect(equalWeights(0)).toEqual([])
  })

  it('si el 100 se reparte justo, todas igual', () => {
    expect(equalWeights(1)).toEqual([100])
    expect(equalWeights(2)).toEqual([50, 50])
    expect(equalWeights(4)).toEqual([25, 25, 25, 25])
  })

  it('si no, las primeras llevan un punto más, lo justo para sumar 100', () => {
    expect(equalWeights(3)).toEqual([34, 33, 33])
    expect(equalWeights(6)).toEqual([17, 17, 17, 17, 16, 16])
  })

  it('siempre suman 100, también con el máximo de partes', () => {
    for (let count = 1; count <= MAX_PARTS; count++) {
      const weights = equalWeights(count)
      expect(weights).toHaveLength(count)
      expect(weights.reduce((sum, weight) => sum + weight, 0)).toBe(100)
      expect(Math.max(...weights) - Math.min(...weights)).toBeLessThanOrEqual(1)
    }
  })
})

describe('nextWeekends: los dos fines de semana que se pueden elegir para empezar', () => {
  it('de lunes a viernes, los dos sábados siguientes', () => {
    expect(nextWeekends('2026-11-09')).toEqual(['2026-11-14', '2026-11-21']) // lunes
    expect(nextWeekends('2026-11-13')).toEqual(['2026-11-14', '2026-11-21']) // viernes
  })

  it('en sábado o domingo, el primero es ese mismo finde', () => {
    expect(nextWeekends('2026-11-14')).toEqual(['2026-11-14', '2026-11-21']) // sábado
    expect(nextWeekends('2026-11-15')).toEqual(['2026-11-14', '2026-11-21']) // domingo
  })

  it('cruza el cambio de año', () => {
    expect(nextWeekends('2026-12-28')).toEqual(['2027-01-02', '2027-01-09'])
  })
})

describe('validateNewTask: qué hace falta para guardar una tarea', () => {
  // Con partes y sin pesos escritos, cuentan lo mismo (como si no se hubieran tocado).
  const draft = (changes: Partial<NewTaskDraft>): NewTaskDraft => ({
    ...emptyDraft(),
    name: 'Regar las plantas',
    frequencyKind: 'interval',
    intervalDays: '7',
    partWeights: equalWeights(changes.partNames?.length ?? 0).map(String),
    ...changes,
  })

  it('con nombre y frecuencia, vale, sin espacios de más', () => {
    expect(validateNewTask(draft({ name: '  Regar las plantas ' }), 'es', TODAY)).toEqual({
      ok: true,
      task: {
        name: 'Regar las plantas',
        frequency: { kind: 'interval', days: 7, nextDueOn: null },
        parts: [],
      },
    })
  })

  it('sin nombre no vale', () => {
    expect(validateNewTask(draft({ name: '   ' }), 'es', TODAY)).toEqual({
      ok: false,
      errors: { name: 'Escribe el nombre de la tarea.' },
    })
  })

  it('con un nombre de más de 80 caracteres no vale', () => {
    expect(validateNewTask(draft({ name: 'a'.repeat(80) }), 'es', TODAY).ok).toBe(true)
    expect(validateNewTask(draft({ name: 'a'.repeat(81) }), 'es', TODAY)).toEqual({
      ok: false,
      errors: { name: 'El nombre puede tener como mucho 80 caracteres.' },
    })
  })

  it('sin frecuencia no vale', () => {
    expect(validateNewTask(draft({ frequencyKind: null }), 'es', TODAY)).toEqual({
      ok: false,
      errors: { frequency: 'Elige cada cuánto toca.' },
    })
  })

  it('las cuatro frecuencias', () => {
    const frequencyOf = (changes: Partial<NewTaskDraft>) => {
      const result = validateNewTask(draft(changes), 'es', TODAY)
      return result.ok ? result.task.frequency : result.errors
    }
    expect(frequencyOf({ frequencyKind: 'weekendWeekly' })).toEqual({ kind: 'weekendWeekly' })
    expect(
      frequencyOf({ frequencyKind: 'weekendBiweekly', biweeklyStartOn: '2026-11-14' }),
    ).toEqual({ kind: 'weekendBiweekly', startOn: '2026-11-14' })
    expect(frequencyOf({ frequencyKind: 'interval', intervalDays: '30' })).toEqual({
      kind: 'interval',
      days: 30,
      nextDueOn: null,
    })
    expect(frequencyOf({ frequencyKind: 'oneOff' })).toEqual({ kind: 'oneOff', dueOn: null })
  })

  it('«cada N días» necesita un número de días entero, de 1 a 365', () => {
    const error = { ok: false, errors: { intervalDays: 'Escribe cada cuántos días: de 1 a 365.' } }
    for (const intervalDays of ['', '0', '366', '2.5', 'tres', '-3']) {
      expect(validateNewTask(draft({ intervalDays }), 'es', TODAY)).toEqual(error)
    }
    expect(validateNewTask(draft({ intervalDays: ' 365 ' }), 'es', TODAY).ok).toBe(true)
  })

  it('«cada 15 días» necesita su primer fin de semana', () => {
    expect(validateNewTask(draft({ frequencyKind: 'weekendBiweekly' }), 'es', TODAY)).toEqual({
      ok: false,
      errors: { biweeklyStartOn: 'Elige el primer fin de semana.' },
    })
  })

  it('las partes son opcionales; si las hay, cuentan lo mismo', () => {
    expect(validateNewTask(draft({ partNames: [' Cocina ', 'Baño', 'Salón'] }), 'es', TODAY)).toMatchObject({
      ok: true,
      task: {
        parts: [
          { name: 'Cocina', weight: 34 },
          { name: 'Baño', weight: 33 },
          { name: 'Salón', weight: 33 },
        ],
      },
    })
  })

  it('una parte sin nombre no vale: dice cuál', () => {
    expect(validateNewTask(draft({ partNames: ['Cocina', '  ', 'Salón'] }), 'es', TODAY)).toEqual({
      ok: false,
      errors: { parts: [undefined, 'Escribe el nombre de la parte o quítala.', undefined] },
    })
  })

  it('una parte de más de 80 caracteres no vale', () => {
    expect(validateNewTask(draft({ partNames: ['a'.repeat(81)] }), 'es', TODAY)).toEqual({
      ok: false,
      errors: { parts: ['El nombre puede tener como mucho 80 caracteres.'] },
    })
  })

  it('dice todo lo que falta a la vez', () => {
    expect(validateNewTask(draft({ name: '', frequencyKind: null, partNames: [''] }), 'es', TODAY)).toEqual({
      ok: false,
      errors: {
        name: 'Escribe el nombre de la tarea.',
        frequency: 'Elige cada cuánto toca.',
        parts: ['Escribe el nombre de la parte o quítala.'],
      },
    })
  })
})

// US-38 · Poner fecha a una tarea puntual (#54)
describe('validateNewTask: la fecha de una puntual', () => {
  const oneOff = (dueOn: string | null) =>
    validateNewTask({ ...emptyDraft(), name: 'Limpiar el horno', frequencyKind: 'oneOff', dueOn }, 'es', TODAY)

  it('no es obligatoria: sin fecha, queda sin fecha', () => {
    expect(emptyDraft().dueOn).toBeNull()
    expect(oneOff(null)).toMatchObject({ ok: true, task: { frequency: { kind: 'oneOff', dueOn: null } } })
  })

  it('puede ser hoy o un día futuro', () => {
    expect(oneOff(TODAY)).toMatchObject({ ok: true, task: { frequency: { kind: 'oneOff', dueOn: TODAY } } })
    expect(oneOff('2027-02-28')).toMatchObject({
      ok: true,
      task: { frequency: { kind: 'oneOff', dueOn: '2027-02-28' } },
    })
  })

  it('no puede ser un día pasado', () => {
    expect(oneOff('2026-11-07')).toEqual({ ok: false, errors: { dueOn: 'Elige hoy o un día futuro.' } })
  })

  it('una fecha que no es una fecha no vale', () => {
    expect(oneOff('mañana')).toEqual({ ok: false, errors: { dueOn: 'Elige hoy o un día futuro.' } })
  })

  it('las demás frecuencias no llevan fecha, aunque se haya elegido antes una', () => {
    const result = validateNewTask(
      { ...emptyDraft(), name: 'Baño', frequencyKind: 'interval', intervalDays: '3', dueOn: '2026-11-07' },
      'es',
      TODAY,
    )
    expect(result).toMatchObject({ ok: true, task: { frequency: { kind: 'interval', days: 3, nextDueOn: null } } })
  })
})

describe('dueOnError: la fecha al cambiarla en una puntual que ya existe', () => {
  it('hoy, un día futuro o sin fecha, bien; un día pasado, no', () => {
    expect(dueOnError(TODAY, TODAY, 'es')).toBeUndefined()
    expect(dueOnError('2026-12-01', TODAY, 'es')).toBeUndefined()
    expect(dueOnError(null, TODAY, 'es')).toBeUndefined()
    expect(dueOnError('2026-11-07', TODAY, 'es')).toBe('Elige hoy o un día futuro.')
    expect(dueOnError('2026-11-07', TODAY, 'en')).toBe('Choose today or a later day.')
  })
})

describe('US-50 · al añadir una de cada N días, el día en que toca la primera vez', () => {
  const interval = (firstDueOn: string | null) =>
    validateNewTask(
      { ...emptyDraft(), name: 'Cristales', frequencyKind: 'interval', intervalDays: '30', firstDueOn },
      'es',
      TODAY,
    )

  it('sin cambiarlo, o con hoy, toca hoy: como hasta ahora, sin ningún día elegido', () => {
    const today = { ok: true, task: { frequency: { kind: 'interval', days: 30, nextDueOn: null } } }
    expect(interval(null)).toMatchObject(today)
    expect(interval(TODAY)).toMatchObject(today)
  })

  it('con un día futuro, toca ese día', () => {
    expect(interval('2026-11-20')).toMatchObject({
      ok: true,
      task: { frequency: { kind: 'interval', days: 30, nextDueOn: '2026-11-20' } },
    })
  })

  it('un día pasado, vacío o que no es una fecha no vale', () => {
    for (const firstDueOn of ['2026-11-07', '', 'mañana']) {
      expect(interval(firstDueOn)).toEqual({
        ok: false,
        errors: { firstDueOn: 'Elige hoy o un día futuro.' },
      })
    }
  })

  it('las demás frecuencias no lo llevan, aunque se haya elegido antes', () => {
    const result = validateNewTask(
      { ...emptyDraft(), name: 'Horno', frequencyKind: 'oneOff', firstDueOn: '2026-11-07' },
      'es',
      TODAY,
    )
    expect(result).toMatchObject({ ok: true, task: { frequency: { kind: 'oneOff', dueOn: null } } })
  })
})

describe('nextDueOnError: cuándo toca la próxima vez una de cada N días (US-41)', () => {
  const yesterday = addDays(TODAY, -1)
  const tomorrow = addDays(TODAY, 1)

  it('hoy o un día futuro, bien', () => {
    expect(nextDueOnError(TODAY, TODAY, null, 'es')).toBeUndefined()
    expect(nextDueOnError(TODAY, TODAY, yesterday, 'es')).toBeUndefined()
    expect(nextDueOnError('2026-12-01', TODAY, yesterday, 'es')).toBeUndefined()
  })

  it('un día pasado o sin día, no: siempre toca algún día', () => {
    expect(nextDueOnError(yesterday, TODAY, null, 'es')).toBe('Elige hoy o un día futuro.')
    expect(nextDueOnError('', TODAY, null, 'es')).toBe('Elige hoy o un día futuro.')
    expect(nextDueOnError('', TODAY, null, 'en')).toBe('Choose today or a later day.')
  })

  it('si ya se ha hecho hoy, hoy no: no se puede volver a marcar hasta mañana', () => {
    expect(nextDueOnError(TODAY, TODAY, TODAY, 'es')).toBe('Ya está hecha hoy: elige mañana o un día futuro.')
    expect(nextDueOnError(TODAY, TODAY, TODAY, 'en')).toBe(
      'Already done today: choose tomorrow or a later day.',
    )
    expect(nextDueOnError(yesterday, TODAY, TODAY, 'es')).toBe('Ya está hecha hoy: elige mañana o un día futuro.')
    expect(nextDueOnError(tomorrow, TODAY, TODAY, 'es')).toBeUndefined()
    // Sin día, el mismo aviso: hoy tampoco valdría.
    expect(nextDueOnError('', TODAY, TODAY, 'es')).toBe('Ya está hecha hoy: elige mañana o un día futuro.')
  })

  it('el primer día que se puede elegir: hoy o, si ya se ha hecho hoy, mañana', () => {
    expect(earliestNextDueOn(TODAY, null)).toBe(TODAY)
    expect(earliestNextDueOn(TODAY, yesterday)).toBe(TODAY)
    expect(earliestNextDueOn(TODAY, TODAY)).toBe(tomorrow)
  })
})

describe('validateNewTask: cuenta los caracteres como la base de datos', () => {
  it('un emoji cuenta como un carácter', () => {
    const result = validateNewTask({
      ...emptyDraft(),
      name: '🧽'.repeat(80),
      frequencyKind: 'oneOff',
    }, 'es', TODAY)
    expect(result.ok).toBe(true)
  })
})

// US-34 · Elegir el peso de las partes (#43)
describe('los pesos de las partes en el formulario', () => {
  const withParts = (...names: string[]) =>
    names.reduce(
      (draft, name, index) => renamePart(addPart(draft), index, name),
      { ...emptyDraft(), name: 'Cocina a fondo', frequencyKind: 'oneOff' } as NewTaskDraft,
    )

  it('mientras no se cambia ningún peso, se reparten a partes iguales al añadir y quitar partes', () => {
    expect(withParts('Horno').partWeights).toEqual(['100'])
    expect(withParts('Horno', 'Nevera', 'Campana').partWeights).toEqual(['34', '33', '33'])
    expect(removePart(withParts('Horno', 'Nevera', 'Campana'), 0)).toMatchObject({
      partNames: ['Nevera', 'Campana'],
      partWeights: ['50', '50'],
    })
  })

  it('desde que cambio un peso, no se vuelven a repartir: la parte nueva entra con 0 %', () => {
    const edited = setPartWeight(withParts('Horno', 'Nevera'), 0, '70')
    expect(edited.partWeights).toEqual(['70', '50'])
    const withNewPart = addPart(edited)
    expect(withNewPart.partWeights).toEqual(['70', '50', '0'])
    expect(removePart(withNewPart, 1).partWeights).toEqual(['70', '0'])
  })

  it('al quitar todas las partes, se vuelven a repartir solos: la siguiente parte cuenta 100 %', () => {
    let draft = setPartWeight(withParts('Horno', 'Nevera'), 0, '70')
    draft = removePart(removePart(draft, 1), 0)
    expect(draft).toMatchObject({ partNames: [], partWeights: [], weightsEdited: false })
    expect(addPart(draft).partWeights).toEqual(['100'])
  })

  it('el peso puede llevar el símbolo %: «50%» y «50 %» valen 50', () => {
    let draft = withParts('Horno', 'Nevera')
    draft = setPartWeight(draft, 0, '50%')
    draft = setPartWeight(draft, 1, '50 %')
    expect(weightsTotal(draft)).toBe(100)
    expect(validateNewTask(draft, 'es', TODAY)).toMatchObject({
      ok: true,
      task: { parts: [{ weight: 50 }, { weight: 50 }] },
    })
  })

  it('weightsTotal suma lo escrito (lo que no es un número cuenta como 0)', () => {
    const draft = setPartWeight(setPartWeight(withParts('Horno', 'Nevera', 'Campana'), 0, '50'), 1, 'treinta')
    expect(weightsTotal(draft)).toBe(83) // 50 + 0 + 33
    expect(weightsTotal(emptyDraft())).toBe(0)
  })

  it('con los pesos que elijo, si suman 100, se guardan así', () => {
    let draft = withParts('Horno', 'Nevera', 'Campana')
    draft = setPartWeight(draft, 0, '50')
    draft = setPartWeight(draft, 1, ' 30 ')
    draft = setPartWeight(draft, 2, '20')
    expect(validateNewTask(draft, 'es', TODAY)).toMatchObject({
      ok: true,
      task: {
        parts: [
          { name: 'Horno', weight: 50 },
          { name: 'Nevera', weight: 30 },
          { name: 'Campana', weight: 20 },
        ],
      },
    })
  })

  it('si no suman 100, no vale: dice cuánto suman', () => {
    const draft = setPartWeight(withParts('Horno', 'Nevera'), 0, '40')
    expect(validateNewTask(draft, 'es', TODAY)).toEqual({
      ok: false,
      errors: { weightsTotal: 'Los pesos tienen que sumar 100 % (ahora suman 90 %).' },
    })
  })

  it('cada peso tiene que ser un número entero de 1 a 100', () => {
    for (const weight of ['0', '', '101', '12.5', 'mucho', '-10']) {
      const result = validateNewTask(setPartWeight(withParts('Horno', 'Nevera'), 0, weight), 'es', TODAY)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors.partWeights).toEqual(['Escribe un peso de 1 a 100.', undefined])
      }
    }
  })
})

