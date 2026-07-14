import { useEffect, useMemo, useRef, useState } from 'react'
import { geoArea, geoCentroid } from 'd3-geo'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { feature as topojsonFeature } from 'topojson-client'
import { AmbientLight, Color, DirectionalLight, MeshPhongMaterial } from 'three'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { getCivilizationProfile } from '../data/civilizations'
import { entityColor, entityKey, escapeHtml } from '../lib/entities'
import type { HistoricalEntityIndex, HistoricalEvent, HistoricalFeature } from '../types'

interface LandProperties { __layer: 'land' }
type LandFeature = Feature<Geometry, LandProperties>
type RenderPolygon = HistoricalFeature | LandFeature

interface GlobeViewProps {
  features: HistoricalFeature[]
  history: HistoricalEntityIndex[]
  selectedKey: string | null
  events: HistoricalEvent[]
  selectedEvent: HistoricalEvent | null
  mode: 'atlas' | 'earth'
  onSelect: (feature: HistoricalFeature) => void
  onEventSelect: (event: HistoricalEvent) => void
  onClearSelection: () => void
}

const rgba = (hex: string, alpha: number) => {
  const value = hex.replace('#', '')
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(value.slice(2, 4), 16)}, ${Number.parseInt(value.slice(4, 6), 16)}, ${alpha})`
}

const isLand = (polygon: RenderPolygon): polygon is LandFeature =>
  Boolean(polygon.properties && '__layer' in polygon.properties && polygon.properties.__layer === 'land')

const precisionLabel = (precision: number | null) => precision === 3 ? 'Documented boundary' : precision === 2 ? 'Moderate confidence' : 'Approximate extent'

export function GlobeView({ features, history, selectedKey, events, selectedEvent, mode, onSelect, onEventSelect, onClearSelection }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [size, setSize] = useState({ width: 900, height: 700 })
  const [land, setLand] = useState<LandFeature[]>([])
  const [ready, setReady] = useState(false)

  const globeMaterial = useMemo(() => new MeshPhongMaterial(mode === 'earth' ? {
    color: new Color('#ffffff'), shininess: 12, specular: new Color('#63838e'),
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
    fetch(`${import.meta.env.BASE_URL}data/land-110m.json`)
      .then((response) => response.json() as Promise<Topology<{ land: GeometryCollection }>>)
      .then((topology) => {
        const geography = topojsonFeature(topology, topology.objects.land) as unknown as Feature<Geometry> | FeatureCollection<Geometry>
        const landFeatures = geography.type === 'FeatureCollection' ? geography.features : [geography]
        setLand(landFeatures.map((item) => ({ ...item, properties: { __layer: 'land' } })))
      }).catch(() => setLand([]))
  }, [])

  const selectedFeatures = useMemo(() => features.filter((item) => entityKey(item) === selectedKey), [features, selectedKey])
  const selectedCenter = useMemo(() => {
    if (selectedFeatures.length === 0) return null
    const collection: FeatureCollection = { type: 'FeatureCollection', features: selectedFeatures }
    const [lng, lat] = geoCentroid(collection)
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  }, [selectedFeatures])

  useEffect(() => {
    if (!ready) return
    const focus = selectedEvent || selectedCenter
    if (focus) globeRef.current?.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: 1.65 }, 900)
  }, [ready, selectedCenter, selectedEvent])

  const polygons = useMemo<RenderPolygon[]>(() => mode === 'atlas' ? [...land, ...features] : features, [features, land, mode])
  const historyByKey = useMemo(() => new Map(history.map((item) => [item.key, item])), [history])
  const prominence = (feature: HistoricalFeature) => {
    const key = entityKey(feature)
    const curated = getCivilizationProfile(key)?.importance
    if (curated !== undefined) return curated
    const area = historyByKey.get(key)?.maxArea || geoArea(feature)
    const cultural = /culture|hunter|burial|pottery|complex|tradition/i.test(key)
    return Math.max(.22, Math.min(.72, .28 + Math.log1p(area * 10) * .16)) * (cultural ? .72 : 1)
  }

  const handleReady = () => {
    setReady(true)
    const globe = globeRef.current
    if (!globe) return
    globe.pointOfView({ lat: 31, lng: 28, altitude: 1.85 }, 0)
    const controls = globe.controls()
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = .08
    controls.rotateSpeed = .55
    globe.lights([new AmbientLight('#b5cfd4', 1.45), new DirectionalLight('#fff0ce', mode === 'earth' ? 2.1 : 2.8)])
    const directional = globe.lights()[1] as DirectionalLight
    directional.position.set(-180, 120, 160)
  }

  const polygonLabel = (object: object) => {
    const polygon = object as RenderPolygon
    if (isLand(polygon)) return ''
    const key = entityKey(polygon)
    const region = polygon.properties.NAME || 'Unnamed territory'
    const regional = region !== key ? `<div>Region: ${escapeHtml(region)}</div>` : ''
    return `<div class="globe-tooltip"><strong>${escapeHtml(key)}</strong>${regional}<span>${precisionLabel(polygon.properties.BORDERPRECISION)}</span></div>`
  }

  const htmlLabel = () => {
    if (!selectedKey || !selectedCenter) return document.createElement('span')
    const element = document.createElement('div')
    element.className = 'globe-entity-label'
    element.textContent = getCivilizationProfile(selectedKey)?.displayName || selectedKey
    element.style.setProperty('--entity-color', entityColor(selectedKey))
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
        atmosphereColor={mode === 'earth' ? '#87c8ed' : '#65bfd0'}
        atmosphereAltitude={.15}
        polygonsData={polygons}
        polygonGeoJsonGeometry={(object) => (object as RenderPolygon).geometry as never}
        polygonAltitude={(object) => {
          const polygon = object as RenderPolygon
          if (isLand(polygon)) return .004
          const importance = prominence(polygon)
          return entityKey(polygon) === selectedKey ? .024 : .008 + importance * .006
        }}
        polygonCapColor={(object) => {
          const polygon = object as RenderPolygon
          if (isLand(polygon)) return 'rgba(43, 63, 54, 0.96)'
          const selected = entityKey(polygon) === selectedKey
          const importance = prominence(polygon)
          const alpha = selected ? .96 : mode === 'earth' ? .28 + importance * .3 : .48 + importance * .38
          return rgba(entityColor(entityKey(polygon)), alpha)
        }}
        polygonSideColor={(object) => isLand(object as RenderPolygon) ? 'rgba(17, 31, 30, 0.8)' : rgba(entityColor(entityKey(object as HistoricalFeature)), .34)}
        polygonStrokeColor={(object) => {
          const polygon = object as RenderPolygon
          if (isLand(polygon)) return 'rgba(130, 159, 140, 0.2)'
          if (entityKey(polygon) === selectedKey) return '#fff8df'
          return `rgba(255, 247, 220, ${.14 + (polygon.properties.BORDERPRECISION || 1) * .1})`
        }}
        polygonCapCurvatureResolution={3}
        polygonsTransitionDuration={900}
        polygonLabel={polygonLabel}
        onPolygonClick={(object) => isLand(object as RenderPolygon) ? onClearSelection() : onSelect(object as HistoricalFeature)}
        pointsData={events}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => '#ffd27b'}
        pointAltitude={(object) => (object as HistoricalEvent).id === selectedEvent?.id ? .075 : .045}
        pointRadius={(object) => (object as HistoricalEvent).id === selectedEvent?.id ? .42 : .29}
        pointLabel={(object) => `<div class="globe-tooltip event-tooltip"><strong>${escapeHtml((object as HistoricalEvent).title)}</strong><span>${Math.abs((object as HistoricalEvent).year)} ${(object as HistoricalEvent).year < 0 ? 'BCE' : 'CE'} · historical event</span></div>`}
        onPointClick={(object) => onEventSelect(object as HistoricalEvent)}
        ringsData={events}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => ['rgba(255,210,123,.75)', 'rgba(255,210,123,0)']}
        ringMaxRadius={2.2}
        ringPropagationSpeed={.7}
        ringRepeatPeriod={1800}
        htmlElementsData={selectedCenter ? [{ ...selectedCenter }] : []}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={.04}
        htmlElement={htmlLabel}
        onGlobeClick={onClearSelection}
        onGlobeReady={handleReady}
      />
      <div className="drag-hint" aria-hidden="true"><span className="mouse-glyph" /> Drag to rotate · Scroll to zoom</div>
    </div>
  )
}
