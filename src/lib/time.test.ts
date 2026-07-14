import { describe, expect, it } from 'vitest'
import { findNearestSnapshotIndex, formatYear, parseYear } from './time'

const snapshots = [
  { year: -500, filename: '', entities: 1, features: 1 },
  { year: -323, filename: '', entities: 1, features: 1 },
  { year: 100, filename: '', entities: 1, features: 1 },
]

describe('historical time helpers', () => {
  it('formats BCE and CE without a year zero', () => {
    expect(formatYear(-323)).toBe('323 BCE')
    expect(formatYear(100)).toBe('100 CE')
    expect(formatYear(0)).toBe('1 BCE')
  })

  it('parses common historical year notation', () => {
    expect(parseYear('323 BCE')).toBe(-323)
    expect(parseYear(' 1492 ad ')).toBe(1492)
    expect(parseYear('not a year')).toBeNull()
  })

  it('finds the closest available reconstruction', () => {
    expect(findNearestSnapshotIndex(snapshots, -350)).toBe(1)
    expect(findNearestSnapshotIndex(snapshots, 20)).toBe(2)
  })
})
