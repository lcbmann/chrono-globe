import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { geoArea, geoCentroid } from 'd3-geo'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { feature as topojsonFeature } from 'topojson-client'
import { AmbientLight, Color, DirectionalLight, MeshPhongMaterial } from 'three'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { getCivilizationProfile } from '../data/civilizations'
import { changeColors, changeLabels } from '../lib/changes'
import { entityColor, entityKey, escapeHtml } from '../lib/entities'
import { buildMarkerOffsets } from '../lib/markers'
import type { TerritorySourceMode } from '../lib/territoryData'
import { formatYear } from '../lib/time'
import { defaultGlobeViewpoint } from '../lib/viewpoint'
import type { ChangeKind, GlobeViewpoint, HistoricalEntityIndex, HistoricalEvent, HistoricalFeature, HistoricalPoint, HistoricalRoute } from '../types'

interface LandProperties { __layer: 'land' }
type LandFeature = Feature<Geometry, LandProperties>

interface HtmlLabel {
  kind: 'entity' | 'event' | 'point' | 'marker'
  lat: number
  lng: number
  text: string
  color: string
  detail?: string
  markerKind?: MarkerKind
  selected?: boolean
  tooltipBelow?: boolean
  offsetX?: number
  offsetY?: number
  onSelect?: () => void
}

type RenderPolygon = LandFeature | HistoricalFeature
type MarkerKind = 'event' | HistoricalPoint['kind']
const compactRendererMedia = '(max-width: 680px), (max-width: 900px) and (max-height: 500px)'

interface GlobeViewProps {
  features: HistoricalFeature[]
  active?: boolean
  focusRequest?: { id: number; frameId?: string; location?: { lat: number; lng: number } } | null
  frameId?: string
  history: HistoricalEntityIndex[]
  selectedKey: string | null
  events: HistoricalEvent[]
  points?: HistoricalPoint[]
  routes?: HistoricalRoute[]
  selectedEvent: HistoricalEvent | null
  selectedPoint?: HistoricalPoint | null
  selectedRoute?: HistoricalRoute | null
  mode: 'atlas' | 'earth'
  territorySourceMode?: TerritorySourceMode
  showChanges?: boolean
  changeKinds?: Map<string, ChangeKind>
  initialViewRef?: RefObject<GlobeViewpoint>
  onViewChange?: (view: GlobeViewpoint) => void
  onActivate?: (view: GlobeViewpoint) => void
  onFocusRequestHandled?: (id: number) => void
  onFrameReady?: (frameId: string) => void
  onSelect: (feature: HistoricalFeature) => void
  onEventSelect: (event: HistoricalEvent) => void
  onPointSelect?: (point: HistoricalPoint) => void
  onRouteSelect?: (route: HistoricalRoute) => void
  onClearSelection: () => void
}

type GlobePoint = ({ pointType: 'event' } & HistoricalEvent) | ({ pointType: 'place' } & HistoricalPoint)
interface RouteSegment { route: HistoricalRoute; start: { lat: number; lng: number }; end: { lat: number; lng: number } }

const markerColors: Record<MarkerKind, string> = {
  event: '#e2b86c',
  capital: '#e89a6b',
  city: '#66bec7',
  site: '#b39ad2',
}
const markerKindLabels: Record<MarkerKind, string> = {
  event: 'Historical moment',
  capital: 'Capital',
  city: 'Historic city',
  site: 'Historical site',
}
const globePointKey = (point: GlobePoint) => `${point.pointType}:${point.id}`
const globePointKind = (point: GlobePoint): MarkerKind => point.pointType === 'event' ? 'event' : point.kind
const globePointTitle = (point: GlobePoint) => point.pointType === 'event' ? point.title : point.name
const globePointDetail = (point: GlobePoint) => point.pointType === 'event'
  ? `${markerKindLabels.event} · ${formatYear(point.year)}`
  : `${markerKindLabels[point.kind]} · from ${formatYear(point.startYear)}`

