import { geoArea } from 'd3-geo'
import polygonClipping, { type MultiPolygon as ClippingMultiPolygon, type Pair as ClippingPair } from 'polygon-clipping'
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
  extentResolution?: 'neighbor-clipped'
  canonicalEntityKey?: string
  FromYear?: number
  ToYear?: number
  Type?: 'POLITY' | 'RELATION'
  Components?: string | null
  MemberOf?: string | null
}

const temporalProperties = (feature: HistoricalFeature) => feature.properties as HistoricalFeature['properties'] & TemporalProperties
const compositeFeatureCache = new WeakMap<HistoricalFeature[], WeakMap<HistoricalFeature[], Map<number | undefined, HistoricalFeature[]>>>()
const preparedBaselineCache = new WeakMap<HistoricalFeature[], PreparedBaselineGeometry[]>()
const clippedDetailCache = new WeakMap<HistoricalFeature, WeakMap<HistoricalFeature[], Map<string, HistoricalFeature | null>>>()
const MAX_COMPOSITE_REPLACEMENT_GROUPS = 4

const cachedCompositeFeatures = (baseline: HistoricalFeature[], detail: HistoricalFeature[], year: number | undefined) => (
  compositeFeatureCache.get(baseline)?.get(detail)?.get(year)
)

const cacheCompositeFeatures = (baseline: HistoricalFeature[], detail: HistoricalFeature[], year: number | undefined, features: HistoricalFeature[]) => {
  let detailCache = compositeFeatureCache.get(baseline)
  if (!detailCache) {
    detailCache = new WeakMap()
    compositeFeatureCache.set(baseline, detailCache)
  }
  let yearCache = detailCache.get(detail)
  if (!yearCache) {
    yearCache = new Map()
    detailCache.set(detail, yearCache)
  }
  yearCache.set(year, features)
  return features
}

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

interface GeometryBounds {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

interface PreparedBaselineGeometry {
  id: string
  geometry: ClippingMultiPolygon
  bounds: GeometryBounds
  crossesAntimeridian: boolean
}

const clippingGeometry = (feature: HistoricalFeature): ClippingMultiPolygon | null => {
  const geometry = feature.geometry
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return null
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.map((polygon) => polygon.map((ring) => ring.map((position) => [position[0], position[1]] as ClippingPair)))
}

const clippingGeometryBounds = (geometry: ClippingMultiPolygon): GeometryBounds => {
  const bounds = { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity }
  for (const polygon of geometry) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        bounds.minLng = Math.min(bounds.minLng, lng)
        bounds.minLat = Math.min(bounds.minLat, lat)
        bounds.maxLng = Math.max(bounds.maxLng, lng)
        bounds.maxLat = Math.max(bounds.maxLat, lat)
      }
    }
  }
  return bounds
}

const boundsOverlap = (left: GeometryBounds, right: GeometryBounds) => (
  left.minLng < right.maxLng && left.maxLng > right.minLng
  && left.minLat < right.maxLat && left.maxLat > right.minLat
)

const crossesAntimeridian = (geometry: ClippingMultiPolygon) => geometry.some((polygon) => polygon.some((ring) => ring.some((point, index) => {
  const next = ring[index + 1]
  return Boolean(next && Math.abs(next[0] - point[0]) > 180)
})))

const preparedBaselineGeometries = (features: HistoricalFeature[]) => {
  const cached = preparedBaselineCache.get(features)
  if (cached) return cached
  const prepared = features.flatMap((feature) => {
    const geometry = clippingGeometry(feature)
    if (!geometry || geometry.length === 0) return []
    return [{
      id: normalizedIdentity(featureTerritoryName(feature)),
      geometry,
      bounds: clippingGeometryBounds(geometry),
      crossesAntimeridian: crossesAntimeridian(geometry),
    }]
  })
  preparedBaselineCache.set(features, prepared)
  return prepared
}

const cachedClippedDetail = (feature: HistoricalFeature, baseline: HistoricalFeature[], matchedBaselineId: string) => {
  const matchCache = clippedDetailCache.get(feature)?.get(baseline)
  return matchCache?.has(matchedBaselineId) ? { found: true, feature: matchCache.get(matchedBaselineId) ?? null } : { found: false, feature: null }
}

const cacheClippedDetail = (
  feature: HistoricalFeature,
  baseline: HistoricalFeature[],
  matchedBaselineId: string,
  result: HistoricalFeature | null,
) => {
  let baselineCache = clippedDetailCache.get(feature)
  if (!baselineCache) {
    baselineCache = new WeakMap()
    clippedDetailCache.set(feature, baselineCache)
  }
  let matchCache = baselineCache.get(baseline)
  if (!matchCache) {
    matchCache = new Map()
    baselineCache.set(baseline, matchCache)
  }
  matchCache.set(matchedBaselineId, result)
  return result
}

