import { describe, expect, it } from 'vitest'
import { parseAtlasUrl, serializeAtlasUrl } from './urlState'

describe('shareable atlas URL state', () => {
  it('round-trips a selected year, entity, comparison, layers, and camera', () => {
    const query = serializeAtlasUrl({
      year: 1279,
      entity: 'Mongol Empire',
      compareYear: 1200,
      side: 'comparison',
      layers: { events: true, capitals: true, cities: false, sites: false, trade: true, migrations: false, expeditions: false },
      view: { lat: 45.123, lng: 82.456, altitude: 1.75 },
    })
    const parsed = parseAtlasUrl(query)
    expect(parsed.year).toBe(1279)
    expect(parsed.entity).toBe('Mongol Empire')
    expect(parsed.compareYear).toBe(1200)
    expect(parsed.side).toBe('comparison')
    expect(parsed.layers?.trade).toBe(true)
    expect(parsed.layers?.sites).toBe(false)
    expect(parsed.view).toEqual({ lat: 45.12, lng: 82.46, altitude: 1.75 })
  })

  it('ignores invalid numeric values', () => {
    expect(parseAtlasUrl('?year=wat&lat=x').year).toBeUndefined()
  })

  it('rejects unsafe camera positions and invalid story steps', () => {
    expect(parseAtlasUrl('?lat=999&lng=20&alt=1.5').view).toBeUndefined()
    expect(parseAtlasUrl('?lat=20&lng=-181&alt=1.5').view).toBeUndefined()
    expect(parseAtlasUrl('?lat=20&lng=30&alt=-2').view).toBeUndefined()
    expect(parseAtlasUrl('?step=-1').storyStep).toBeUndefined()
    expect(parseAtlasUrl('?step=1.5').storyStep).toBeUndefined()
  })

  it('only serializes a comparison side when comparison is enabled', () => {
    expect(serializeAtlasUrl({ side: 'comparison' })).toBe('')
    expect(serializeAtlasUrl({ compareYear: 1200, side: 'comparison' })).toContain('side=comparison')
  })

  it('round-trips selected places and routes', () => {
    expect(parseAtlasUrl(serializeAtlasUrl({ point: 'nan-madol-site' })).point).toBe('nan-madol-site')
    expect(parseAtlasUrl(serializeAtlasUrl({ route: 'pacific-voyaging' })).route).toBe('pacific-voyaging')
  })

  it('round-trips the optional globe appearances without serializing the default', () => {
    expect(parseAtlasUrl(serializeAtlasUrl({ mode: 'historical' })).mode).toBe('historical')
    expect(parseAtlasUrl(serializeAtlasUrl({ mode: 'earth' })).mode).toBe('earth')
    expect(serializeAtlasUrl({ mode: 'atlas' })).toBe('')
    expect(parseAtlasUrl('?mode=unknown').mode).toBeUndefined()
  })
})
