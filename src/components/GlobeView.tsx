import { useEffect, useMemo, useRef, useState } from 'react'
import { geoArea, geoCentroid } from 'd3-geo'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { feature as topojsonFeature } from 'topojson-client'
import { AmbientLight, Color, DirectionalLight, MeshPhongMaterial } from 'three'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { getCivilizationProfile } from '../data/civilizations'
import { changeColors, changeLabels } from '../lib/changes'
import { entityColor, entityKey, escapeHtml } from '../lib/entities'
import type { ChangeKind, GlobeViewpoint, HistoricalEntityIndex, HistoricalEvent, HistoricalFeature, HistoricalPoint, HistoricalRoute } from '../types'

interface LandProperties { __layer: 'land' }
type LandFeature = Feature<Geometry, LandProperties>

interface RenderHistoricalFeature {
  __layer: 'history'
  feature: HistoricalFeature
  blendWeight: number
  phase: 'current' | 'next'
}

interface HtmlLabel {
  kind: 'entity' | 'event' | 'point'
  lat: number
  lng: number
  text: string
  color: string
  year?: number
}

type RenderPolygon = LandFeature | RenderHistoricalFeature

interface GlobeViewProps {
  features: HistoricalFeature[]
  nextFeatures: HistoricalFeature[]
  transitionProgress: number
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
  initialView?: GlobeViewpoint
  onViewChange?: (view: GlobeViewpoint) => void
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

const isLand = (polygon: RenderPolygon): polygon is LandFeature =>
  'properties' in polygon && polygon.properties?.__layer === 'land'
const historicalFeature = (polygon: RenderPolygon) => isLand(polygon) ? null : polygon.feature
const blendWeight = (polygon: RenderPolygon) => isLand(polygon) ? 1 : polygon.blendWeight
const precisionLabel = (precision: number | null) => precision === 3 ? 'Well documented' : precision === 2 ? 'Moderately certain' : 'Approximate extent'

let landRequest: Promise<LandFeature[]> | null = null
const loadLand = () => {
  if (landRequest) return landRequest
  landRequest = fetch(`${import.meta.env.BASE_URL}data/land-110m.json`)
    .then((response) => response.json() as Promise<Topology<{ land: GeometryCollection }>>)
    .then((topology) => {
      const geography = topojsonFeature(topology, topology.objects.land) as unknown as Feature<Geometry> | FeatureCollection<Geometry>
      const features = geography.type === 'FeatureCollection' ? geography.features : [geography]
      return features.map((item) => ({ ...item, properties: { __layer: 'land' as const } }))
    })
  return landRequest
}

export function GlobeView({
  features, nextFeatures, transitionProgress, history, selectedKey, events, points = [], routes = [], selectedEvent,
  selectedPoint = null, selectedRoute = null, mode, showChanges = false, changeKinds, initialView, onViewChange,
  onSelect, onEventSelect, onPointSelect, onRouteSelect, onClearSelection,
}: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [size, setSize] = useState({ width: 900, height: 700 })
  const [land, setLand] = useState<LandFeature[]>([])
  const [ready, setReady] = useState(false)
  const initialViewRef = useRef(initialView)

  const globeMaterial = useMemo(() => new MeshPhongMaterial(mode === 'earth' ? {
    color: new Color('#ffffff'),
    emissive: new Color('#56666c'),
    emissiveIntensity: .18,
    shininess: 5,
    specular: new Color('#a7d3df'),
  } : {
    color: new Color('#071a23'), emissive: new Color('#031017'), emissiveIntensity: .38, shininess: 18, specular: new Color('#2b7888'),
  }), [mode])
  useEffect(() => () => globeMaterial.dispose(), [globeMaterial])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    loadLand().then(setLand).catch(() => setLand([]))
  }, [])

  const renderFeatures = useMemo<RenderHistoricalFeature[]>(() => {
    const currentWeight = 1 - transitionProgress
    const layers: RenderHistoricalFeature[] = []
    if (currentWeight > .015) layers.push(...features.map((feature) => ({ __layer: 'history' as const, feature, blendWeight: currentWeight, phase: 'current' as const })))
    if (transitionProgress > .015) layers.push(...nextFeatures.map((feature) => ({ __layer: 'history' as const, feature, blendWeight: transitionProgress, phase: 'next' as const })))
    return layers
  }, [features, nextFeatures, transitionProgress])

  const focusFeatures = transitionProgress >= .5 && nextFeatures.length > 0 ? nextFeatures : features
  const selectedFeatures = useMemo(() => focusFeatures.filter((item) => entityKey(item) === selectedKey), [focusFeatures, selectedKey])
  const selectedCenter = useMemo(() => {
    if (selectedFeatures.length === 0) return null
    const collection: FeatureCollection = { type: 'FeatureCollection', features: selectedFeatures }
    const [lng, lat] = geoCentroid(collection)
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  }, [selectedFeatures])

  useEffect(() => {
    if (!ready) return
    const focus = selectedEvent || selectedPoint || selectedCenter
    if (focus) globeRef.current?.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: 1.65 }, 900)
  }, [ready, selectedCenter, selectedEvent, selectedPoint])

  useEffect(() => {
    if (!ready) return
    const globe = globeRef.current
    if (!globe) return
    const ambient = new AmbientLight(mode === 'earth' ? '#ffffff' : '#9bc1c8', mode === 'earth' ? 3.4 : 1.35)
    const directional = new DirectionalLight(mode === 'earth' ? '#fff8e8' : '#fff0ce', mode === 'earth' ? 2.6 : 2.8)
    directional.position.set(-180, 120, 160)
    globe.lights([ambient, directional])
  }, [mode, ready])

  const polygons = useMemo<RenderPolygon[]>(() => mode === 'atlas' ? [...land, ...renderFeatures] : renderFeatures, [land, mode, renderFeatures])
  const historyByKey = useMemo(() => new Map(history.map((item) => [item.key, item])), [history])
  const globePoints = useMemo<GlobePoint[]>(() => [
    ...events.map((event) => ({ ...event, pointType: 'event' as const })),
    ...points.map((point) => ({ ...point, pointType: 'place' as const })),
  ], [events, points])
  const routeSegments = useMemo<RouteSegment[]>(() => routes.flatMap((route) => route.coordinates.slice(0, -1).map((start, index) => ({ route, start, end: route.coordinates[index + 1] }))), [routes])
  const prominence = (feature: HistoricalFeature) => {
    const key = entityKey(feature)
    if (key === selectedKey) return 1
    const curated = getCivilizationProfile(key)?.importance
    if (curated !== undefined) return .78 + curated * .22
    const area = historyByKey.get(key)?.maxArea || geoArea(feature)
    const cultural = /culture|hunter|burial|pottery|complex|tradition/i.test(key)
    const extentScore = Math.min(1, Math.sqrt(area / .12))
    return Math.max(.08, (.1 + extentScore * .4) * (cultural ? .48 : 1))
  }
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

  const handleReady = () => {
    setReady(true)
    const globe = globeRef.current
    if (!globe) return
    globe.pointOfView(initialViewRef.current || { lat: 31, lng: 28, altitude: 1.85 }, 0)
    const controls = globe.controls()
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = .08
    controls.rotateSpeed = .55
  }

  const polygonLabel = (object: object) => {
    const polygon = object as RenderPolygon
    const feature = historicalFeature(polygon)
    if (!feature || (!isLand(polygon) && polygon.blendWeight < .2)) return ''
    const key = entityKey(feature)
    const region = feature.properties.NAME || 'Unnamed territory'
    const regional = region !== key ? `<div>Region: ${escapeHtml(region)}</div>` : ''
    const change = showChanges ? changeKinds?.get(key) : undefined
    const changeCopy = change ? ` · ${changeLabels[change]}` : ''
    return `<div class="globe-tooltip"><strong>${escapeHtml(key)}</strong>${regional}<span>${precisionLabel(feature.properties.BORDERPRECISION)}${changeCopy}</span></div>`
  }

  const htmlElement = (object: object) => {
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

  return (
    <div ref={containerRef} className="globe-stage" aria-label="Interactive historical globe">
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
        polygonGeoJsonGeometry={(object) => (historicalFeature(object as RenderPolygon)?.geometry || (object as LandFeature).geometry) as never}
        polygonAltitude={(object) => {
          const polygon = object as RenderPolygon
          const feature = historicalFeature(polygon)
          if (!feature) return .004
          const importance = prominence(feature)
          const phaseLift = !isLand(polygon) && polygon.phase === 'next' ? .0012 : 0
          return (entityKey(feature) === selectedKey ? .035 : .004 + importance * importance * .019) + phaseLift
        }}
        polygonCapColor={(object) => {
          const polygon = object as RenderPolygon
          const feature = historicalFeature(polygon)
          if (!feature) return 'rgba(43, 63, 54, 0.96)'
          const importance = prominence(feature)
          const selected = entityKey(feature) === selectedKey
          const baseAlpha = selected ? .98 : mode === 'earth' ? .1 + importance * .52 : .18 + importance * .76
          const key = entityKey(feature)
          const color = showChanges ? changeColors[changeKinds?.get(key) || 'stable'] : entityColor(key)
          return rgba(color, baseAlpha * blendWeight(polygon))
        }}
        polygonSideColor={(object) => {
          const polygon = object as RenderPolygon
          const feature = historicalFeature(polygon)
          if (!feature) return 'rgba(17, 31, 30, 0.8)'
          const key = entityKey(feature)
          const color = showChanges ? changeColors[changeKinds?.get(key) || 'stable'] : entityColor(key)
          return rgba(color, (.08 + prominence(feature) * .42) * blendWeight(polygon))
        }}
        polygonStrokeColor={(object) => {
          const polygon = object as RenderPolygon
          const feature = historicalFeature(polygon)
          if (!feature) return 'rgba(130, 159, 140, 0.2)'
          const importance = prominence(feature)
          const alpha = (importance > .78 ? .9 : .08 + importance * .34) * blendWeight(polygon)
          return importance > .78 ? `rgba(255, 239, 196, ${alpha})` : `rgba(255, 247, 220, ${alpha})`
        }}
        polygonCapCurvatureResolution={3}
        polygonsTransitionDuration={700}
        polygonLabel={polygonLabel}
        onPolygonClick={(object) => {
          const feature = historicalFeature(object as RenderPolygon)
          const polygon = object as RenderPolygon
          if (feature && !isLand(polygon) && polygon.blendWeight >= .15) onSelect(feature)
          else onClearSelection()
        }}
        pointsData={globePoints}
        pointLat="lat"
        pointLng="lng"
        pointColor={(object) => {
          const point = object as GlobePoint
          if (point.pointType === 'event') return point.id === selectedEvent?.id ? '#fff4ca' : '#ffd27b'
          if (point.id === selectedPoint?.id) return '#d9ffff'
          return point.kind === 'capital' ? '#ef9d63' : point.kind === 'site' ? '#c68ade' : '#72c6cf'
        }}
        pointAltitude={(object) => (object as GlobePoint).id === (selectedEvent?.id || selectedPoint?.id) ? .09 : .045}
        pointRadius={(object) => (object as GlobePoint).id === (selectedEvent?.id || selectedPoint?.id) ? .55 : (object as GlobePoint).pointType === 'event' ? .29 : .22}
        pointLabel={(object) => {
          const point = object as GlobePoint
          const title = point.pointType === 'event' ? point.title : point.name
          const detail = point.pointType === 'event' ? `${Math.abs(point.year)} ${point.year < 0 ? 'BCE' : 'CE'} · historical moment` : `${point.kind} · ${Math.abs(point.startYear)} ${point.startYear < 0 ? 'BCE' : 'CE'}`
          return `<div class="globe-tooltip event-tooltip"><strong>${escapeHtml(title)}</strong><span>${detail}</span></div>`
        }}
        onPointClick={(object) => {
          const point = object as GlobePoint
          if (point.pointType === 'event') onEventSelect(point)
          else onPointSelect?.(point)
        }}
        ringsData={events}
        ringLat="lat"
        ringLng="lng"
        ringColor={(object: object) => (object as HistoricalEvent).id === selectedEvent?.id
          ? ['rgba(255,244,202,1)', 'rgba(255,210,123,0)']
          : ['rgba(255,210,123,.65)', 'rgba(255,210,123,0)']}
        ringMaxRadius={(object: object) => (object as HistoricalEvent).id === selectedEvent?.id ? 3.2 : 2.2}
        ringPropagationSpeed={.7}
        ringRepeatPeriod={1800}
        arcsData={routeSegments}
        arcStartLat={(object) => (object as RouteSegment).start.lat}
        arcStartLng={(object) => (object as RouteSegment).start.lng}
        arcEndLat={(object) => (object as RouteSegment).end.lat}
        arcEndLng={(object) => (object as RouteSegment).end.lng}
        arcColor={(object: object) => {
          const route = (object as RouteSegment).route
          if (route.id === selectedRoute?.id) return '#fff1bd'
          return route.kind === 'trade' ? '#e1ae58' : route.kind === 'migration' ? '#61b59c' : '#79a8dc'
        }}
        arcStroke={(object) => (object as RouteSegment).route.id === selectedRoute?.id ? .72 : .34}
        arcAltitudeAutoScale={.24}
        arcDashLength={.45}
        arcDashGap={.12}
        arcDashAnimateTime={4200}
        arcLabel={(object) => {
          const route = (object as RouteSegment).route
          return `<div class="globe-tooltip"><strong>${escapeHtml(route.name)}</strong><span>${route.kind} route · schematic</span></div>`
        }}
        onArcClick={(object) => onRouteSelect?.((object as RouteSegment).route)}
        htmlElementsData={htmlLabels}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={(object) => (object as HtmlLabel).kind === 'event' ? .105 : (object as HtmlLabel).kind === 'point' ? .075 : .04}
        htmlElement={htmlElement}
        onGlobeClick={onClearSelection}
        onGlobeReady={handleReady}
        onZoom={(view: GlobeViewpoint) => onViewChange?.(view)}
      />
      <div className="drag-hint" aria-hidden="true"><span className="mouse-glyph" /> Drag to rotate · Scroll to zoom</div>
    </div>
  )
}
