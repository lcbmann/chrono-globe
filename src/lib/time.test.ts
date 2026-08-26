import { describe, expect, it } from 'vitest'
import { buildPlaybackYears, buildTimelineYears, findNearestSnapshotIndex, findSourceSnapshotIndex, formatYear, getPlaybackDelay, getSnapshotTransition, parseYear } from './time'

const snapshots = [
  { year: -500, filename: '', entities: 1, features: 1, datasetId: 'test-dataset' },
  { year: -323, filename: '', entities: 1, features: 1, datasetId: 'test-dataset' },
  { year: 100, filename: '', entities: 1, features: 1, datasetId: 'test-dataset' },
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

  it('preserves source and featured years in the navigable timeline', () => {
    const years = buildTimelineYears(snapshots, [-331])
    expect(years).toContain(-323)
    expect(years).toContain(-331)
    expect(years).not.toContain(0)
    expect(findSourceSnapshotIndex(snapshots, -250)).toBe(1)
  })

  it('keeps playback to meaningful sourced and featured years', () => {
    expect(buildPlaybackYears(snapshots, [-331, -331, 500])).toEqual([-500, -331, -323, 100])
    expect(buildPlaybackYears(snapshots, [-331, 500], { endYear: 500 })).toEqual([-500, -331, -323, 100, 500])
    expect(buildTimelineYears(snapshots, [500], { endYear: 500 })).toContain(500)
  })

  it('offers slower and faster timelapse pacing without changing the safe default', () => {
    expect(getPlaybackDelay(.5)).toBe(5200)
    expect(getPlaybackDelay(1)).toBe(2600)
    expect(getPlaybackDelay(2)).toBe(1300)
    expect(getPlaybackDelay(1, true)).toBe(3000)
  })

  it('locates progress between the surrounding source maps', () => {
    expect(getSnapshotTransition(snapshots, -500)).toEqual({ currentIndex: 0, nextIndex: 1, progress: 0 })
    expect(getSnapshotTransition(snapshots, -411).progress).toBeCloseTo(.5, 1)
    expect(getSnapshotTransition(snapshots, 100)).toEqual({ currentIndex: 2, nextIndex: 2, progress: 0 })
  })
})
