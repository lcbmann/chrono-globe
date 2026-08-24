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
import { defaultGlobeViewpoint } from '../lib/viewpoint'
import type { ChangeKind, GlobeViewpoint, HistoricalEntityIndex, HistoricalEvent, HistoricalFeature, HistoricalPoint, HistoricalRoute } from '../types'

interface LandProperties { __layer: 'land' }
type LandFeature = Feature<Geometry, LandProperties>

interface HtmlLabel {
  kind: 'entity' | 'event' | 'point'
  lat: number
  lng: number
  text: string
  color: string
  year?: number
}

type RenderPolygon = LandFeature | HistoricalFeature
const compactRendererMedia = '(max-width: 680px), (max-width: 900px) and (max-height: 500px)'

interface GlobeViewProps {
  features: HistoricalFeature[]
  active?: boolean
  focusSelection?: boolean
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
  showChanges?: boolean
  changeKinds?: Map<string, ChangeKind>
  initialViewRef?: RefObject<GlobeViewpoint>
  onViewChange?: (view: GlobeViewpoint) => void
  onActivate?: (view: GlobeViewpoint) => void
  onFrameReady?: (frameId: string) => void
  onSelect: (feature: HistoricalFeature) => void
  onEventSelect: (event: HistoricalEvent) => void
  onPointSelect?: (point: HistoricalPoint) => void
  onRouteSelect?: (route: HistoricalRoute) => void
  onClearSelection: () => void
}

type GlobePoint = ({ pointType: 'event' } & HistoricalEvent) | ({ pointType: 'place' } & HistoricalPoint)
interface RouteSegment { route: HistoricalRoute; start: { lat: number; lng: number }; end: { lat: number; lng: number } }

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
const pointTooltip = (object: object) => {
  const point = object as GlobePoint
  const title = point.pointType === 'event' ? point.title : point.name
  const detail = point.pointType === 'event'
    ? `${Math.abs(point.year)} ${point.year < 0 ? 'BCE' : 'CE'} · historical moment`
    : `${point.kind} · ${Math.abs(point.startYear)} ${point.startYear < 0 ? 'BCE' : 'CE'}`
  return `<div class="globe-tooltip event-tooltip"><strong>${escapeHtml(title)}</strong><span>${detail}</span></div>`
}
const arcStartLat = (object: object) => (object as RouteSegment).start.lat
const arcStartLng = (object: object) => (object as RouteSegment).start.lng
const arcEndLat = (object: object) => (object as RouteSegment).end.lat
const arcEndLng = (object: object) => (object as RouteSegment).end.lng
const arcTooltip = (object: object) => {
  const route = (object as RouteSegment).route
  return `<div class="globe-tooltip"><strong>${escapeHtml(route.name)}</strong><span>${route.kind} route · schematic</span></div>`
}
const htmlAltitude = (object: object) => (object as HtmlLabel).kind === 'event' ? .105 : (object as HtmlLabel).kind === 'point' ? .075 : .04
const renderHtmlLabel = (object: object) => {
  const label = object as HtmlLabel
  const element = document.createElement('div')
  element.className = label.kind === 'event' ? 'globe-event-label' : label.kind === 'point' ? 'globe-point-label' : 'globe-entity-label'
  element.style.setProperty('--entity-color', label.color)
  if (label.kind === 'event' || label.kind === 'point') {
    const marker = document.createElement('span')
    marker.textContent = label.kind === 'event' ? 'Historical moment' : 'Historical place'
    const title = document.createElement('strong')
    title.textContent = label.text
    element.append(marker, title)
  } else element.textContent = label.text
  return element
}

