import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayOfWeek,
  daysBetween,
  formatDayMonth,
  formatShortDate,
  localDateIn,
} from '../../../src/domain/dates'

describe('addDays', () => {
  it('suma y resta días', () => {
    expect(addDays('2026-11-08', 3)).toBe('2026-11-11')
    expect(addDays('2026-11-08', -1)).toBe('2026-11-07')
  })

  it('cruza el fin de mes y el fin de año', () => {
    expect(addDays('2026-01-30', 30)).toBe('2026-03-01')
    expect(addDays('2026-12-31', 3)).toBe('2027-01-03')
  })

  it('cuenta el 29 de febrero en los años bisiestos', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('no le afecta el cambio de hora', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('dayOfWeek', () => {
  it('0 es domingo y 6 es sábado', () => {
    expect(dayOfWeek('2026-11-08')).toBe(0)
    expect(dayOfWeek('2026-11-11')).toBe(3)
    expect(dayOfWeek('2026-11-14')).toBe(6)
    expect(dayOfWeek('2028-02-29')).toBe(2)
  })
})

describe('daysBetween', () => {
  it('cuenta los días de una fecha a otra', () => {
    expect(daysBetween('2026-11-08', '2026-11-11')).toBe(3)
    expect(daysBetween('2026-11-11', '2026-11-08')).toBe(-3)
    expect(daysBetween('2026-12-05', '2027-01-02')).toBe(28)
  })
})

describe('localDateIn', () => {
  it('en invierno, Madrid va una hora por delante de UTC', () => {
    expect(localDateIn('Europe/Madrid', new Date('2026-11-07T22:59:00Z'))).toBe('2026-11-07')
    expect(localDateIn('Europe/Madrid', new Date('2026-11-07T23:30:00Z'))).toBe('2026-11-08')
  })

  it('en verano, Madrid va dos horas por delante de UTC', () => {
    expect(localDateIn('Europe/Madrid', new Date('2026-07-01T21:30:00Z'))).toBe('2026-07-01')
    expect(localDateIn('Europe/Madrid', new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02')
  })

  it('los días del cambio de hora', () => {
    expect(localDateIn('Europe/Madrid', new Date('2026-03-29T00:30:00Z'))).toBe('2026-03-29')
    expect(localDateIn('Europe/Madrid', new Date('2026-10-25T22:59:00Z'))).toBe('2026-10-25')
    expect(localDateIn('Europe/Madrid', new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26')
  })
})

describe('formato en español', () => {
  it('día de la semana abreviado, día y mes', () => {
    expect(formatShortDate('2026-11-18')).toBe('mié 18 nov')
    expect(formatShortDate('2027-01-02')).toBe('sáb 2 ene')
    expect(formatShortDate('2026-11-09')).toBe('lun 9 nov')
  })

  it('día y mes', () => {
    expect(formatDayMonth('2026-11-14')).toBe('14 nov')
    expect(formatDayMonth('2026-12-05')).toBe('5 dic')
  })
})
