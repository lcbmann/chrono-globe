import { describe, expect, it } from 'vitest'
import { geoArea } from 'd3-geo'
import { HEMISPHERE_AREA, sanitizeHistoricalFeatures } from './historical-geometry.mjs'

const feature = (coordinates) => ({
  type: 'Feature',
  properties: { NAME: 'Test territory' },
  geometry: { type: 'MultiPolygon', coordinates },
})

describe('historical geometry repair', () => {
  it('rewinds a rounded fragment that d3 interprets as the whole sphere', () => {
    const reversedFragment = [[[
      [5.35949, 5.36835],
      [5.35459, 5.36234],
      [5.44819, 5.47693],
      [5.35949, 5.36835],
    ]]]
    expect(geoArea(feature(reversedFragment))).toBeGreaterThan(HEMISPHERE_AREA)

    const repaired = sanitizeHistoricalFeatures([feature(reversedFragment)])

    expect(repaired.stats.rewoundPolygons).toBe(1)
    expect(repaired.features).toHaveLength(1)
    expect(geoArea(repaired.features[0])).toBeGreaterThan(0)
    expect(geoArea(repaired.features[0])).toBeLessThan(HEMISPHERE_AREA)
  })

  it('removes collapsed polygon parts without discarding valid parts', () => {
    const valid = [[
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
      [0, 0],
    ]]
    const collapsed = [[
      [1, 1],
      [1, 1],
      [2, 2],
      [1, 1],
    ]]

    const repaired = sanitizeHistoricalFeatures([feature([collapsed, valid])])

    expect(repaired.stats.removedPolygons).toBe(1)
    expect(repaired.stats.removedFeatures).toBe(0)
    expect(repaired.features[0].geometry.coordinates).toEqual([valid])
  })

  it('removes a feature that has no usable polygon left', () => {
    const repaired = sanitizeHistoricalFeatures([feature([[[[1, 1], [1, 1], [1, 1]]]])])

    expect(repaired.features).toHaveLength(0)
    expect(repaired.stats.removedFeatures).toBe(1)
  })
})