const clippedDetailFeature = (
  feature: HistoricalFeature,
  baselineFeatures: HistoricalFeature[],
  preparedBaseline: PreparedBaselineGeometry[],
  matchedBaselineId: string,
) => {
  const cached = cachedClippedDetail(feature, baselineFeatures, matchedBaselineId)
  if (cached.found) return cached.feature
  const subject = clippingGeometry(feature)
  if (!subject || subject.length === 0 || crossesAntimeridian(subject)) {
    return cacheClippedDetail(feature, baselineFeatures, matchedBaselineId, null)
  }
  const subjectBounds = clippingGeometryBounds(subject)
  const blockers: ClippingMultiPolygon[] = []
  for (const baselineFeature of preparedBaseline) {
    if (baselineFeature.id === matchedBaselineId) continue
    if (!boundsOverlap(subjectBounds, baselineFeature.bounds)) continue
    // Planar clipping cannot safely unwrap a blocker that crosses the date
    // line. Retain the broad source and show the detail as an outline instead.
    if (baselineFeature.crossesAntimeridian) {
      return cacheClippedDetail(feature, baselineFeatures, matchedBaselineId, null)
    }
    blockers.push(baselineFeature.geometry)
  }
  if (blockers.length === 0) return cacheClippedDetail(feature, baselineFeatures, matchedBaselineId, feature)

  try {
    const clipped = polygonClipping.difference(subject, ...blockers)
    if (clipped.length === 0) return cacheClippedDetail(feature, baselineFeatures, matchedBaselineId, null)
    // polygon-clipping follows standard planar GeoJSON winding. d3-geo and
    // three-globe use the opposite spherical ring convention for these maps.
    const coordinates = clipped.map((polygon) => polygon.map((ring) => [...ring].reverse()))
    return cacheClippedDetail(feature, baselineFeatures, matchedBaselineId, {
      ...feature,
      properties: { ...feature.properties, extentResolution: 'neighbor-clipped' as const },
      geometry: { type: 'MultiPolygon' as const, coordinates },
    } as HistoricalFeature)
  } catch {
    // A malformed source ring must never make the whole historical frame fail.
    // The caller retains the broad source and downgrades this detail to outline.
    return cacheClippedDetail(feature, baselineFeatures, matchedBaselineId, null)
  }
}

const replacementGroupsOverlap = (left: HistoricalFeature[], right: HistoricalFeature[]) => {
  for (const leftFeature of left) {
    const leftGeometry = clippingGeometry(leftFeature)
    if (!leftGeometry || leftGeometry.length === 0) return true
    const leftBounds = clippingGeometryBounds(leftGeometry)
    for (const rightFeature of right) {
      const rightGeometry = clippingGeometry(rightFeature)
      if (!rightGeometry || rightGeometry.length === 0) return true
      if (!boundsOverlap(leftBounds, clippingGeometryBounds(rightGeometry))) continue
      try {
        if (polygonClipping.intersection(leftGeometry, rightGeometry).length > 0) return true
      } catch {
        return true
      }
    }
  }
  return false
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
  if (mode === 'composite') {
    const cached = cachedCompositeFeatures(baseline, cliopatria, year)
    if (cached) return cached
  }
  const baselineFeatures = baseline.map((feature) => taggedFeature(feature, 'historical-basemaps'))
  if (mode === 'historical-basemaps') return baselineFeatures
  const detailFeatures = resolveCliopatriaHierarchy(cliopatria, mode)
  if (mode === 'cliopatria') return detailFeatures.map((feature) => taggedFeature(feature, 'cliopatria'))
  if (detailFeatures.length === 0) return mode === 'composite'
    ? cacheCompositeFeatures(baseline, cliopatria, year, baselineFeatures)
    : baselineFeatures

  const baselineGroups = groupTerritories(baselineFeatures)
  const detailGroups = groupTerritories(detailFeatures).sort((left, right) => right.area - left.area)
  const preparedBaseline = preparedBaselineGeometries(baseline)
  const replacedBaselineIds = new Set<string>()
  const matchedDetails = new Map<string, { baselineId: string; canonicalKey: string }>()

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
    matchedDetails.set(detail.id, { baselineId: best.baseline.id, canonicalKey: best.canonicalKey })
  }

  const replacementCandidates = new Map<string, { baselineId: string; canonicalKey: string; features: HistoricalFeature[] }>()
  // Dense modern packs can contain dozens of equivalent assertions. Keep the
  // combined overview responsive by promoting only the largest matched patches;
  // every remaining assertion is still present as a selectable source outline,
  // and Detailed polities continues to expose the complete filled collection.
  const eligibleReplacementIds = new Set([...matchedDetails.keys()].slice(0, MAX_COMPOSITE_REPLACEMENT_GROUPS))
  for (const group of detailGroups) {
    if (!eligibleReplacementIds.has(group.id)) continue
    const match = matchedDetails.get(group.id)
    if (!match) continue
    const clipped = group.features.map((feature) => clippedDetailFeature(feature, baseline, preparedBaseline, match.baselineId))
    if (clipped.some((feature) => !feature)) continue
    replacementCandidates.set(group.id, { ...match, features: clipped as HistoricalFeature[] })
  }

  const conflictingDetailIds = new Set<string>()
  const candidates = [...replacementCandidates.entries()]
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    const [leftId, left] = candidates[leftIndex]
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const [rightId, right] = candidates[rightIndex]
      if (!replacementGroupsOverlap(left.features, right.features)) continue
      conflictingDetailIds.add(leftId)
      conflictingDetailIds.add(rightId)
    }
  }

  const successfulReplacementIds = new Set<string>()
  const markedDetails = detailGroups.flatMap((group) => {
    const replacement = conflictingDetailIds.has(group.id) ? undefined : replacementCandidates.get(group.id)
    if (!replacement) return group.features.map((feature) => taggedFeature(feature, 'cliopatria', 'detail-alternative'))
    successfulReplacementIds.add(replacement.baselineId)
    return replacement.features.map((feature) => taggedFeature(feature, 'cliopatria', 'detail-replacement', replacement.canonicalKey))
  })
  const fallbackFeatures = baselineFeatures.filter((feature) => !successfulReplacementIds.has(normalizedIdentity(featureTerritoryName(feature))))
  return cacheCompositeFeatures(baseline, cliopatria, year, [...fallbackFeatures, ...markedDetails])
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
