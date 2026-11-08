import { describe, expect, it } from 'vitest'
import { agenda } from '../../../src/domain/agenda'
import { dueStatus, type Round } from '../../../src/domain/frequency'
import type { Frequency, LocalDate } from '../../../src/domain/task'

// US-29 · Qué toca (#38): qué está retrasado, qué toca hoy y en qué orden salen las tareas.

const weekly: Frequency = { kind: 'weekendWeekly' }
const biweekly: Frequency = { kind: 'weekendBiweekly', startOn: '2026-12-05' }
const bathroom: Frequency = { kind: 'interval', days: 3 }
const oneOff: Frequency = { kind: 'oneOff' }

const interval = (startsOn: LocalDate): Round => ({ startsOn, dueBy: null })
// La vuelta de fin de semana que empieza ese sábado.
const weekend = (saturday: LocalDate, dueBy: LocalDate): Round => ({ startsOn: saturday, dueBy })

describe('dueStatus: las de fin de semana', () => {
  const round = weekend('2026-11-07', '2026-11-13')

  it('tocan hoy el sábado y el domingo', () => {
    expect(dueStatus(weekly, round, '2026-11-07')).toEqual({ status: 'today' })
    expect(dueStatus(weekly, round, '2026-11-08')).toEqual({ status: 'today' })
  })

  it('de lunes a viernes, con retraso desde el lunes (el lunes, 1 día)', () => {
    expect(dueStatus(weekly, round, '2026-11-09')).toEqual({ status: 'overdue', days: 1 })
    expect(dueStatus(weekly, round, '2026-11-11')).toEqual({ status: 'overdue', days: 3 })
    expect(dueStatus(weekly, round, '2026-11-13')).toEqual({ status: 'overdue', days: 5 })
  })

  it('una vuelta que todavía no ha empezado toca más adelante', () => {
    expect(dueStatus(weekly, weekend('2026-11-14', '2026-11-20'), '2026-11-10')).toEqual({
      status: 'upcoming',
    })
  })

  it('las de cada 15 días, igual en su semana; en la que no toca, más adelante', () => {
    const december = weekend('2026-12-05', '2026-12-11')
    expect(dueStatus(biweekly, december, '2026-12-06')).toEqual({ status: 'today' })
    expect(dueStatus(biweekly, december, '2026-12-09')).toEqual({ status: 'overdue', days: 3 })
    expect(dueStatus(biweekly, weekend('2026-12-19', '2026-12-25'), '2026-12-14')).toEqual({
      status: 'upcoming',
    })
  })

  it('el retraso no se lía con el cambio de hora (25 oct 2026)', () => {
    expect(dueStatus(weekly, weekend('2026-10-24', '2026-10-30'), '2026-10-26')).toEqual({
      status: 'overdue',
      days: 1,
    })
  })
})

describe('dueStatus: las de cada N días', () => {
  it('el día que tocan, hoy; antes, más adelante', () => {
    expect(dueStatus(bathroom, interval('2026-11-09'), '2026-11-09')).toEqual({ status: 'today' })
    expect(dueStatus(bathroom, interval('2026-11-10'), '2026-11-09')).toEqual({ status: 'upcoming' })
  })

  it('el retraso se cuenta desde el día siguiente al que tocaban', () => {
    expect(dueStatus(bathroom, interval('2026-11-09'), '2026-11-10')).toEqual({
      status: 'overdue',
      days: 1,
    })
    expect(dueStatus(bathroom, interval('2026-11-09'), '2026-11-12')).toEqual({
      status: 'overdue',
      days: 3,
    })
  })

  it('a fin de mes, en año bisiesto y con el cambio de hora', () => {
    expect(dueStatus(bathroom, interval('2026-10-30'), '2026-11-02')).toEqual({
      status: 'overdue',
      days: 3,
    })
    expect(dueStatus(bathroom, interval('2028-02-28'), '2028-03-01')).toEqual({
      status: 'overdue',
      days: 2,
    })
    expect(dueStatus(bathroom, interval('2027-03-27'), '2027-03-29')).toEqual({
      status: 'overdue',
      days: 2,
    })
  })
})

describe('dueStatus: las puntuales', () => {
  it('nunca van con retraso', () => {
    expect(dueStatus(oneOff, { startsOn: null, dueBy: null }, '2030-01-01')).toEqual({
      status: 'pending',
    })
  })
})

describe('agenda: el orden de «Tus tareas»', () => {
  // Un miércoles: la vuelta de fin de semana es la del sábado 24 oct (retraso 3 días).
  const today = '2026-10-28'
  const task = (name: string, frequency: Frequency, createdOn = '2026-10-01', lastCompletedOn: LocalDate | null = null) => ({
    name,
    frequency,
    createdOn,
    lastCompletedOn,
  })
  const names = (tasks: ReturnType<typeof task>[]) => agenda(tasks, today).map(({ task }) => task.name)

  it('primero las retrasadas (más retraso arriba), luego hoy, luego puntuales y al final más adelante', () => {
    expect(
      names([
        task('Superficies', weekly), // retrasada 3 días
        task('Baño', bathroom, '2026-10-01', '2026-10-24'), // tocaba el 27: retrasada 1 día
        task('Aspirar cosas de Cati', biweekly), // 5 dic: más adelante
        task('Cristales y espejos', { kind: 'interval', days: 30 }, '2026-10-28'), // hoy
        task('Cepillar suelo', oneOff),
        task('Polvo', { kind: 'interval', days: 7 }, '2026-10-01', '2026-10-25'), // 1 nov: más adelante
      ]),
    ).toEqual([
      'Superficies',
      'Baño',
      'Cristales y espejos',
      'Cepillar suelo',
      'Polvo',
      'Aspirar cosas de Cati',
    ])
  })

  it('con el mismo estado, se queda el orden de la lista', () => {
    expect(names([task('Cepillar suelo', oneOff), task('Limpiar juntas', oneOff)])).toEqual([
      'Cepillar suelo',
      'Limpiar juntas',
    ])
    expect(
      names([
        task('Baño', bathroom, '2026-10-28'),
        task('Cristales y espejos', { kind: 'interval', days: 30 }, '2026-10-28'),
      ]),
    ).toEqual(['Baño', 'Cristales y espejos'])
  })

  it('no incluye las puntuales ya hechas', () => {
    expect(names([task('Cepillar suelo', oneOff, '2026-10-01', '2026-10-20')])).toEqual([])
  })

  it('da la vuelta y el estado de cada tarea', () => {
    expect(agenda([task('Superficies', weekly)], today)).toEqual([
      {
        task: task('Superficies', weekly),
        round: { startsOn: '2026-10-24', dueBy: '2026-10-30' },
        due: { status: 'overdue', days: 3 },
      },
    ])
  })
})
