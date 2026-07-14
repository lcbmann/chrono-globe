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

export const getEraLabel = (year: number) => {
  if (year < -3000) return 'Early civilizations'
  if (year < -500) return 'Ancient world'
  if (year < 500) return 'Classical world'
  if (year < 1500) return 'Medieval world'
  if (year < 1800) return 'Early modern world'
  if (year < 1945) return 'Industrial world'
  return 'Contemporary world'
}
