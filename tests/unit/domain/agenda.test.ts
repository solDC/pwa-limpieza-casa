import { describe, expect, it } from 'vitest'
import { agenda } from '../../../src/domain/agenda'
import { dueStatus, type Round } from '../../../src/domain/frequency'
import type { Frequency, LocalDate } from '../../../src/domain/task'

// US-29 · Qué toca (#38): qué está retrasado, qué toca hoy y en qué orden salen las tareas.

const weekly: Frequency = { kind: 'weekendWeekly' }
const biweekly: Frequency = { kind: 'weekendBiweekly', startOn: '2026-12-05' }
const bathroom: Frequency = { kind: 'interval', days: 3, nextDueOn: null }
const oneOff: Frequency = { kind: 'oneOff', dueOn: null }

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

describe('dueStatus: las puntuales sin fecha', () => {
  it('nunca van con retraso', () => {
    expect(dueStatus(oneOff, { startsOn: null, dueBy: null }, '2030-01-01')).toEqual({
      status: 'pending',
    })
  })
})

// US-38 · Poner fecha a una tarea puntual (#54)
describe('dueStatus: las puntuales con fecha, como las de cada N días', () => {
  const noRound: Round = { startsOn: null, dueBy: null }
  const due = (dueOn: LocalDate, today: LocalDate) =>
    dueStatus({ kind: 'oneOff', dueOn }, noRound, today)

  it('antes de la fecha tocan más adelante, y ese día, hoy', () => {
    expect(due('2026-11-18', '2026-11-17')).toEqual({ status: 'upcoming' })
    expect(due('2026-11-18', '2026-11-18')).toEqual({ status: 'today' })
  })

  it('desde el día siguiente van con retraso', () => {
    expect(due('2026-11-18', '2026-11-19')).toEqual({ status: 'overdue', days: 1 })
    expect(due('2026-11-18', '2026-11-25')).toEqual({ status: 'overdue', days: 7 })
  })

  it('el retraso se cuenta bien con fin de mes, año bisiesto y cambio de hora', () => {
    expect(due('2026-11-30', '2026-12-01')).toEqual({ status: 'overdue', days: 1 })
    expect(due('2028-02-28', '2028-03-01')).toEqual({ status: 'overdue', days: 2 })
    expect(due('2027-02-28', '2027-03-01')).toEqual({ status: 'overdue', days: 1 })
    // El 25 de octubre de 2026 se cambia la hora en Madrid.
    expect(due('2026-10-24', '2026-10-26')).toEqual({ status: 'overdue', days: 2 })
    expect(due('2026-03-28', '2026-03-30')).toEqual({ status: 'overdue', days: 2 })
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
        task('Cristales y espejos', { kind: 'interval', days: 30, nextDueOn: null }, '2026-10-28'), // hoy
        task('Cepillar suelo', oneOff),
        task('Polvo', { kind: 'interval', days: 7, nextDueOn: null }, '2026-10-01', '2026-10-25'), // 1 nov: más adelante
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
        task('Cristales y espejos', { kind: 'interval', days: 30, nextDueOn: null }, '2026-10-28'),
      ]),
    ).toEqual(['Baño', 'Cristales y espejos'])
  })

  // US-38: con fecha, se ordenan por ella como las demás; sin fecha, entre hoy y más adelante.
  it('las puntuales con fecha van por su fecha, como las de cada N días', () => {
    expect(
      names([
        task('Cepillar suelo', oneOff),
        task('Horno', { kind: 'oneOff', dueOn: '2026-11-05' }), // más adelante, después de Polvo
        task('Polvo', { kind: 'interval', days: 7, nextDueOn: null }, '2026-10-01', '2026-10-25'), // 1 nov
        task('Nevera', { kind: 'oneOff', dueOn: '2026-10-28' }), // hoy
        task('Juntas', { kind: 'oneOff', dueOn: '2026-10-20' }), // retrasada 8 días
        task('Baño', bathroom, '2026-10-01', '2026-10-24'), // retrasada 1 día
      ]),
    ).toEqual(['Juntas', 'Baño', 'Nevera', 'Cepillar suelo', 'Polvo', 'Horno'])
  })

  // US-41: las de cada N días con otro día elegido van por ese día.
  it('las de cada N días con otro día elegido van por ese día', () => {
    const moved = (nextDueOn: LocalDate): Frequency => ({ kind: 'interval', days: 3, nextDueOn })
    expect(
      names([
        task('Polvo', { kind: 'interval', days: 7, nextDueOn: null }, '2026-10-01', '2026-10-25'), // 1 nov
        task('Baño', moved('2026-10-28'), '2026-10-01', '2026-10-20'), // tocaba el 23: ahora hoy
        task('Cocina', moved('2026-10-30'), '2026-10-01', '2026-10-27'), // tocaba hoy: ahora el 30
        task('Salón', bathroom, '2026-10-01', '2026-10-24'), // retrasada 1 día
      ]),
    ).toEqual(['Salón', 'Baño', 'Cocina', 'Polvo'])
  })

  it('no incluye las puntuales ya hechas', () => {
    expect(names([task('Cepillar suelo', oneOff, '2026-10-01', '2026-10-20')])).toEqual([])
    expect(
      names([task('Horno', { kind: 'oneOff', dueOn: '2026-10-25' }, '2026-10-01', '2026-10-20')]),
    ).toEqual([])
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
