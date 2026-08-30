import { defaultLayers } from '../data/layers'
import type { GlobeMode, GlobeViewpoint, LayerVisibility } from '../types'

export interface AtlasUrlState {
  year?: number
  entity?: string
  event?: string
  point?: string
  route?: string
  mode?: GlobeMode
  compareYear?: number
  side?: 'comparison'
  story?: string
  storyStep?: number
  layers?: LayerVisibility
  view?: GlobeViewpoint
}

const finiteNumber = (value: string | null) => {
  if (value === null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const numberInRange = (value: string | null, minimum: number, maximum: number) => {
  const parsed = finiteNumber(value)
  return parsed !== undefined && parsed >= minimum && parsed <= maximum ? parsed : undefined
}

const nonNegativeInteger = (value: string | null) => {
  const parsed = finiteNumber(value)
  return parsed !== undefined && Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

export const parseAtlasUrl = (search: string): AtlasUrlState => {
  const params = new URLSearchParams(search)
  const requestedMode = params.get('mode')
  const enabledLayers = new Set((params.get('layers') || '').split(',').filter(Boolean))
  const hasLayers = params.has('layers')
  const lat = numberInRange(params.get('lat'), -90, 90)
  const lng = numberInRange(params.get('lng'), -180, 180)
  const altitude = numberInRange(params.get('alt'), .25, 10)
  return {
    year: finiteNumber(params.get('year')),
    entity: params.get('entity') || undefined,
    event: params.get('event') || undefined,
    point: params.get('point') || undefined,
    route: params.get('route') || undefined,
    mode: requestedMode === 'earth' || requestedMode === 'historical' ? requestedMode : undefined,
    compareYear: finiteNumber(params.get('compare')),
    side: params.get('side') === 'comparison' ? 'comparison' : undefined,
    story: params.get('story') || undefined,
    storyStep: nonNegativeInteger(params.get('step')),
    layers: hasLayers ? Object.fromEntries(Object.keys(defaultLayers).map((key) => [key, enabledLayers.has(key)])) as unknown as LayerVisibility : undefined,
    view: lat !== undefined && lng !== undefined && altitude !== undefined ? { lat, lng, altitude } : undefined,
  }
}

export const serializeAtlasUrl = (state: AtlasUrlState) => {
  const params = new URLSearchParams()
  if (state.year !== undefined) params.set('year', String(state.year))
  if (state.entity) params.set('entity', state.entity)
  if (state.event) params.set('event', state.event)
  if (state.point) params.set('point', state.point)
  if (state.route) params.set('route', state.route)
  if (state.mode && state.mode !== 'atlas') params.set('mode', state.mode)
  if (state.compareYear !== undefined) params.set('compare', String(state.compareYear))
  if (state.compareYear !== undefined && state.side === 'comparison') params.set('side', 'comparison')
  if (state.story) params.set('story', state.story)
  if (state.storyStep !== undefined && state.storyStep > 0) params.set('step', String(state.storyStep))
  if (state.layers) {
    const enabled = Object.entries(state.layers).filter(([, value]) => value).map(([key]) => key)
    const defaults = Object.entries(defaultLayers).filter(([, value]) => value).map(([key]) => key)
    if (enabled.join(',') !== defaults.join(',')) params.set('layers', enabled.join(','))
  }
  if (state.view) {
    params.set('lat', state.view.lat.toFixed(2))
    params.set('lng', state.view.lng.toFixed(2))
    params.set('alt', state.view.altitude.toFixed(2))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}
