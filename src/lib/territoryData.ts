import { geoArea } from 'd3-geo'
import type { HistoricalEntityIndex, HistoricalFeature, HistoricalMap } from '../types'
import { entityKey } from './entities'

export type TerritorySourceMode = 'composite' | 'historical-basemaps' | 'cliopatria'

export interface TemporalTerritoryPack {
  startYear: number
  endYear: number
  filename: string
  features: number
  polities: number
  relations: number
}

export interface TemporalTerritoryManifest {
  schemaVersion: number
  datasetId: string
  title: string
  sourceFamilyId: string
  source: string
  license: string
  licenseUrl: string
  revision: { kind: 'git' | 'release' | 'checksum'; value: string }
  scope: 'global' | 'regional' | 'entity'
  coverage: { startYear: number; endYear: number }
  methodology: string
  sourceFile: string
  sourceSha256: string
  counts: {
    features: number
    polities: number
    relations: number
    uniqueNames: number
    packs: number
  }
  changeYears: number[]
  entities: HistoricalEntityIndex[]
  packs: TemporalTerritoryPack[]
}

interface TemporalProperties {
  datasetId?: string
  renderRole?: 'primary' | 'detail-replacement' | 'detail-alternative'
  canonicalEntityKey?: string
  FromYear?: number
  ToYear?: number
  Type?: 'POLITY' | 'RELATION'
  Components?: string | null
  MemberOf?: string | null
}

const temporalProperties = (feature: HistoricalFeature) => feature.properties as HistoricalFeature['properties'] & TemporalProperties

export const findTerritoryPack = (manifest: TemporalTerritoryManifest | null, year: number | undefined) => {
  if (!manifest || year === undefined || year < manifest.coverage.startYear || year > manifest.coverage.endYear) return null
  return manifest.packs.find((pack) => pack.startYear <= year && pack.endYear >= year) || null
}

export const territoriesForYear = (map: HistoricalMap | null, year: number | undefined, includeRelations = false) => {
  if (!map || year === undefined) return []
  return map.features.filter((feature): feature is HistoricalFeature => {
    const properties = temporalProperties(feature as HistoricalFeature)
    if (!properties.NAME || !Number.isInteger(properties.FromYear) || !Number.isInteger(properties.ToYear)) return false
    if (properties.FromYear! > year || properties.ToYear! < year) return false
    return includeRelations || properties.Type !== 'RELATION'
  })
}

const normalizedIdentity = (value: string) => value
  .normalize('NFKC')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase()

const comparisonIdentity = (value: string) => normalizedIdentity(value).replace(/^\((.+)\)$/, '$1').trim()

const featureTerritoryName = (feature: HistoricalFeature) => feature.properties.NAME?.trim() || entityKey(feature)

const taggedFeature = (
  feature: HistoricalFeature,
  datasetId: string,
  renderRole: TemporalProperties['renderRole'] = 'primary',
  canonicalEntityKey?: string,
) => {
  const properties = temporalProperties(feature)
  if (properties.datasetId === datasetId && properties.renderRole === renderRole && properties.canonicalEntityKey === canonicalEntityKey) return feature
  const nextProperties = { ...feature.properties, datasetId, renderRole }
  if (canonicalEntityKey) nextProperties.canonicalEntityKey = canonicalEntityKey
  else delete nextProperties.canonicalEntityKey
  return { ...feature, properties: nextProperties } as HistoricalFeature
}

interface TerritoryIdentityRule {
  canonicalKey: string
  names: string[]
  startYear: number
  endYear: number
}

// These are strict, dated equivalences between names used by the two bundled
// sources. They are deliberately separate from discovery/profile aliases,
// which can also describe components, successors, or much later namesakes.
const territoryIdentityRules: TerritoryIdentityRule[] = [
  {
    canonicalKey: 'Empire of Alexander',
    names: ['Empire of Alexander', '(Macedonian Empire)', 'Macedonian Empire'],
    startYear: -336,
    endYear: -292,
  },
  {
    canonicalKey: 'Mauryan Empire',
    names: ['Mauryan Empire', 'Maurya Empire'],
    startYear: -321,
    endYear: -185,
  },
  {
    canonicalKey: 'Seleucid Kingdom',
    names: ['Seleucid Kingdom', 'Seleucid Empire'],
    startYear: -312,
    endYear: -63,
  },
  {
    canonicalKey: 'Armenia',
    names: ['Armenia', 'Kingdom of Armenia'],
    startYear: -326,
    endYear: 646,
  },
]

const activeIdentityRule = (value: string, year: number | undefined) => {
  if (year === undefined) return undefined
  const identity = comparisonIdentity(value)
  return territoryIdentityRules.find((rule) => year >= rule.startYear && year <= rule.endYear
    && rule.names.some((name) => comparisonIdentity(name) === identity))
}

interface TerritoryGroup {
  id: string
  name: string
  features: HistoricalFeature[]
  area: number
}

const groupTerritories = (features: HistoricalFeature[]) => {
  const groups = new Map<string, TerritoryGroup>()
  for (const feature of features) {
    const name = featureTerritoryName(feature)
    const id = normalizedIdentity(name)
    const existing = groups.get(id)
    if (existing) {
      existing.features.push(feature)
      existing.area += geoArea(feature)
    } else {
      groups.set(id, { id, name, features: [feature], area: geoArea(feature) })
    }
  }
  return [...groups.values()]
}

