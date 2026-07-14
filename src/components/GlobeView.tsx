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

interface RenderHistoricalFeature {
  __layer: 'history'
  feature: HistoricalFeature
}

interface HtmlLabel {
  kind: 'entity' | 'event'
  lat: number
  lng: number
  text: string
  color: string
  year?: number
}

type RenderPolygon = LandFeature | RenderHistoricalFeature

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
  'properties' in polygon && polygon.properties?.__layer === 'land'
const historicalFeature = (polygon: RenderPolygon) => isLand(polygon) ? null : polygon.feature
const precisionLabel = (precision: number | null) => precision === 3 ? 'Well documented' : precision === 2 ? 'Moderately certain' : 'Approximate extent'

export function GlobeView({ features, history, selectedKey, events, selectedEvent, mode, onSelect, onEventSelect, onClearSelection }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const stableFeaturesRef = useRef<HistoricalFeature[]>([])
  const [size, setSize] = useState({ width: 900, height: 700 })
  const [land, setLand] = useState<LandFeature[]>([])
  const [ready, setReady] = useState(false)
  const [renderFeatures, setRenderFeatures] = useState<RenderHistoricalFeature[]>([])
  const [transitionImage, setTransitionImage] = useState<string | null>(null)
  const [transitionVisible, setTransitionVisible] = useState(false)

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
    fetch(`${import.meta.env.BASE_URL}data/land-110m.json`)
      .then((response) => response.json() as Promise<Topology<{ land: GeometryCollection }>>)
      .then((topology) => {
        const geography = topojsonFeature(topology, topology.objects.land) as unknown as Feature<Geometry> | FeatureCollection<Geometry>
        const landFeatures = geography.type === 'FeatureCollection' ? geography.features : [geography]
        setLand(landFeatures.map((item) => ({ ...item, properties: { __layer: 'land' } })))
      }).catch(() => setLand([]))
  }, [])

  useEffect(() => {
    if (features === stableFeaturesRef.current) return
    const previous = stableFeaturesRef.current
    stableFeaturesRef.current = features
    let outgoingImage: string | null = null
    if (previous.length > 0 && features.length > 0) {
      try {
        outgoingImage = containerRef.current?.querySelector('canvas')?.toDataURL('image/png') || null
      } catch {
        outgoingImage = null
      }
    }
    setRenderFeatures(features.map((feature) => ({ __layer: 'history', feature })))
    if (!outgoingImage) return
    setTransitionImage(outgoingImage)
    setTransitionVisible(true)
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setTransitionVisible(false))
    })
    const timer = window.setTimeout(() => setTransitionImage(null), 1500)
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      window.clearTimeout(timer)
    }
  }, [features])

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
    if (!selectedKey || !selectedCenter) return []
    return [{
      kind: 'entity', ...selectedCenter,
      text: getCivilizationProfile(selectedKey)?.displayName || selectedKey,
      color: entityColor(selectedKey),
    }]
  }, [selectedCenter, selectedEvent, selectedKey])

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
  }

  const polygonLabel = (object: object) => {
    const polygon = object as RenderPolygon
    const feature = historicalFeature(polygon)
    if (!feature) return ''
    const key = entityKey(feature)
    const region = feature.properties.NAME || 'Unnamed territory'
    const regional = region !== key ? `<div>Region: ${escapeHtml(region)}</div>` : ''
    return `<div class="globe-tooltip"><strong>${escapeHtml(key)}</strong>${regional}<span>${precisionLabel(feature.properties.BORDERPRECISION)}</span></div>`
  }

  const htmlElement = (object: object) => {
    const label = object as HtmlLabel
    const element = document.createElement('div')
    element.className = label.kind === 'event' ? 'globe-event-label' : 'globe-entity-label'
    element.style.setProperty('--entity-color', label.color)
    if (label.kind === 'event') {
      const marker = document.createElement('span')
      marker.textContent = 'Historical moment'
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
          return entityKey(feature) === selectedKey ? .035 : .004 + importance * importance * .019
        }}
        polygonCapColor={(object) => {
          const polygon = object as RenderPolygon
          const feature = historicalFeature(polygon)
          if (!feature) return 'rgba(43, 63, 54, 0.96)'
          const importance = prominence(feature)
          const selected = entityKey(feature) === selectedKey
          const baseAlpha = selected ? .98 : mode === 'earth' ? .1 + importance * .52 : .18 + importance * .76
          return rgba(entityColor(entityKey(feature)), baseAlpha)
        }}
        polygonSideColor={(object) => {
          const polygon = object as RenderPolygon
          const feature = historicalFeature(polygon)
          if (!feature) return 'rgba(17, 31, 30, 0.8)'
          return rgba(entityColor(entityKey(feature)), .08 + prominence(feature) * .42)
        }}
        polygonStrokeColor={(object) => {
          const polygon = object as RenderPolygon
          const feature = historicalFeature(polygon)
          if (!feature) return 'rgba(130, 159, 140, 0.2)'
          const importance = prominence(feature)
          const alpha = importance > .78 ? .9 : .08 + importance * .34
          return importance > .78 ? `rgba(255, 239, 196, ${alpha})` : `rgba(255, 247, 220, ${alpha})`
        }}
        polygonCapCurvatureResolution={3}
        polygonsTransitionDuration={0}
        polygonLabel={polygonLabel}
        onPolygonClick={(object) => {
          const feature = historicalFeature(object as RenderPolygon)
          if (feature) onSelect(feature)
          else onClearSelection()
        }}
        pointsData={events}
        pointLat="lat"
        pointLng="lng"
        pointColor={(object) => (object as HistoricalEvent).id === selectedEvent?.id ? '#fff4ca' : '#ffd27b'}
        pointAltitude={(object) => (object as HistoricalEvent).id === selectedEvent?.id ? .09 : .045}
        pointRadius={(object) => (object as HistoricalEvent).id === selectedEvent?.id ? .55 : .29}
        pointLabel={(object) => `<div class="globe-tooltip event-tooltip"><strong>${escapeHtml((object as HistoricalEvent).title)}</strong><span>${Math.abs((object as HistoricalEvent).year)} ${(object as HistoricalEvent).year < 0 ? 'BCE' : 'CE'} · historical moment</span></div>`}
        onPointClick={(object) => onEventSelect(object as HistoricalEvent)}
        ringsData={events}
        ringLat="lat"
        ringLng="lng"
        ringColor={(object: object) => (object as HistoricalEvent).id === selectedEvent?.id
          ? ['rgba(255,244,202,1)', 'rgba(255,210,123,0)']
          : ['rgba(255,210,123,.65)', 'rgba(255,210,123,0)']}
        ringMaxRadius={(object: object) => (object as HistoricalEvent).id === selectedEvent?.id ? 3.2 : 2.2}
        ringPropagationSpeed={.7}
        ringRepeatPeriod={1800}
        htmlElementsData={htmlLabels}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={(object) => (object as HtmlLabel).kind === 'event' ? .105 : .04}
        htmlElement={htmlElement}
        onGlobeClick={onClearSelection}
        onGlobeReady={handleReady}
      />
      {transitionImage && <img className={`globe-transition-snapshot ${transitionVisible ? 'visible' : ''}`} src={transitionImage} alt="" aria-hidden="true" />}
      <div className="drag-hint" aria-hidden="true"><span className="mouse-glyph" /> Drag to rotate · Scroll to zoom</div>
    </div>
  )
}
