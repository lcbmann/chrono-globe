import { describe, expect, it } from 'vitest'
import type { LayerVisibility } from '../types'
import { historicalPoints, historicalRoutes, layersForDeepLink } from './layers'

describe('historical layer deep links', () => {
  it('enables a selected point or route layer when no layer state is explicit', () => {
    const city = historicalPoints.find((point) => point.kind === 'city')
    const expedition = historicalRoutes.find((route) => route.kind === 'expedition')

    expect(layersForDeepLink(undefined, city, undefined).cities).toBe(true)
    expect(layersForDeepLink(undefined, undefined, expedition).expeditions).toBe(true)
  })

  it('respects explicit layer state, including a disabled owning layer', () => {
    const expedition = historicalRoutes.find((route) => route.kind === 'expedition')
    const explicit: LayerVisibility = {
      events: true,
      capitals: true,
      cities: false,
      sites: true,
      trade: false,
      migrations: false,
      expeditions: false,
    }

    expect(layersForDeepLink(explicit, undefined, expedition)).toEqual(explicit)
  })
})
