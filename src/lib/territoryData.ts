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
  FromYear?: number
  ToYear?: number
  Type?: 'POLITY' | 'RELATION'
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

const taggedFeature = (feature: HistoricalFeature, datasetId: string, renderRole: TemporalProperties['renderRole'] = 'primary') => {
  const properties = temporalProperties(feature)
  if (properties.datasetId === datasetId && properties.renderRole === renderRole) return feature
  return { ...feature, properties: { ...feature.properties, datasetId, renderRole } } as HistoricalFeature
}

/**
 * The combined view keeps the broad global reconstruction as the filled map and
 * adds source-tagged Cliopatria assertions as a higher outline/detail layer.
 * Exact-name replacements are removed from the baseline to avoid duplicate caps;
 * differently defined territories remain visible as explicitly sourced alternatives.
 */
export const composeTerritoryFeatures = (
  baseline: HistoricalFeature[],
  cliopatria: HistoricalFeature[],
  mode: TerritorySourceMode,
) => {
  const baselineFeatures = baseline.map((feature) => taggedFeature(feature, 'historical-basemaps'))
  const detailFeatures = cliopatria.map((feature) => taggedFeature(feature, 'cliopatria'))
  if (mode === 'historical-basemaps') return baselineFeatures
  if (mode === 'cliopatria') return detailFeatures
  if (detailFeatures.length === 0) return baselineFeatures

  const detailedKeys = new Set(detailFeatures.map((feature) => normalizedIdentity(entityKey(feature))))
  const baselineKeys = new Set(baselineFeatures.map((feature) => normalizedIdentity(entityKey(feature))))
  const fallbackFeatures = baselineFeatures.filter((feature) => !detailedKeys.has(normalizedIdentity(entityKey(feature))))
  const markedDetails = detailFeatures.map((feature) => taggedFeature(
    feature,
    'cliopatria',
    baselineKeys.has(normalizedIdentity(entityKey(feature))) ? 'detail-replacement' : 'detail-alternative',
  ))
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
