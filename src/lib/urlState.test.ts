import { describe, expect, it } from 'vitest'
import { parseAtlasUrl, serializeAtlasUrl } from './urlState'

describe('shareable atlas URL state', () => {
  it('round-trips a selected year, entity, comparison, layers, and camera', () => {
    const query = serializeAtlasUrl({
      year: 1279,
      entity: 'Mongol Empire',
      compareYear: 1200,
      layers: { events: true, capitals: true, cities: false, sites: false, trade: true, migrations: false, expeditions: false },
      view: { lat: 45.123, lng: 82.456, altitude: 1.75 },
    })
    const parsed = parseAtlasUrl(query)
    expect(parsed.year).toBe(1279)
    expect(parsed.entity).toBe('Mongol Empire')
    expect(parsed.compareYear).toBe(1200)
    expect(parsed.layers?.trade).toBe(true)
    expect(parsed.layers?.sites).toBe(false)
    expect(parsed.view).toEqual({ lat: 45.12, lng: 82.46, altitude: 1.75 })
  })

  it('ignores invalid numeric values', () => {
    expect(parseAtlasUrl('?year=wat&lat=x').year).toBeUndefined()
  })
})
