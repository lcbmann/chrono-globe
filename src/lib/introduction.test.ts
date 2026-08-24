import { describe, expect, it } from 'vitest'
import { hasExplorationDeepLink, introductionVersion, shouldOfferIntroduction } from './introduction'

describe('introduction preferences', () => {
  it('offers the introduction to a new visitor on the default view', () => {
    expect(shouldOfferIntroduction(null, {})).toBe(true)
  })

  it('does not repeatedly offer a completed introduction', () => {
    expect(shouldOfferIntroduction(introductionVersion, {})).toBe(false)
  })

  it('does not interrupt a shared exploration link', () => {
    expect(hasExplorationDeepLink({ year: -323, entity: 'Rome' })).toBe(true)
    expect(shouldOfferIntroduction(null, { story: 'silk-road' })).toBe(false)
    expect(shouldOfferIntroduction(null, { point: 'nan-madol-site' })).toBe(false)
    expect(shouldOfferIntroduction(null, { route: 'pacific-voyaging' })).toBe(false)
    expect(shouldOfferIntroduction(null, { compareYear: 1492 })).toBe(false)
    expect(shouldOfferIntroduction(null, { side: 'comparison' })).toBe(false)
    expect(shouldOfferIntroduction(null, { mode: 'earth' })).toBe(false)
    expect(shouldOfferIntroduction(null, { layers: { events: true, capitals: false, cities: false, sites: false, trade: false, migrations: false, expeditions: false } })).toBe(false)
    expect(shouldOfferIntroduction(null, { view: { lat: 20, lng: 40, altitude: 1.8 } })).toBe(false)
  })

  it('reoffers a newer introduction when the stored value is unrelated', () => {
    expect(shouldOfferIntroduction('old-version', {})).toBe(true)
  })
})
