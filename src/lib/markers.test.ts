import { describe, expect, it } from 'vitest'
import { buildMarkerOffsets } from './markers'

describe('map marker layout', () => {
  it('leaves isolated markers on their geographic anchor', () => {
    const offsets = buildMarkerOffsets([{ key: 'site:kuk', lat: -5.78, lng: 144.33 }])
    expect(offsets.get('site:kuk')).toEqual({ x: 0, y: 0 })
  })

  it('separates collocated event and place markers deterministically', () => {
    const markers = [
      { key: 'place:kuk', lat: -5.78, lng: 144.33 },
      { key: 'event:kuk-agriculture', lat: -5.78, lng: 144.33 },
    ]
    const forward = buildMarkerOffsets(markers)
    const reversed = buildMarkerOffsets([...markers].reverse())

    expect(forward.get('event:kuk-agriculture')).toEqual({ x: -11, y: 7 })
    expect(forward.get('place:kuk')).toEqual({ x: 11, y: -7 })
    expect([...reversed]).toEqual([...forward])
  })
})