const identityMatch = (baseline: TerritoryGroup, detail: TerritoryGroup, year: number | undefined) => {
  const baselineIdentity = comparisonIdentity(baseline.name)
  const detailIdentity = comparisonIdentity(detail.name)
  if (baselineIdentity === detailIdentity) return { score: 4, canonicalKey: baseline.name }

  const baselineRule = activeIdentityRule(baseline.name, year)
  const detailRule = activeIdentityRule(detail.name, year)
  if (baselineRule && baselineRule === detailRule) return { score: 3, canonicalKey: baselineRule.canonicalKey }
  return null
}

const resolveCliopatriaHierarchy = (features: HistoricalFeature[], mode: TerritorySourceMode) => {
  if (features.length === 0) return features
  const parentNames = new Set(features
    .filter((feature) => Boolean(temporalProperties(feature).Components?.trim()))
    .map((feature) => normalizedIdentity(featureTerritoryName(feature))))
  const parentsWithActiveChildren = new Set(features
    .map((feature) => temporalProperties(feature).MemberOf?.trim())
    .filter((name): name is string => typeof name === 'string' && name.length > 0 && parentNames.has(normalizedIdentity(name)))
    .map(normalizedIdentity))

  if (mode === 'cliopatria') {
    // The detailed-only layer exposes the component assertions and removes the
    // composite union that would otherwise cover those same polygons again.
    return features.filter((feature) => !parentsWithActiveChildren.has(normalizedIdentity(featureTerritoryName(feature))))
  }
  // The combined overview uses the source's composite assertion. Components
  // remain available in Detailed polities without stacking over their parent.
  return features.filter((feature) => {
    const parent = temporalProperties(feature).MemberOf?.trim()
    return !parent || !parentNames.has(normalizedIdentity(parent))
  })
}

/**
 * The combined view keeps the broad global reconstruction as the filled map and
 * adds source-tagged Cliopatria assertions as a higher outline/detail layer.
 * Equivalent feature-level territories replace the baseline fill. Other detailed
 * assertions remain interactive outlines, while source hierarchy composites and
 * their components are never filled at the same time.
 */
export const composeTerritoryFeatures = (
  baseline: HistoricalFeature[],
  cliopatria: HistoricalFeature[],
  mode: TerritorySourceMode,
  year?: number,
) => {
  const baselineFeatures = baseline.map((feature) => taggedFeature(feature, 'historical-basemaps'))
  if (mode === 'historical-basemaps') return baselineFeatures
  const detailFeatures = resolveCliopatriaHierarchy(
    cliopatria.map((feature) => taggedFeature(feature, 'cliopatria')),
    mode,
  )
  if (mode === 'cliopatria') return detailFeatures
  if (detailFeatures.length === 0) return baselineFeatures

  const baselineGroups = groupTerritories(baselineFeatures)
  const detailGroups = groupTerritories(detailFeatures).sort((left, right) => right.area - left.area)
  const replacedBaselineIds = new Set<string>()
  const matchedDetails = new Map<string, { canonicalKey: string }>()

  for (const detail of detailGroups) {
    let best: { baseline: TerritoryGroup; score: number; canonicalKey: string } | null = null
    for (const baselineGroup of baselineGroups) {
      if (replacedBaselineIds.has(baselineGroup.id)) continue
      const match = identityMatch(baselineGroup, detail, year)
      if (!match || (best && match.score <= best.score)) continue
      best = { baseline: baselineGroup, ...match }
    }
    if (!best) continue
    replacedBaselineIds.add(best.baseline.id)
    matchedDetails.set(detail.id, { canonicalKey: best.canonicalKey })
  }

  const fallbackFeatures = baselineFeatures.filter((feature) => !replacedBaselineIds.has(normalizedIdentity(featureTerritoryName(feature))))
  const markedDetails = detailGroups.flatMap((group) => {
    const match = matchedDetails.get(group.id)
    return group.features.map((feature) => taggedFeature(
      feature,
      'cliopatria',
      match ? 'detail-replacement' : 'detail-alternative',
      match?.canonicalKey,
    ))
  })
  return [...fallbackFeatures, ...markedDetails]
}

export const mergeHistoricalEntityIndexes = (...catalogs: HistoricalEntityIndex[][]) => {
  const merged = new Map<string, HistoricalEntityIndex>()
  for (const catalog of catalogs) {
    for (const entity of catalog) {
      const existing = merged.get(entity.key)
      if (!existing) {
        merged.set(entity.key, {
          ...entity,
          aliases: [...entity.aliases],
          years: [...entity.years],
        })
        continue
      }
      const useIncomingPeak = entity.maxArea > existing.maxArea
      const years = [...new Set([...existing.years, ...entity.years])].filter((year) => year !== 0).sort((left, right) => left - right)
      const datasetIds = [...new Set([...(existing.datasetIds || []), ...(entity.datasetIds || [])])].sort()
      merged.set(entity.key, {
        ...existing,
        name: existing.name || entity.name,
        aliases: [...new Set([...existing.aliases, ...entity.aliases])].sort(),
        ...(datasetIds.length > 0 ? { datasetIds } : {}),
        years,
        firstYear: Math.min(existing.firstYear, entity.firstYear),
        lastYear: Math.max(existing.lastYear, entity.lastYear),
        peakYear: useIncomingPeak ? entity.peakYear : existing.peakYear,
        maxArea: Math.max(existing.maxArea, entity.maxArea),
      })
    }
  }
  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name))
}
