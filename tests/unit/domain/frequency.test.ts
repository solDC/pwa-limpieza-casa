import { describe, expect, it } from 'vitest'
import { currentRound, describeDue } from '../../../src/domain/frequency'
import type { Frequency } from '../../../src/domain/task'

// US-28 · Frecuencias (#37). Las reglas están en «Conceptos» de docs/user-stories.md.

const createdOn = '2026-11-08'
const round = (frequency: Frequency, lastCompletedOn: string | null, today: string) =>
  currentRound({ frequency, createdOn }, lastCompletedOn, today)

describe('semanal, en fin de semana: toca el finde y se puede hacer hasta el viernes', () => {
  const weekly: Frequency = { kind: 'weekendWeekly' }

  it('el sábado y el domingo toca la vuelta de ese finde, con plazo hasta el viernes', () => {
    expect(round(weekly, null, '2026-11-14')).toEqual({ startsOn: '2026-11-14', dueBy: '2026-11-20' })
    expect(round(weekly, null, '2026-11-15')).toEqual({ startsOn: '2026-11-14', dueBy: '2026-11-20' })
  })

  it('entre semana sigue siendo la vuelta del finde anterior, hasta el viernes', () => {
    expect(round(weekly, null, '2026-11-18')).toEqual({ startsOn: '2026-11-14', dueBy: '2026-11-20' })
    expect(round(weekly, null, '2026-11-20')).toEqual({ startsOn: '2026-11-14', dueBy: '2026-11-20' })
  })

  it('el sábado siguiente empieza una vuelta nueva', () => {
    expect(round(weekly, null, '2026-11-21')).toEqual({ startsOn: '2026-11-21', dueBy: '2026-11-27' })
  })

  it('si ya se hizo en esta vuelta, toca el finde siguiente', () => {
    expect(round(weekly, '2026-11-15', '2026-11-18')).toEqual({
      startsOn: '2026-11-21',
      dueBy: '2026-11-27',
    })
    expect(round(weekly, '2026-11-20', '2026-11-20')).toEqual({
      startsOn: '2026-11-21',
      dueBy: '2026-11-27',
    })
  })

  it('si se hizo en una vuelta anterior, toca la de ahora', () => {
    expect(round(weekly, '2026-11-08', '2026-11-18')).toEqual({
      startsOn: '2026-11-14',
      dueBy: '2026-11-20',
    })
  })

  it('cruza el cambio de año', () => {
    expect(round(weekly, null, '2026-12-30')).toEqual({ startsOn: '2026-12-26', dueBy: '2027-01-01' })
    expect(round(weekly, '2026-12-27', '2026-12-30')).toEqual({
      startsOn: '2027-01-02',
      dueBy: '2027-01-08',
    })
  })

  it('cruza el 29 de febrero y el cambio de hora', () => {
    expect(round(weekly, null, '2028-02-29')).toEqual({ startsOn: '2028-02-26', dueBy: '2028-03-03' })
    expect(round(weekly, null, '2026-03-29')).toEqual({ startsOn: '2026-03-28', dueBy: '2026-04-03' })
  })
})

describe('fin de semana cada 15 días: un finde sí y otro no, con plazo hasta el viernes', () => {
  const biweekly: Frequency = { kind: 'weekendBiweekly', startOn: '2026-12-05' }

  it('antes del primer finde, toca el primero', () => {
    expect(round(biweekly, null, '2026-11-08')).toEqual({ startsOn: '2026-12-05', dueBy: '2026-12-11' })
  })

  it('del sábado al viernes es la vuelta de ese finde', () => {
    expect(round(biweekly, null, '2026-12-05')).toEqual({ startsOn: '2026-12-05', dueBy: '2026-12-11' })
    expect(round(biweekly, null, '2026-12-11')).toEqual({ startsOn: '2026-12-05', dueBy: '2026-12-11' })
  })

  it('en la semana que no toca, ya se ve el finde siguiente', () => {
    expect(round(biweekly, null, '2026-12-12')).toEqual({ startsOn: '2026-12-19', dueBy: '2026-12-25' })
    expect(round(biweekly, null, '2026-12-16')).toEqual({ startsOn: '2026-12-19', dueBy: '2026-12-25' })
  })

  it('si ya se hizo en esta vuelta, toca dentro de 15 días', () => {
    expect(round(biweekly, '2026-12-06', '2026-12-08')).toEqual({
      startsOn: '2026-12-19',
      dueBy: '2026-12-25',
    })
  })

  it('si se hizo en la vuelta anterior, toca la de ahora', () => {
    expect(round(biweekly, '2026-12-06', '2026-12-20')).toEqual({
      startsOn: '2026-12-19',
      dueBy: '2026-12-25',
    })
  })

  it('cruza el cambio de año', () => {
    expect(round(biweekly, '2026-12-19', '2026-12-30')).toEqual({
      startsOn: '2027-01-02',
      dueBy: '2027-01-08',
    })
  })
})

