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
    const combined = composeTerritoryFeatures([feature('Roman Empire'), feature('Ainu')], [feature('Roman Empire', 'cliopatria')], 'composite')
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
    const chagatai = withProperties('Chagatai Khanate', { SUBJECTO: 'Mongol Empire' })
    const greatKhanate = withProperties('Great Khanate', { SUBJECTO: 'Mongol Empire' })
    const combined = composeTerritoryFeatures([chagatai, greatKhanate], [feature('Chagatai Khanate', 'cliopatria')], 'composite', 1300)
    expect(combined.map((item) => item.properties.NAME).sort()).toEqual(['Chagatai Khanate', 'Great Khanate'])
    expect(combined.find((item) => item.properties.NAME === 'Great Khanate')?.properties.datasetId).toBe('historical-basemaps')
    expect(combined.find((item) => item.properties.NAME === 'Chagatai Khanate')?.properties.datasetId).toBe('cliopatria')
  })

  it('keeps unmatched detailed assertions as outlines in the combined view', () => {
    const combined = composeTerritoryFeatures([feature('Ainu')], [feature('Kingdom of Armenia', 'cliopatria')], 'composite', -323)
    expect(combined.find((item) => item.properties.NAME === 'Kingdom of Armenia')?.properties.renderRole).toBe('detail-alternative')
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
