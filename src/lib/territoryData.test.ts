import { geoContains } from 'd3-geo'
import { readFileSync } from 'node:fs'
import polygonClipping, { type MultiPolygon as ClippingMultiPolygon, type Pair as ClippingPair } from 'polygon-clipping'
import { describe, expect, it } from 'vitest'
import type { HistoricalEntityIndex, HistoricalFeature, HistoricalMap } from '../types'
import { composeTerritoryFeatures, findTerritoryPack, mergeHistoricalEntityIndexes, territoriesForYear, type TemporalTerritoryManifest } from './territoryData'

const feature = (name: string, datasetId?: string, from = -100, to = 100, type: 'POLITY' | 'RELATION' = 'POLITY'): HistoricalFeature => ({
  type: 'Feature',
  properties: {
    NAME: name, ABBREVN: null, CONTROL: null, SUBJECTO: name, PARTOF: null, BORDERPRECISION: 1,
    datasetId, FromYear: from, ToYear: to, Type: type,
  } as HistoricalFeature['properties'],
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 0], [0, 0]]] },
})

const withProperties = (name: string, properties: Partial<HistoricalFeature['properties']>) => {
  const item = feature(name, properties.datasetId, properties.FromYear ?? -100, properties.ToYear ?? 100, properties.Type ?? 'POLITY')
  return { ...item, properties: { ...item.properties, ...properties } } as HistoricalFeature
}

const boxFeature = (name: string, minLng: number, minLat: number, maxLng: number, maxLat: number, datasetId?: string) => ({
  ...feature(name, datasetId),
  geometry: {
    type: 'Polygon' as const,
    coordinates: [[
      [minLng, minLat], [minLng, maxLat], [maxLng, maxLat], [maxLng, minLat], [minLng, minLat],
    ]],
  },
}) as HistoricalFeature

const clippingCoordinates = (feature: HistoricalFeature): ClippingMultiPolygon => {
  if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') return []
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
  return polygons.map((polygon) => polygon.map((ring) => ring.map((position) => [position[0], position[1]] as ClippingPair)))
}

const readHistoricalMap = (relativePath: string) => JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as HistoricalMap

const manifest = {
  coverage: { startYear: -3400, endYear: 2024 },
  packs: [{ startYear: -100, endYear: -1, filename: 'packs/-100.geojson', features: 1, polities: 1, relations: 0 }],
} as TemporalTerritoryManifest

