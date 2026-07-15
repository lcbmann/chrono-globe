import { defaultLayers } from '../data/layers'
import type { GlobeViewpoint, LayerVisibility } from '../types'

export interface AtlasUrlState {
  year?: number
  entity?: string
  event?: string
  mode?: 'atlas' | 'earth'
  compareYear?: number
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

export const parseAtlasUrl = (search: string): AtlasUrlState => {
  const params = new URLSearchParams(search)
  const enabledLayers = new Set((params.get('layers') || '').split(',').filter(Boolean))
  const hasLayers = params.has('layers')
  const lat = finiteNumber(params.get('lat'))
  const lng = finiteNumber(params.get('lng'))
  const altitude = finiteNumber(params.get('alt'))
  return {
    year: finiteNumber(params.get('year')),
    entity: params.get('entity') || undefined,
    event: params.get('event') || undefined,
    mode: params.get('mode') === 'earth' ? 'earth' : undefined,
    compareYear: finiteNumber(params.get('compare')),
    story: params.get('story') || undefined,
    storyStep: finiteNumber(params.get('step')),
    layers: hasLayers ? Object.fromEntries(Object.keys(defaultLayers).map((key) => [key, enabledLayers.has(key)])) as unknown as LayerVisibility : undefined,
    view: lat !== undefined && lng !== undefined && altitude !== undefined ? { lat, lng, altitude } : undefined,
  }
}

export const serializeAtlasUrl = (state: AtlasUrlState) => {
  const params = new URLSearchParams()
  if (state.year !== undefined) params.set('year', String(state.year))
  if (state.entity) params.set('entity', state.entity)
  if (state.event) params.set('event', state.event)
  if (state.mode === 'earth') params.set('mode', 'earth')
  if (state.compareYear !== undefined) params.set('compare', String(state.compareYear))
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