const rgba = (hex: string, alpha: number) => {
  const value = hex.replace('#', '')
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(value.slice(2, 4), 16)}, ${Number.parseInt(value.slice(4, 6), 16)}, ${alpha})`
}

const stableLayerRank = (key: string) => {
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 251
}

const isLand = (polygon: RenderPolygon): polygon is LandFeature => {
  const properties = polygon.properties
  return Boolean(properties && '__layer' in properties && properties.__layer === 'land')
}
const historicalFeature = (polygon: RenderPolygon) => isLand(polygon) ? null : polygon
const precisionLabel = (precision: number | null) => precision === 3 ? 'Well documented' : precision === 2 ? 'Moderately certain' : 'Approximate extent'
const sourceProperties = (feature: HistoricalFeature) => feature.properties as HistoricalFeature['properties'] & {
  datasetId?: string
  renderRole?: 'primary' | 'detail-replacement' | 'detail-alternative'
  FromYear?: number
  ToYear?: number
}
const featureDatasetId = (feature: HistoricalFeature) => sourceProperties(feature).datasetId || 'historical-basemaps'

let landRequest: Promise<LandFeature[]> | null = null
const loadLand = () => {
  if (landRequest) return landRequest
  landRequest = fetch(`${import.meta.env.BASE_URL}data/land-110m.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`Land data request failed (${response.status})`)
      return response.json() as Promise<Topology<{ land: GeometryCollection }>>
    })
    .then((topology) => {
      const geography = topojsonFeature(topology, topology.objects.land) as unknown as Feature<Geometry> | FeatureCollection<Geometry>
      const features = geography.type === 'FeatureCollection' ? geography.features : [geography]
      return features.map((item) => ({ ...item, properties: { __layer: 'land' as const } }))
    })
    .catch((error: unknown) => {
      landRequest = null
      throw error
    })
  return landRequest
}

const polygonGeometry = (object: object) => (
  historicalFeature(object as RenderPolygon)?.geometry || (object as LandFeature).geometry
) as never
const arcStartLat = (object: object) => (object as RouteSegment).start.lat
const arcStartLng = (object: object) => (object as RouteSegment).start.lng
const arcEndLat = (object: object) => (object as RouteSegment).end.lat
const arcEndLng = (object: object) => (object as RouteSegment).end.lng
const arcTooltip = (object: object) => {
  const route = (object as RouteSegment).route
  return `<div class="globe-tooltip"><strong>${escapeHtml(route.name)}</strong><span>${route.kind} route · schematic</span></div>`
}
const htmlAltitude = (object: object) => {
  const label = object as HtmlLabel
  if (label.kind === 'marker') return .014
  if (label.kind === 'event' || label.kind === 'point') return .024
  return .04
}
const renderHtmlLabel = (object: object) => {
  const label = object as HtmlLabel
  if (label.kind === 'marker') {
    const anchor = document.createElement('div')
    anchor.className = 'globe-poi-marker-anchor'
    anchor.style.setProperty('--poi-color', label.color)
    anchor.style.setProperty('--poi-offset-x', `${label.offsetX || 0}px`)
    anchor.style.setProperty('--poi-offset-y', `${label.offsetY || 0}px`)
    const element = document.createElement('button')
    element.type = 'button'
    element.className = `globe-poi-marker marker-${label.markerKind}${label.selected ? ' is-selected' : ''}${label.tooltipBelow ? ' tooltip-below' : ''}`
    element.setAttribute('aria-label', `Open ${label.detail}: ${label.text}`)
    element.addEventListener('pointerdown', (event) => event.stopPropagation())
    element.addEventListener('click', (event) => {
      event.stopPropagation()
      label.onSelect?.()
    })

    const glyph = document.createElement('span')
    glyph.className = 'globe-poi-glyph'
    glyph.setAttribute('aria-hidden', 'true')
    const tooltip = document.createElement('span')
    tooltip.className = 'globe-poi-tooltip'
    const title = document.createElement('strong')
    title.textContent = label.text
    const detail = document.createElement('small')
    detail.textContent = label.detail || ''
    tooltip.append(title, detail)
    element.append(glyph, tooltip)
    anchor.append(element)
    return anchor
  }

  const element = document.createElement('div')
  element.className = label.kind === 'event' ? 'globe-event-label' : label.kind === 'point' ? 'globe-point-label' : 'globe-entity-label'
  if (label.kind === 'event' || label.kind === 'point') {
    const anchor = document.createElement('div')
    anchor.className = 'globe-poi-callout-anchor'
    anchor.style.setProperty('--poi-color', label.color)
    anchor.style.setProperty('--poi-offset-x', `${label.offsetX || 0}px`)
    anchor.style.setProperty('--poi-offset-y', `${label.offsetY || 0}px`)
    const marker = document.createElement('span')
    marker.textContent = label.detail || (label.kind === 'event' ? 'Historical moment' : 'Historical place')
    const title = document.createElement('strong')
    title.textContent = label.text
    element.append(marker, title)
    anchor.append(element)
    return anchor
  }
  element.style.setProperty('--entity-color', label.color)
  element.textContent = label.text
  return element
}