function GlobeViewComponent({
  features, active = true, focusSelection = true, frameId, history, selectedKey, events, points = [], routes = [], selectedEvent,
  selectedPoint = null, selectedRoute = null, mode, showChanges = false, changeKinds, initialViewRef, onViewChange,
  onActivate, onFrameReady, onSelect, onEventSelect, onPointSelect, onRouteSelect, onClearSelection,
}: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const mountedRef = useRef(false)
  const readyRequestedRef = useRef(false)
  const readyInitializedRef = useRef(false)
  const readyFrameRef = useRef<number | null>(null)
  const activeRef = useRef(active)
  activeRef.current = active
  const [size, setSize] = useState({ width: 900, height: 700 })
  const [land, setLand] = useState<LandFeature[]>([])
  const [ready, setReady] = useState(false)
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
    emissive: new Color('#56666c'),
    emissiveIntensity: .18,
    shininess: 5,
    specular: new Color('#a7d3df'),
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

  const selectedFeatures = useMemo(() => features.filter((item) => entityKey(item) === selectedKey), [features, selectedKey])
  const selectedCenter = useMemo(() => {
    if (selectedFeatures.length === 0) return null
    const collection: FeatureCollection = { type: 'FeatureCollection', features: selectedFeatures }
    const [lng, lat] = geoCentroid(collection)
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  }, [selectedFeatures])

  useEffect(() => {
    if (!ready || !focusSelection) return
    const focus = selectedEvent || selectedPoint || selectedCenter
    if (focus) globeRef.current?.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: 1.65 }, reducedMotion ? 0 : 900)
  }, [focusSelection, ready, reducedMotion, selectedCenter, selectedEvent, selectedPoint])

  useEffect(() => {
    if (!ready) return
    const globe = globeRef.current
    if (!globe) return
    const ambient = new AmbientLight(mode === 'earth' ? '#ffffff' : '#9bc1c8', mode === 'earth' ? 3.4 : 1.35)
    const directional = new DirectionalLight(mode === 'earth' ? '#fff8e8' : '#fff0ce', mode === 'earth' ? 2.6 : 2.8)
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
    if (!ready || !frameId || !onFrameReady) return
    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => onFrameReady(frameId))
    })
    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) window.cancelAnimationFrame(secondFrame)
    }
  }, [features, frameId, onFrameReady, ready])

  const orderedFeatures = useMemo(() => [...features].sort((left, right) => {
    const keyOrder = entityKey(left).localeCompare(entityKey(right))
    return keyOrder || (left.properties.NAME || '').localeCompare(right.properties.NAME || '')
  }), [features])
  const polygons = useMemo<RenderPolygon[]>(() => mode === 'atlas' ? [...land, ...orderedFeatures] : orderedFeatures, [land, mode, orderedFeatures])
  const historyByKey = useMemo(() => new Map(history.map((item) => [item.key, item])), [history])
  const globePoints = useMemo<GlobePoint[]>(() => [
    ...events.map((event) => ({ ...event, pointType: 'event' as const })),
    ...points.map((point) => ({ ...point, pointType: 'place' as const })),
  ], [events, points])
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
    if (selectedEvent) return [{
      kind: 'event', lat: selectedEvent.lat, lng: selectedEvent.lng, text: selectedEvent.title,
      color: '#ffd27b', year: selectedEvent.year,
    }]
    if (selectedPoint) return [{ kind: 'point', lat: selectedPoint.lat, lng: selectedPoint.lng, text: selectedPoint.name, color: '#8fd1d5' }]
    if (!selectedKey || !selectedCenter) return []
    return [{
      kind: 'entity', ...selectedCenter,
      text: getCivilizationProfile(selectedKey)?.displayName || selectedKey,
      color: entityColor(selectedKey),
    }]
  }, [selectedCenter, selectedEvent, selectedKey, selectedPoint])

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
    return `<div class="globe-tooltip"><strong>${escapeHtml(key)}</strong>${regional}<span>${precisionLabel(feature.properties.BORDERPRECISION)}${changeCopy}</span></div>`
  }, [changeKinds, showChanges])

  const polygonAltitude = useCallback((object: object) => {
    const feature = historicalFeature(object as RenderPolygon)
    if (!feature) return .003
    const key = entityKey(feature)
    if (key === selectedKey) return .012
    // Source reconstructions can intentionally contain overlapping or even
    // duplicate extents. A tiny stable order prevents coplanar transparent
    // caps from z-fighting without suggesting a meaningful vertical hierarchy.
    return .0052 + prominence(feature) * .00135 + stableLayerRank(key) * .0000025
  }, [prominence, selectedKey])
  const polygonCapColor = useCallback((object: object) => {
    const feature = historicalFeature(object as RenderPolygon)
    if (!feature) return 'rgba(43, 63, 54, 0.96)'
    const importance = prominence(feature)
    const selected = entityKey(feature) === selectedKey
    const baseAlpha = selected ? .98 : mode === 'earth' ? .1 + importance * .52 : .18 + importance * .76
    const key = entityKey(feature)
    const color = showChanges ? changeColors[changeKinds?.get(key) || 'stable'] : entityColor(key)
    return rgba(color, baseAlpha)
  }, [changeKinds, mode, prominence, selectedKey, showChanges])
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
    if (importance < (size.width < 620 ? .24 : .16)) return ''
    const alpha = importance > .78 ? .9 : .08 + importance * .34
    return importance > .78 ? `rgba(255, 239, 196, ${alpha})` : `rgba(255, 247, 220, ${alpha})`
  }, [prominence, size.width])
  const handlePolygonClick = useCallback((object: object) => {
    const polygon = object as RenderPolygon
    const feature = historicalFeature(polygon)
    if (feature && !isLand(polygon)) onSelect(feature)
    else onClearSelection()
  }, [onClearSelection, onSelect])
  const selectedMarkerId = selectedEvent?.id || selectedPoint?.id
  const pointColor = useCallback((object: object) => {
    const point = object as GlobePoint
    if (point.pointType === 'event') return point.id === selectedEvent?.id ? '#fff4ca' : '#ffd27b'
    if (point.id === selectedPoint?.id) return '#d9ffff'
    return point.kind === 'capital' ? '#ef9d63' : point.kind === 'site' ? '#c68ade' : '#72c6cf'
  }, [selectedEvent?.id, selectedPoint?.id])
  const pointAltitude = useCallback((object: object) => (object as GlobePoint).id === selectedMarkerId ? .09 : .045, [selectedMarkerId])
  const pointRadius = useCallback((object: object) => (object as GlobePoint).id === selectedMarkerId ? .55 : (object as GlobePoint).pointType === 'event' ? .29 : .22, [selectedMarkerId])
  const handlePointClick = useCallback((object: object) => {
    const point = object as GlobePoint
    if (point.pointType === 'event') onEventSelect(point)
    else onPointSelect?.(point)
  }, [onEventSelect, onPointSelect])
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
    const currentView = globeRef.current?.pointOfView()
    if (currentView) onActivate?.(currentView)
  }, [onActivate])
  const handleZoom = useCallback((nextView: GlobeViewpoint) => {
    if (active && mountedRef.current) onViewChange?.(nextView)
  }, [active, onViewChange])

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
        atmosphereColor={mode === 'earth' ? '#a9ddfa' : '#65bfd0'}
        atmosphereAltitude={.15}
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
        pointsData={globePoints}
        pointLat="lat"
        pointLng="lng"
        pointColor={pointColor}
        pointAltitude={pointAltitude}
        pointRadius={pointRadius}
        pointLabel={pointTooltip}
        onPointClick={handlePointClick}
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
        htmlElementsData={htmlLabels}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={htmlAltitude}
        htmlElement={renderHtmlLabel}
        onGlobeClick={onClearSelection}
        onGlobeReady={handleReady}
        onZoom={handleZoom}
      />
      <div className="drag-hint" aria-hidden="true"><span className="mouse-glyph" /> Drag to rotate · Scroll to zoom</div>
    </div>
  )
}

export const GlobeView = memo(GlobeViewComponent)
