import type { Snapshot } from '../types'

export const formatYear = (year: number, long = false) => {
  if (year < 0) return `${Math.abs(year).toLocaleString()} ${long ? 'BCE' : 'BCE'}`
  if (year === 0) return '1 BCE'
  return `${year.toLocaleString()} ${long ? 'CE' : 'CE'}`
}

export const parseYear = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/,/g, '')
  const match = normalized.match(/^(\d+)\s*(bce|bc|ce|ad)?$/)
  if (!match) return null

  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return null
  return match[2] === 'bce' || match[2] === 'bc' ? -amount : amount
}

export const findNearestSnapshotIndex = (snapshots: Snapshot[], targetYear: number) => {
  if (snapshots.length === 0) return -1

  return snapshots.reduce((nearestIndex, snapshot, index) => {
    const currentDistance = Math.abs(snapshot.year - targetYear)
    const nearestDistance = Math.abs(snapshots[nearestIndex].year - targetYear)
    return currentDistance < nearestDistance ? index : nearestIndex
  }, 0)
}

export const findSourceSnapshotIndex = (snapshots: Snapshot[], targetYear: number) => {
  if (snapshots.length === 0) return -1
  const firstAfter = snapshots.findIndex((snapshot) => snapshot.year > targetYear)
  if (firstAfter === 0) return 0
  return firstAfter === -1 ? snapshots.length - 1 : firstAfter - 1
}

export const buildTimelineYears = (snapshots: Snapshot[], featuredYears: number[] = []) => {
  if (snapshots.length === 0) return []
  const years = new Set([...snapshots.map((snapshot) => snapshot.year), ...featuredYears])
  const start = snapshots[0].year
  const end = snapshots.at(-1)?.year ?? 2010
  const addRange = (from: number, to: number, step: number) => {
    for (let year = Math.ceil(from / step) * step; year <= to; year += step) {
      if (year !== 0) years.add(year)
    }
  }
  addRange(start, Math.min(-10000, end), 5000)
  addRange(Math.max(start, -10000), Math.min(-3000, end), 500)
  addRange(Math.max(start, -3000), Math.min(-1000, end), 100)
  addRange(Math.max(start, -1000), end, 10)
  return [...years].filter((year) => year >= start && year <= end).sort((left, right) => left - right)
}

export const getSnapshotTransition = (snapshots: Snapshot[], targetYear: number) => {
  const currentIndex = findSourceSnapshotIndex(snapshots, targetYear)
  if (currentIndex < 0) return { currentIndex: -1, nextIndex: -1, progress: 0 }

  const nextIndex = Math.min(currentIndex + 1, snapshots.length - 1)
  const current = snapshots[currentIndex]
  const next = snapshots[nextIndex]
  if (currentIndex === nextIndex || next.year === current.year) return { currentIndex, nextIndex, progress: 0 }

  const linearProgress = Math.max(0, Math.min(1, (targetYear - current.year) / (next.year - current.year)))
  const progress = linearProgress * linearProgress * (3 - 2 * linearProgress)
  return { currentIndex, nextIndex, progress }
}

export const findNearestYearIndex = (years: number[], targetYear: number) => {
  if (years.length === 0) return -1
  return years.reduce((nearest, year, index) =>
    Math.abs(year - targetYear) < Math.abs(years[nearest] - targetYear) ? index : nearest, 0)
}

export const getEraLabel = (year: number) => {
  if (year < -3000) return 'Early civilizations'
  if (year < -500) return 'Ancient world'
  if (year < 500) return 'Classical world'
  if (year < 1500) return 'Medieval world'
  if (year < 1800) return 'Early modern world'
  if (year < 1945) return 'Industrial world'
  return 'Contemporary world'
}