function GlobeViewComponent({
  features, active = true, focusRequest = null, frameId, history, selectedKey, events, points = [], routes = [], selectedEvent,
  selectedPoint = null, selectedRoute = null, mode, territorySourceMode = 'historical-basemaps', showChanges = false, changeKinds, initialViewRef, onViewChange,
  onActivate, onFocusRequestHandled, onFrameReady, onSelect, onEventSelect, onPointSelect, onRouteSelect, onClearSelection,
}: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const transitionCanvasRef = useRef<HTMLCanvasElement>(null)
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const mountedRef = useRef(false)
  const readyRequestedRef = useRef(false)
  const readyInitializedRef = useRef(false)
  const readyFrameRef = useRef<number | null>(null)
  const handledFocusRequestRef = useRef(0)
  const visibleFrameRef = useRef(frameId)
  const visualFeaturesRef = useRef(features)
  const transitionFrameRef = useRef<number | null>(null)
  const transitionTimerRef = useRef<number | null>(null)
  const activeRef = useRef(active)
  activeRef.current = active
  const [size, setSize] = useState({ width: 900, height: 700 })
  const [land, setLand] = useState<LandFeature[]>([])
  const [ready, setReady] = useState(false)
  const [visualFeatures, setVisualFeatures] = useState(features)
  const [visibleFrameId, setVisibleFrameId] = useState(frameId)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const scheduleReady = useCallback(() => {
    if (readyInitializedRef.current || readyFrameRef.current !== null) return
    readyFrameRef.current = window.requestAnimationFrame(() => {
      readyFrameRef.current = null
      if (!mountedRef.current || readyInitializedRef.current) return
      readyInitializedRef.current = true
      readyRequestedRef.current = false
      setReady(true)
      const globe = globeRef.current
      if (!globe) return
      globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, window.matchMedia(compactRendererMedia).matches ? 1.5 : 2))
      globe.pointOfView(initialViewRef?.current || defaultGlobeViewpoint, 0)
      const controls = globe.controls()
      controls.enablePan = false
      controls.enableDamping = true
      controls.dampingFactor = .08
      controls.rotateSpeed = .55
      if (!activeRef.current) globe.pauseAnimation()
    })
  }, [initialViewRef])

  const globeMaterial = useMemo(() => new MeshPhongMaterial(mode === 'earth' ? {
    color: new Color('#ffffff'),
    shininess: 32,
    specular: new Color('#182a31'),
  } : {
    color: new Color('#071a23'), emissive: new Color('#031017'), emissiveIntensity: .38, shininess: 18, specular: new Color('#2b7888'),
  }), [mode])
  useEffect(() => () => {
    globeMaterial.map?.dispose()
    globeMaterial.bumpMap?.dispose()
    globeMaterial.dispose()
  }, [globeMaterial])

  useEffect(() => {
    mountedRef.current = true
    if (readyRequestedRef.current) scheduleReady()
    return () => {
      mountedRef.current = false
      if (readyFrameRef.current !== null) {
        window.cancelAnimationFrame(readyFrameRef.current)
        readyFrameRef.current = null
      }
    }
  }, [scheduleReady])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', updatePreference)
    return () => preference.removeEventListener('change', updatePreference)
  }, [])

  const clearFrameTransition = useCallback((immediate = true) => {
    if (transitionFrameRef.current !== null) {
      window.cancelAnimationFrame(transitionFrameRef.current)
      transitionFrameRef.current = null
    }
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
    const overlay = transitionCanvasRef.current
    if (!overlay) return
    if (immediate) overlay.style.transition = 'none'
    overlay.style.opacity = '0'
    overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height)
    if (immediate) {
      void overlay.offsetWidth
      overlay.style.removeProperty('transition')
    }
  }, [])

  useEffect(() => {
    if (visibleFrameRef.current === frameId) {
      visualFeaturesRef.current = features
      setVisualFeatures(features)
      return
    }

    if (reducedMotion || visualFeaturesRef.current.length === 0 || !visibleFrameRef.current) {
      clearFrameTransition()
      visibleFrameRef.current = frameId
      visualFeaturesRef.current = features
      setVisualFeatures(features)
      setVisibleFrameId(frameId)
      return
    }

    clearFrameTransition()
    const globe = globeRef.current
    const overlay = transitionCanvasRef.current
    const source = globe?.renderer().domElement
    const context = overlay?.getContext('2d')
    if (globe && overlay && source && context) {
      try {
        globe.renderer().render(globe.scene(), globe.camera())
        overlay.width = source.width
        overlay.height = source.height
        context.drawImage(source, 0, 0, overlay.width, overlay.height)
        overlay.style.transition = 'none'
        overlay.style.opacity = '1'
        void overlay.offsetWidth
        overlay.style.removeProperty('transition')
      } catch {
        clearFrameTransition()
      }
    }

    visibleFrameRef.current = frameId
    visualFeaturesRef.current = features
    setVisualFeatures(features)
    setVisibleFrameId(frameId)
    transitionFrameRef.current = window.requestAnimationFrame(() => {
      transitionFrameRef.current = window.requestAnimationFrame(() => {
        if (overlay) overlay.style.opacity = '0'
        transitionFrameRef.current = null
        transitionTimerRef.current = window.setTimeout(() => clearFrameTransition(false), 720)
      })
    })

    return () => clearFrameTransition()
  }, [clearFrameTransition, features, frameId, reducedMotion])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let active = true
    const observer = new ResizeObserver(([entry]) => {
      if (!active) return
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      setSize((current) => current.width === width && current.height === height ? current : { width, height })
    })
    observer.observe(container)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    let active = true
    loadLand()
      .then((features) => { if (active) setLand(features) })
      .catch(() => { if (active) setLand([]) })
    return () => { active = false }
  }, [])

  const selectedFeatures = useMemo(() => visualFeatures.filter((item) => entityKey(item) === selectedKey), [selectedKey, visualFeatures])
  const selectedCenter = useMemo(() => {
    if (selectedFeatures.length === 0) return null
    const collection: FeatureCollection = { type: 'FeatureCollection', features: selectedFeatures }
    const [lng, lat] = geoCentroid(collection)
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  }, [selectedFeatures])
  const selectedRouteCenter = useMemo(() => {
    if (!selectedRoute || selectedRoute.coordinates.length === 0) return null
    const routeFeature: Feature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: selectedRoute.coordinates.map((coordinate) => [coordinate.lng, coordinate.lat]) },
    }
    const [lng, lat] = geoCentroid(routeFeature)
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  }, [selectedRoute])

  useEffect(() => {
    if (!ready || visibleFrameId !== frameId || !focusRequest || handledFocusRequestRef.current === focusRequest.id) return
    if (focusRequest.frameId && visibleFrameId !== focusRequest.frameId) return
    const focus = focusRequest.location || selectedEvent || selectedPoint || selectedRouteCenter || selectedCenter
    if (!focus) return
    handledFocusRequestRef.current = focusRequest.id
    globeRef.current?.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: 1.65 }, reducedMotion ? 0 : 900)
    onFocusRequestHandled?.(focusRequest.id)
  }, [focusRequest, frameId, onFocusRequestHandled, ready, reducedMotion, selectedCenter, selectedEvent, selectedPoint, selectedRouteCenter, visibleFrameId])

  useEffect(() => {
    if (!ready) return
    const globe = globeRef.current
    if (!globe) return
    const ambient = new AmbientLight(mode === 'earth' ? '#c4d0d2' : '#9bc1c8', mode === 'earth' ? 1.25 : 1.35)
    const directional = new DirectionalLight('#fff0ce', mode === 'earth' ? 1.55 : 2.8)
    directional.position.set(-180, 120, 160)
    globe.lights([ambient, directional])
  }, [mode, ready])

  useEffect(() => {
    if (!ready || !globeRef.current) return
    const updateAnimation = () => {
      if (active && !document.hidden) globeRef.current?.resumeAnimation()
      else globeRef.current?.pauseAnimation()
    }
    updateAnimation()
    document.addEventListener('visibilitychange', updateAnimation)
    return () => document.removeEventListener('visibilitychange', updateAnimation)
  }, [active, ready])

  useEffect(() => {
    if (!ready || !frameId || visibleFrameId !== frameId || !onFrameReady) return
    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => onFrameReady(frameId))
    })
    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) window.cancelAnimationFrame(secondFrame)
    }
  }, [frameId, onFrameReady, ready, visibleFrameId, visualFeatures])

  const orderedFeatures = useMemo(() => [...visualFeatures].sort((left, right) => {
    const datasetOrder = Number(featureDatasetId(left) === 'cliopatria') - Number(featureDatasetId(right) === 'cliopatria')
    if (datasetOrder) return datasetOrder
    const keyOrder = entityKey(left).localeCompare(entityKey(right))
    return keyOrder || (left.properties.NAME || '').localeCompare(right.properties.NAME || '')
  }), [visualFeatures])
  const polygons = useMemo<RenderPolygon[]>(() => mode === 'atlas' ? [...land, ...orderedFeatures] : orderedFeatures, [land, mode, orderedFeatures])
  const historyByKey = useMemo(() => new Map(history.map((item) => [item.key, item])), [history])
  const globePoints = useMemo<GlobePoint[]>(() => [
    ...events.map((event) => ({ ...event, pointType: 'event' as const })),
    ...points.map((point) => ({ ...point, pointType: 'place' as const })),
  ], [events, points])
  const selectedMarkerKey = selectedEvent ? `event:${selectedEvent.id}` : selectedPoint ? `place:${selectedPoint.id}` : null
  const selectedMarkerLocation = selectedEvent || selectedPoint
  const markerOffsets = useMemo(() => buildMarkerOffsets(globePoints.map((point) => ({
    key: globePointKey(point),
    lat: point.lat,
    lng: point.lng,
  }))), [globePoints])
  const markerLabels = useMemo<HtmlLabel[]>(() => globePoints.map((point) => {
    const key = globePointKey(point)
    const markerKind = globePointKind(point)
    const offset = markerOffsets.get(key) || { x: 0, y: 0 }
    return {
      kind: 'marker',
      markerKind,
      lat: point.lat,
      lng: point.lng,
      text: globePointTitle(point),
      detail: globePointDetail(point),
      color: markerColors[markerKind],
      selected: key === selectedMarkerKey,
      tooltipBelow: Boolean(key !== selectedMarkerKey && selectedMarkerLocation
        && point.lat === selectedMarkerLocation.lat && point.lng === selectedMarkerLocation.lng),
      offsetX: offset.x,
      offsetY: offset.y,
      onSelect: point.pointType === 'event' ? () => onEventSelect(point) : () => onPointSelect?.(point),
    }
  }), [globePoints, markerOffsets, onEventSelect, onPointSelect, selectedMarkerKey, selectedMarkerLocation])
  const routeSegments = useMemo<RouteSegment[]>(() => routes.flatMap((route) => route.coordinates.slice(0, -1).map((start, index) => ({ route, start, end: route.coordinates[index + 1] }))), [routes])
  const prominence = useCallback((feature: HistoricalFeature) => {
    const key = entityKey(feature)
    if (key === selectedKey) return 1
    const curated = getCivilizationProfile(key)?.importance
    if (curated !== undefined) return .78 + curated * .22
    const area = historyByKey.get(key)?.maxArea || geoArea(feature)
    const cultural = /culture|hunter|burial|pottery|complex|tradition/i.test(key)
    const extentScore = Math.min(1, Math.sqrt(area / .12))
    return Math.max(.08, (.1 + extentScore * .4) * (cultural ? .48 : 1))
  }, [historyByKey, selectedKey])
  const htmlLabels = useMemo<HtmlLabel[]>(() => {
    if (selectedEvent) {
      const offset = markerOffsets.get(`event:${selectedEvent.id}`)
      return [{
        kind: 'event', lat: selectedEvent.lat, lng: selectedEvent.lng, text: selectedEvent.title,
        detail: `${markerKindLabels.event} · ${formatYear(selectedEvent.year)}`,
        color: markerColors.event, offsetX: offset?.x, offsetY: offset?.y,
      }]
    }
    if (selectedPoint) {
      const offset = markerOffsets.get(`place:${selectedPoint.id}`)
      return [{
        kind: 'point', lat: selectedPoint.lat, lng: selectedPoint.lng, text: selectedPoint.name,
        detail: markerKindLabels[selectedPoint.kind], color: markerColors[selectedPoint.kind],
        offsetX: offset?.x, offsetY: offset?.y,
      }]
    }
    if (!selectedKey || !selectedCenter) return []
    return [{
      kind: 'entity', ...selectedCenter,
      text: getCivilizationProfile(selectedKey)?.displayName || selectedKey,
      color: entityColor(selectedKey),
    }]
  }, [markerOffsets, selectedCenter, selectedEvent, selectedKey, selectedPoint])
  const htmlElements = useMemo(() => [...markerLabels, ...htmlLabels], [htmlLabels, markerLabels])

  const handleReady = useCallback(() => {
    readyRequestedRef.current = true
    scheduleReady()
  }, [scheduleReady])

  const polygonLabel = useCallback((object: object) => {
    const polygon = object as RenderPolygon
    const feature = historicalFeature(polygon)
    if (!feature) return ''
    const key = entityKey(feature)
    const region = feature.properties.NAME || 'Unnamed territory'
    const regional = region !== key ? `<div>Region: ${escapeHtml(region)}</div>` : ''
    const change = showChanges ? changeKinds?.get(key) : undefined
    const changeCopy = change ? ` · ${changeLabels[change]}` : ''
    const properties = sourceProperties(feature)
    const source = featureDatasetId(feature) === 'cliopatria' ? 'Seshat Cliopatria' : 'Historical Basemaps'
    const assertedRange = Number.isInteger(properties.FromYear) && Number.isInteger(properties.ToYear)
      ? ` · ${formatYear(properties.FromYear!)}–${formatYear(properties.ToYear!)}`
      : ''
    return `<div class="globe-tooltip"><strong>${escapeHtml(key)}</strong>${regional}<span>${precisionLabel(feature.properties.BORDERPRECISION)}${changeCopy}</span><span>Source: ${source}${assertedRange}</span></div>`
  }, [changeKinds, showChanges])

  const polygonAltitude = useCallback((object: object) => {
    const feature = historicalFeature(object as RenderPolygon)
    if (!feature) return .003
    const key = entityKey(feature)
    if (key === selectedKey) return .012
    // Source reconstructions can intentionally contain overlapping or even
    // duplicate extents. A tiny stable order prevents coplanar transparent
    // caps from z-fighting without suggesting a meaningful vertical hierarchy.
    const sourceOffset = featureDatasetId(feature) === 'cliopatria' ? .0026 : 0
    return .0052 + sourceOffset + prominence(feature) * .00135 + stableLayerRank(key) * .0000025
  }, [prominence, selectedKey])
  const polygonCapColor = useCallback((object: object) => {
    const feature = historicalFeature(object as RenderPolygon)
    if (!feature) return 'rgba(43, 63, 54, 0.96)'
    const importance = prominence(feature)
    const selected = entityKey(feature) === selectedKey
    const properties = sourceProperties(feature)
    const alternativeDetail = territorySourceMode === 'composite' && properties.renderRole === 'detail-alternative'
    const baseAlpha = selected ? .98 : alternativeDetail
      ? mode === 'earth' ? .035 + importance * .1 : .055 + importance * .14
      : mode === 'earth' ? .1 + importance * .52 : .18 + importance * .76
    const key = entityKey(feature)
    const color = showChanges ? changeColors[changeKinds?.get(key) || 'stable'] : entityColor(key)
    return rgba(color, baseAlpha)
  }, [changeKinds, mode, prominence, selectedKey, showChanges, territorySourceMode])
  const polygonSideColor = useCallback((object: object) => {
    const feature = historicalFeature(object as RenderPolygon)
    if (!feature) return ''
    const key = entityKey(feature)
    if (key !== selectedKey) return ''
    const color = showChanges ? changeColors[changeKinds?.get(key) || 'stable'] : entityColor(key)
    return rgba(color, .3)
  }, [changeKinds, selectedKey, showChanges])
  const polygonStrokeColor = useCallback((object: object) => {
    const feature = historicalFeature(object as RenderPolygon)
    if (!feature) return 'rgba(130, 159, 140, 0.2)'
    const importance = prominence(feature)
    if (territorySourceMode === 'composite' && sourceProperties(feature).renderRole === 'detail-alternative') {
      return `rgba(104, 204, 204, ${.3 + importance * .52})`
    }
    if (importance < (size.width < 620 ? .24 : .16)) return ''
    const alpha = importance > .78 ? .9 : .08 + importance * .34
    return importance > .78 ? `rgba(255, 239, 196, ${alpha})` : `rgba(255, 247, 220, ${alpha})`
  }, [prominence, size.width, territorySourceMode])
  const handlePolygonClick = useCallback((object: object) => {
    const polygon = object as RenderPolygon
    const feature = historicalFeature(polygon)
    if (feature && !isLand(polygon)) onSelect(feature)
    else onClearSelection()
  }, [onClearSelection, onSelect])
  const ringColor = useCallback((object: object) => (object as HistoricalEvent).id === selectedEvent?.id
    ? ['rgba(255,244,202,1)', 'rgba(255,210,123,0)']
    : ['rgba(255,210,123,.65)', 'rgba(255,210,123,0)'], [selectedEvent?.id])
  const ringMaxRadius = useCallback((object: object) => (object as HistoricalEvent).id === selectedEvent?.id ? 3.2 : 2.2, [selectedEvent?.id])
  const arcColor = useCallback((object: object) => {
    const route = (object as RouteSegment).route
    if (route.id === selectedRoute?.id) return '#fff1bd'
    return route.kind === 'trade' ? '#e1ae58' : route.kind === 'migration' ? '#61b59c' : '#79a8dc'
  }, [selectedRoute?.id])
  const arcStroke = useCallback((object: object) => (object as RouteSegment).route.id === selectedRoute?.id ? .72 : .34, [selectedRoute?.id])
  const handleArcClick = useCallback((object: object) => onRouteSelect?.((object as RouteSegment).route), [onRouteSelect])

  const handleActivate = useCallback(() => {
    clearFrameTransition()
    const currentView = globeRef.current?.pointOfView()
    if (currentView) onActivate?.(currentView)
  }, [clearFrameTransition, onActivate])
  const handleZoom = useCallback((nextView: GlobeViewpoint) => {
    clearFrameTransition()
    if (active && mountedRef.current) onViewChange?.(nextView)
  }, [active, clearFrameTransition, onViewChange])

  return (
    <div ref={containerRef} className="globe-stage" role="region" tabIndex={0} data-dialog-return onPointerDown={handleActivate} aria-label="Interactive historical globe. Drag to rotate, or use Explore history to browse territories with a keyboard.">
      <div className="globe-halo" aria-hidden="true" />
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeMaterial}
        globeImageUrl={mode === 'earth' ? `${import.meta.env.BASE_URL}textures/earth-blue-marble.jpg` : undefined}
        bumpImageUrl={mode === 'earth' ? `${import.meta.env.BASE_URL}textures/earth-topology.png` : undefined}
        showGraticules={mode === 'atlas'}
        showAtmosphere
        atmosphereColor={mode === 'earth' ? '#68afd0' : '#65bfd0'}
        atmosphereAltitude={mode === 'earth' ? .11 : .15}
        polygonsData={polygons}
        polygonGeoJsonGeometry={polygonGeometry}
        polygonAltitude={polygonAltitude}
        polygonCapColor={polygonCapColor}
        polygonSideColor={polygonSideColor}
        polygonStrokeColor={polygonStrokeColor}
        polygonCapCurvatureResolution={3}
        polygonsTransitionDuration={0}
        polygonLabel={polygonLabel}
        onPolygonClick={handlePolygonClick}
        ringsData={reducedMotion ? [] : events}
        ringLat="lat"
        ringLng="lng"
        ringColor={ringColor}
        ringMaxRadius={ringMaxRadius}
        ringPropagationSpeed={.7}
        ringRepeatPeriod={1800}
        arcsData={routeSegments}
        arcStartLat={arcStartLat}
        arcStartLng={arcStartLng}
        arcEndLat={arcEndLat}
        arcEndLng={arcEndLng}
        arcColor={arcColor}
        arcStroke={arcStroke}
        arcAltitudeAutoScale={.24}
        arcDashLength={.45}
        arcDashGap={.12}
        arcDashAnimateTime={reducedMotion ? 0 : 4200}
        arcLabel={arcTooltip}
        onArcClick={handleArcClick}
        htmlElementsData={htmlElements}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={htmlAltitude}
        htmlElement={renderHtmlLabel}
        htmlTransitionDuration={0}
        onGlobeClick={onClearSelection}
        onGlobeReady={handleReady}
        onZoom={handleZoom}
      />
      <canvas ref={transitionCanvasRef} className="globe-frame-transition" aria-hidden="true" />
      <div className="drag-hint" aria-hidden="true"><span className="mouse-glyph" /> Drag to rotate · Scroll to zoom</div>
    </div>
  )
}

export const GlobeView = memo(GlobeViewComponent)