describe('cada N días desde la última vez', () => {
  const bathroom: Frequency = { kind: 'interval', days: 3 }

  it('la primera vez toca desde el día en que se creó', () => {
    expect(round(bathroom, null, '2026-11-08')).toEqual({ startsOn: '2026-11-08', dueBy: null })
    expect(round(bathroom, null, '2026-11-20')).toEqual({ startsOn: '2026-11-08', dueBy: null })
  })

  it('después, N días desde el día en que se terminó', () => {
    expect(round(bathroom, '2026-11-10', '2026-11-10')).toEqual({ startsOn: '2026-11-13', dueBy: null })
  })

  it('si se hace antes de tiempo, cuenta desde ese día, no desde la fecha prevista', () => {
    expect(round(bathroom, '2026-11-11', '2026-11-11')).toEqual({ startsOn: '2026-11-14', dueBy: null })
  })

  it('si se hace con retraso, cuenta desde ese día, no desde la fecha prevista', () => {
    expect(round(bathroom, '2026-11-20', '2026-11-20')).toEqual({ startsOn: '2026-11-23', dueBy: null })
  })

  it('30 días cruzando meses cortos y años bisiestos', () => {
    const windows: Frequency = { kind: 'interval', days: 30 }
    expect(round(windows, '2026-01-30', '2026-01-30')).toEqual({ startsOn: '2026-03-01', dueBy: null })
    expect(round(windows, '2028-02-15', '2028-02-15')).toEqual({ startsOn: '2028-03-16', dueBy: null })
  })
})

describe('puntual', () => {
  const oneOff: Frequency = { kind: 'oneOff' }

  it('toca desde que se crea hasta que se hace', () => {
    expect(round(oneOff, null, '2026-11-20')).toEqual({ startsOn: '2026-11-08', dueBy: null })
  })

  it('una vez hecha, ya no vuelve a tocar', () => {
    expect(round(oneOff, '2026-11-10', '2026-11-20')).toBeNull()
  })
})

describe('describeDue: el texto de «Toca:»', () => {
  const weekly: Frequency = { kind: 'weekendWeekly' }
  const bathroom: Frequency = { kind: 'interval', days: 3 }

  it('las de fin de semana dicen de qué finde son', () => {
    expect(describeDue(weekly, { startsOn: '2026-11-14', dueBy: '2026-11-20' }, '2026-11-18')).toBe(
      'finde del 14 nov',
    )
  })

  it('hoy y mañana', () => {
    expect(describeDue(bathroom, { startsOn: '2026-11-08', dueBy: null }, '2026-11-08')).toBe('hoy')
    expect(describeDue(bathroom, { startsOn: '2026-11-09', dueBy: null }, '2026-11-08')).toBe('mañana')
  })

  it('otro día futuro, con el día de la semana', () => {
    expect(describeDue(bathroom, { startsOn: '2026-11-18', dueBy: null }, '2026-11-08')).toBe(
      'mié 18 nov',
    )
  })

  it('si ya debería estar hecha, desde qué día', () => {
    expect(describeDue(bathroom, { startsOn: '2026-11-09', dueBy: null }, '2026-11-12')).toBe(
      'desde el lun 9 nov',
    )
  })
})
