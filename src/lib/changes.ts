import { geoArea } from 'd3-geo'
import { groupEntities } from './entities'
import type { ChangeKind, ChangeSet, EntityChange, HistoricalFeature } from '../types'

const emptyCounts = (): Record<ChangeKind, number> => ({
  appeared: 0,
  disappeared: 0,
  expanded: 0,
  contracted: 0,
  control: 0,
  stable: 0,
})

const areasByEntity = (features: HistoricalFeature[]) => new Map(
  groupEntities(features).map((entity) => [
    entity.key,
    {
      area: entity.features.reduce((total, feature) => total + geoArea(feature), 0),
      control: entity.control,
    },
  ]),
)

export const buildChangeSet = (before: HistoricalFeature[], after: HistoricalFeature[]): ChangeSet => {
  const beforeByKey = areasByEntity(before)
  const afterByKey = areasByEntity(after)
  const keys = new Set([...beforeByKey.keys(), ...afterByKey.keys()])
  const counts = emptyCounts()
  const items: EntityChange[] = []

  for (const key of keys) {
    const previous = beforeByKey.get(key)
    const next = afterByKey.get(key)
    const beforeArea = previous?.area || 0
    const afterArea = next?.area || 0
    let kind: ChangeKind

    if (!previous) kind = 'appeared'
    else if (!next) kind = 'disappeared'
    else if (previous.control && next.control && previous.control !== next.control) kind = 'control'
    else {
      const ratio = afterArea / Math.max(beforeArea, Number.EPSILON)
      const absoluteChange = Math.abs(afterArea - beforeArea)
      kind = absoluteChange < .0005 || (ratio >= .9 && ratio <= 1.1)
        ? 'stable'
        : ratio > 1 ? 'expanded' : 'contracted'
    }

    const magnitude = beforeArea === 0 || afterArea === 0
      ? Math.max(beforeArea, afterArea)
      : Math.abs(afterArea - beforeArea)
    counts[kind] += 1
    items.push({ key, kind, beforeArea, afterArea, magnitude })
  }

  items.sort((left, right) => {
    if (left.kind === 'stable' && right.kind !== 'stable') return 1
    if (right.kind === 'stable' && left.kind !== 'stable') return -1
    return right.magnitude - left.magnitude
  })
  return { items, counts }
}

export const changeColors: Record<ChangeKind, string> = {
  appeared: '#48c78e',
  disappeared: '#e06b61',
  expanded: '#e5b54f',
  contracted: '#b987d6',
  control: '#62a8df',
  stable: '#667573',
}

export const changeLabels: Record<ChangeKind, string> = {
  appeared: 'Appeared',
  disappeared: 'Disappeared',
  expanded: 'Expanded',
  contracted: 'Contracted',
  control: 'Changed control',
  stable: 'Little mapped change',
}
