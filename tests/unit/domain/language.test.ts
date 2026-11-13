import { describe, expect, it } from 'vitest'
import { formatDayMonth, formatShortDate } from '../../../src/domain/dates'
import { describeDue } from '../../../src/domain/frequency'
import { detectLanguage, householdDisplayName } from '../../../src/domain/language'
import { emptyDraft, validateNewTask } from '../../../src/domain/new-task'
import { describeFrequency, partDisplayName, taskDisplayName } from '../../../src/domain/task'

// US-52 · La app en inglés y en castellano (#85)

describe('detectLanguage: el idioma de la primera vez', () => {
  it('castellano si el dispositivo está en castellano, de cualquier país', () => {
    expect(detectLanguage('es')).toBe('es')
    expect(detectLanguage('es-ES')).toBe('es')
    expect(detectLanguage('es-AR')).toBe('es')
    expect(detectLanguage('ES-mx')).toBe('es')
  })

  it('inglés en cualquier otro caso', () => {
    expect(detectLanguage('en-US')).toBe('en')
    expect(detectLanguage('fr-FR')).toBe('en')
    expect(detectLanguage('eu')).toBe('en')
    expect(detectLanguage('')).toBe('en')
    expect(detectLanguage(undefined)).toBe('en')
  })
})

describe('las fechas, en el idioma elegido', () => {
  it('en castellano', () => {
    expect(formatDayMonth('2026-11-14', 'es')).toBe('14 nov')
    expect(formatShortDate('2026-11-18', 'es')).toBe('mié 18 nov')
  })

  it('en inglés', () => {
    expect(formatDayMonth('2026-11-14', 'en')).toBe('14 Nov')
    expect(formatShortDate('2026-11-18', 'en')).toBe('Wed 18 Nov')
    expect(formatShortDate('2028-02-29', 'en')).toBe('Tue 29 Feb')
    expect(formatShortDate('2027-01-01', 'en')).toBe('Fri 1 Jan')
  })
})

describe('describeDue en inglés', () => {
  const weekly = { kind: 'weekendWeekly' } as const
  const bathroom = { kind: 'interval', days: 3 } as const
  const weekend = { startsOn: '2026-11-14', dueBy: '2026-11-20' }

  it('las de fin de semana', () => {
    expect(describeDue(weekly, weekend, '2026-11-12', 'en')).toBe('Due: weekend of 14 Nov')
    expect(describeDue(weekly, weekend, '2026-11-16', 'en')).toBe(
      'Overdue 1 day (was due the weekend of 14 Nov)',
    )
    expect(describeDue(weekly, weekend, '2026-11-20', 'en')).toBe(
      'Overdue 5 days (was due the weekend of 14 Nov)',
    )
  })

  it('hoy, mañana, otro día y con retraso', () => {
    const on = (startsOn: string) => ({ startsOn, dueBy: null })
    expect(describeDue(bathroom, on('2026-11-08'), '2026-11-08', 'en')).toBe('Due: today')
    expect(describeDue(bathroom, on('2026-11-09'), '2026-11-08', 'en')).toBe('Due: tomorrow')
    expect(describeDue(bathroom, on('2026-11-18'), '2026-11-08', 'en')).toBe('Due: Wed 18 Nov')
    expect(describeDue(bathroom, on('2026-11-09'), '2026-11-12', 'en')).toBe(
      'Overdue 3 days (was due Mon 9 Nov)',
    )
  })

  it('sin fecha', () => {
    expect(describeDue({ kind: 'oneOff' }, { startsOn: null, dueBy: null }, '2026-11-08', 'en')).toBe(
      'No date',
    )
  })
})

describe('describeFrequency en inglés', () => {
  it('las cuatro frecuencias', () => {
    expect(describeFrequency({ kind: 'weekendWeekly' }, 'en')).toBe('Weekly, at the weekend')
    expect(describeFrequency({ kind: 'weekendBiweekly', startOn: '2026-12-05' }, 'en')).toBe(
      'Every other weekend',
    )
    expect(describeFrequency({ kind: 'interval', days: 1 }, 'en')).toBe(
      'Every day since the last time',
    )
    expect(describeFrequency({ kind: 'interval', days: 30 }, 'en')).toBe(
      'Every 30 days since the last time',
    )
    expect(describeFrequency({ kind: 'oneOff' }, 'en')).toBe('One-off')
  })
})

describe('los nombres de las tareas por defecto, en el idioma elegido', () => {
  const surfaces = { name: 'Superficies', defaultKey: 'surfaces' }

  it('una tarea por defecto se ve en el idioma elegido', () => {
    expect(taskDisplayName(surfaces, 'es')).toBe('Superficies')
    expect(taskDisplayName(surfaces, 'en')).toBe('Surfaces')
    expect(taskDisplayName({ name: 'Aspirar cosas de Cati', defaultKey: 'vacuum_cati' }, 'en')).toBe(
      'Vacuum Cati’s things',
    )
  })

  it('sus partes también', () => {
    expect(partDisplayName({ name: 'Salón', defaultKey: 'living_room' }, 'en')).toBe('Living room')
    expect(partDisplayName({ name: 'Salón', defaultKey: 'living_room' }, 'es')).toBe('Salón')
  })

  it('una tarea que he añadido yo se ve como la escribí, en cualquier idioma', () => {
    expect(taskDisplayName({ name: 'Regar las plantas', defaultKey: null }, 'en')).toBe(
      'Regar las plantas',
    )
    expect(partDisplayName({ name: 'Horno', defaultKey: null }, 'en')).toBe('Horno')
  })

  it('con una clave que la app no conoce, el nombre guardado', () => {
    expect(taskDisplayName({ name: 'Otra', defaultKey: 'unknown' }, 'en')).toBe('Otra')
  })

  it('el hogar por defecto, «Mi casa», también; con otro nombre, el suyo', () => {
    expect(householdDisplayName('Mi casa', 'en')).toBe('My home')
    expect(householdDisplayName('Mi casa', 'es')).toBe('Mi casa')
    expect(householdDisplayName('Casa de la playa', 'en')).toBe('Casa de la playa')
  })
})

describe('los avisos del formulario de tarea nueva, en inglés', () => {
  it('dice qué falta en inglés', () => {
    const draft = {
      ...emptyDraft(),
      frequencyKind: 'interval' as const,
      partNames: ['', 'Oven'],
      partWeights: ['50', '40'],
      weightsEdited: true,
    }
    expect(validateNewTask(draft, 'en')).toEqual({
      ok: false,
      errors: {
        name: 'Enter the name of the task.',
        intervalDays: 'Enter how many days: from 1 to 365.',
        parts: ['Enter the name of the part or remove it.', undefined],
        weightsTotal: 'The weights must add up to 100 % (now they add up to 90 %).',
      },
    })
    expect(validateNewTask({ ...emptyDraft(), name: 'a'.repeat(81) }, 'en')).toMatchObject({
      errors: {
        name: 'The name can have at most 80 characters.',
        frequency: 'Choose how often it is due.',
      },
    })
    const badWeight = { ...draft, name: 'x', intervalDays: '3', partNames: ['A'], partWeights: ['0'] }
    expect(validateNewTask(badWeight, 'en')).toMatchObject({
      errors: { partWeights: ['Enter a weight from 1 to 100.'] },
    })
    const noWeekend = { ...emptyDraft(), name: 'x', frequencyKind: 'weekendBiweekly' as const }
    expect(validateNewTask(noWeekend, 'en')).toMatchObject({
      errors: { biweeklyStartOn: 'Choose the first weekend.' },
    })
  })
})