describe('temporal territory data', () => {
  it('selects only the pack that owns a requested year', () => {
    expect(findTerritoryPack(manifest, -44)?.filename).toBe('packs/-100.geojson')
    expect(findTerritoryPack(manifest, 100)).toBeNull()
  })

  it('filters assertions by their inclusive source range and hides relations by default', () => {
    const map = { type: 'FeatureCollection', features: [feature('Active', 'cliopatria', -50, 20), feature('Later', 'cliopatria', 21, 80), feature('Union', 'cliopatria', -50, 20, 'RELATION')] } as HistoricalMap
    expect(territoriesForYear(map, 20).map((item) => item.properties.NAME)).toEqual(['Active'])
    expect(territoriesForYear(map, 20, true).map((item) => item.properties.NAME)).toEqual(['Active', 'Union'])
  })

  it('keeps unmatched baseline coverage while replacing exact-name duplicates in the combined view', () => {
    const combined = composeTerritoryFeatures(
      [boxFeature('Roman Empire', 0, 0, 1, 1), boxFeature('Ainu', 2, 0, 3, 1)],
      [boxFeature('Roman Empire', 0, 0, 1, 1, 'cliopatria')],
      'composite',
    )
    expect(combined.map((item) => item.properties.NAME)).toEqual(['Ainu', 'Roman Empire'])
    expect((combined[0].properties as { datasetId?: string }).datasetId).toBe('historical-basemaps')
  })

  it('reconciles dated source names and renders one Alexander hierarchy level at a time', () => {
    const parent = withProperties('(Macedonian Empire)', {
      datasetId: 'cliopatria', FromYear: -323, ToYear: -319,
      Components: 'Macedonian Empire;Perdiccas',
    })
    const macedon = withProperties('Macedonian Empire', {
      datasetId: 'cliopatria', FromYear: -323, ToYear: -319,
      MemberOf: '(Macedonian Empire)', PARTOF: '(Macedonian Empire)',
    })
    const perdiccas = withProperties('Perdiccas', {
      datasetId: 'cliopatria', FromYear: -323, ToYear: -319,
      MemberOf: '(Macedonian Empire)', PARTOF: '(Macedonian Empire)',
    })

    const combined = composeTerritoryFeatures([feature('Empire of Alexander')], [parent, macedon, perdiccas], 'composite', -323)
    expect(combined).toHaveLength(1)
    expect(combined[0].properties.NAME).toBe('(Macedonian Empire)')
    expect(combined[0].properties.canonicalEntityKey).toBe('Empire of Alexander')
    expect(combined[0].properties.renderRole).toBe('detail-replacement')

    const detailed = composeTerritoryFeatures([], [parent, macedon, perdiccas], 'cliopatria', -323)
    expect(detailed.map((item) => item.properties.NAME)).toEqual(['Macedonian Empire', 'Perdiccas'])
  })

  it('matches a dated state-form variant without globally conflating namesakes', () => {
    const ancient = composeTerritoryFeatures([feature('Armenia')], [feature('Kingdom of Armenia', 'cliopatria')], 'composite', -323)
    expect(ancient).toHaveLength(1)
    expect(ancient[0].properties.canonicalEntityKey).toBe('Armenia')
    expect(ancient[0].properties.renderRole).toBe('detail-replacement')

    const outsideRuleScope = composeTerritoryFeatures([feature('Armenia')], [feature('Kingdom of Armenia', 'cliopatria')], 'composite', 1000)
    expect(outsideRuleScope.map((item) => item.properties.NAME)).toEqual(['Armenia', 'Kingdom of Armenia'])
    expect(outsideRuleScope[1].properties.renderRole).toBe('detail-alternative')
  })

  it('replaces a matching territorial feature without removing other regions under the same controller', () => {
    const chagatai = { ...boxFeature('Chagatai Khanate', 0, 0, 1, 1), properties: { ...withProperties('Chagatai Khanate', { SUBJECTO: 'Mongol Empire' }).properties } }
    const greatKhanate = { ...boxFeature('Great Khanate', 2, 0, 3, 1), properties: { ...withProperties('Great Khanate', { SUBJECTO: 'Mongol Empire' }).properties } }
    const combined = composeTerritoryFeatures([chagatai, greatKhanate], [boxFeature('Chagatai Khanate', 0, 0, 1, 1, 'cliopatria')], 'composite', 1300)
    expect(combined.map((item) => item.properties.NAME).sort()).toEqual(['Chagatai Khanate', 'Great Khanate'])
    expect(combined.find((item) => item.properties.NAME === 'Great Khanate')?.properties.datasetId).toBe('historical-basemaps')
    expect(combined.find((item) => item.properties.NAME === 'Chagatai Khanate')?.properties.datasetId).toBe('cliopatria')
  })

  it('keeps unmatched detailed assertions as outlines in the combined view', () => {
    const combined = composeTerritoryFeatures([feature('Ainu')], [feature('Kingdom of Armenia', 'cliopatria')], 'composite', -323)
    expect(combined.find((item) => item.properties.NAME === 'Kingdom of Armenia')?.properties.renderRole).toBe('detail-alternative')
  })

  it('clips a detailed replacement around neighbouring baseline territories', () => {
    const broadAlexander = boxFeature('Empire of Alexander', 0, 0, 10, 10)
    const cappadocia = boxFeature('Cappadocia', 0, 8, 4, 12)
    const detailedAlexander = boxFeature('(Macedonian Empire)', 0, 0, 12, 12, 'cliopatria')
    const combined = composeTerritoryFeatures([broadAlexander, cappadocia], [detailedAlexander], 'composite', -323)
    const replacement = combined.find((item) => item.properties.datasetId === 'cliopatria')

    expect(replacement?.properties.renderRole).toBe('detail-replacement')
    expect(replacement?.properties.extentResolution).toBe('neighbor-clipped')
    expect(combined.some((item) => item.properties.NAME === 'Cappadocia')).toBe(true)
    expect(geoContains(replacement!, [2, 9])).toBe(false)
    expect(geoContains(replacement!, [6, 9])).toBe(true)
  })

  it('falls back to the broad source when any replacement member crosses the antimeridian', () => {
    const broad = boxFeature('Empire of Alexander', 0, 0, 10, 10)
    const safeDetail = boxFeature('(Macedonian Empire)', 0, 0, 10, 10, 'cliopatria')
    const datelineDetail = {
      ...safeDetail,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[170, -5], [170, 5], [-170, 5], [-170, -5], [170, -5]]],
      },
    } as HistoricalFeature
    const combined = composeTerritoryFeatures([broad], [safeDetail, datelineDetail], 'composite', -323)

    expect(combined.find((item) => item.properties.datasetId === 'historical-basemaps')?.properties.NAME).toBe('Empire of Alexander')
    expect(combined.filter((item) => item.properties.datasetId === 'cliopatria')).toHaveLength(2)
    expect(combined.filter((item) => item.properties.datasetId === 'cliopatria').every((item) => item.properties.renderRole === 'detail-alternative')).toBe(true)
  })

  it('downgrades detailed replacements that conflict outside their broad source cells', () => {
    const broadWest = boxFeature('Western Realm', 0, 0, 4, 4)
    const broadEast = boxFeature('Eastern Realm', 8, 0, 12, 4)
    const detailedWest = boxFeature('Western Realm', 0, 0, 7, 4, 'cliopatria')
    const detailedEast = boxFeature('Eastern Realm', 5, 0, 12, 4, 'cliopatria')
    const combined = composeTerritoryFeatures([broadWest, broadEast], [detailedWest, detailedEast], 'composite', 400)

    expect(combined.filter((item) => item.properties.datasetId === 'historical-basemaps')).toHaveLength(2)
    expect(combined.filter((item) => item.properties.renderRole === 'detail-replacement')).toHaveLength(0)
    expect(combined.filter((item) => item.properties.renderRole === 'detail-alternative')).toHaveLength(2)
  })

  it('bounds filled detailed replacements in dense combined frames', () => {
    const baseline = Array.from({ length: 10 }, (_, index) => boxFeature(`Realm ${index}`, index * 2, 0, index * 2 + 1, 1))
    const detailed = Array.from({ length: 10 }, (_, index) => boxFeature(`Realm ${index}`, index * 2, 0, index * 2 + 1, 1, 'cliopatria'))
    const combined = composeTerritoryFeatures(baseline, detailed, 'composite', 1900)

    expect(combined.filter((item) => item.properties.renderRole === 'detail-replacement')).toHaveLength(4)
    expect(combined.filter((item) => item.properties.renderRole === 'detail-alternative')).toHaveLength(6)
    expect(combined.filter((item) => item.properties.datasetId === 'historical-basemaps')).toHaveLength(6)
  })

  it('keeps the real 323 BCE combined ownership surface disjoint around Alexander and Armenia', () => {
    const baseline = readHistoricalMap('../../public/data/maps/-323.geojson').features
    const detailedMap = readHistoricalMap('../../public/data/sources/cliopatria/packs/-400.geojson')
    const detailed = territoriesForYear(detailedMap, -323)
    const combined = composeTerritoryFeatures(baseline, detailed, 'composite', -323)
    const byName = (name: string) => combined.find((item) => item.properties.NAME === name)!
    const alexander = combined.find((item) => item.properties.canonicalEntityKey === 'Empire of Alexander')!
    const armenia = combined.find((item) => item.properties.canonicalEntityKey === 'Armenia')!

    expect(alexander.properties.extentResolution).toBe('neighbor-clipped')
    expect(armenia.properties.extentResolution).toBe('neighbor-clipped')
    for (const neighbor of [byName('Cappadocia'), byName('Atropatene')]) {
      expect(polygonClipping.intersection(clippingCoordinates(alexander), clippingCoordinates(neighbor))).toHaveLength(0)
    }
    for (const neighbor of [byName('Atropatene'), byName('Colchis')]) {
      expect(polygonClipping.intersection(clippingCoordinates(armenia), clippingCoordinates(neighbor))).toHaveLength(0)
    }
  })

  it('falls back for the known cross-replacement conflicts in real source frames', () => {
    const cases = [
      { year: -200, map: '-200.geojson', pack: '-200.geojson', names: ['Ptolemaic Kingdom', 'Carthage'] },
      { year: 400, map: '400.geojson', pack: '400.geojson', names: ['Western Roman Empire', 'Eastern Roman Empire'] },
      { year: 1400, map: '1400.geojson', pack: '1400.geojson', names: ['Timurid Empire', 'Blue Horde'] },
    ]

    for (const item of cases) {
      const baseline = readHistoricalMap(`../../public/data/maps/${item.map}`).features
      const detailed = territoriesForYear(readHistoricalMap(`../../public/data/sources/cliopatria/packs/${item.pack}`), item.year)
      const combined = composeTerritoryFeatures(baseline, detailed, 'composite', item.year)
      for (const name of item.names) {
        expect(combined.some((feature) => feature.properties.NAME === name && feature.properties.datasetId === 'historical-basemaps')).toBe(true)
        expect(combined.some((feature) => feature.properties.NAME === name && feature.properties.renderRole === 'detail-replacement')).toBe(false)
        expect(combined.some((feature) => feature.properties.NAME === name && feature.properties.renderRole === 'detail-alternative')).toBe(true)
      }
    }
  })

  it('merges exact entity histories without inventing intermediate observation years', () => {
    const baseline: HistoricalEntityIndex = { key: 'Rome', name: 'Rome', aliases: [], years: [-500, -200], firstYear: -500, lastYear: -200, peakYear: -200, maxArea: .1 }
    const detail: HistoricalEntityIndex = { key: 'Rome', name: 'Rome', aliases: ['Roman state'], years: [-400, -300], firstYear: -400, lastYear: -300, peakYear: -300, maxArea: .2 }
    expect(mergeHistoricalEntityIndexes([baseline], [detail])).toEqual([{
      key: 'Rome', name: 'Rome', aliases: ['Roman state'], years: [-500, -400, -300, -200], firstYear: -500, lastYear: -200, peakYear: -300, maxArea: .2,
    }])
  })

  it('preserves the final asserted interval beyond the last change year', () => {
    const entity: HistoricalEntityIndex = { key: 'Example', name: 'Example', aliases: [], years: [1900], firstYear: 1900, lastYear: 1949, peakYear: 1900, maxArea: .1 }
    expect(mergeHistoricalEntityIndexes([entity])[0].lastYear).toBe(1949)
  })
})
