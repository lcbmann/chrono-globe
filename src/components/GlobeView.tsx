import { useEffect, useMemo, useRef, useState } from 'react'
import { geoCentroid } from 'd3-geo'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { feature as topojsonFeature } from 'topojson-client'
import { AmbientLight, Color, DirectionalLight, MeshPhongMaterial } from 'three'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { entityColor, entityKey, escapeHtml } from '../lib/entities'
import type { HistoricalFeature, LabelDatum } from '../types'

interface LandProperties {
  __layer: 'land'
}

type LandFeature = Feature<Geometry, LandProperties>
type RenderPolygon = HistoricalFeature | LandFeature

interface GlobeViewProps {
  features: HistoricalFeature[]
  selectedKey: string | null
  onSelect: (feature: HistoricalFeature) => void
  onClearSelection: () => void
}

const rgba = (hex: string, alpha: number) => {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

const isLand = (polygon: RenderPolygon): polygon is LandFeature =>
  Boolean(polygon.properties && '__layer' in polygon.properties && polygon.properties.__layer === 'land')

const precisionLabel = (precision: number | null) => {
  if (precision === 3) return 'Documented boundary'
  if (precision === 2) return 'Moderate confidence'
  return 'Approximate extent'
}

export function GlobeView({ features, selectedKey, onSelect, onClearSelection }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [size, setSize] = useState({ width: 900, height: 700 })
  const [land, setLand] = useState<LandFeature[]>([])
  const [ready, setReady] = useState(false)

  const globeMaterial = useMemo(() => new MeshPhongMaterial({
    color: new Color('#071a23'),
    emissive: new Color('#031017'),
    emissiveIntensity: 0.38,
    shininess: 18,
    specular: new Color('#2b7888'),
  }), [])

  useEffect(() => () => globeMaterial.dispose(), [globeMaterial])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
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
      })
      .catch(() => setLand([]))
  }, [])

  useEffect(() => {
    if (!ready || !selectedKey) return
    const selectedFeature = features.find((item) => entityKey(item) === selectedKey)
    if (!selectedFeature) return
    const [lng, lat] = geoCentroid(selectedFeature)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      globeRef.current?.pointOfView({ lat, lng, altitude: 1.65 }, 900)
    }
  }, [features, ready, selectedKey])

  const polygons = useMemo<RenderPolygon[]>(
    () => [...land, ...features],
    [features, land],
  )

  const labels = useMemo<LabelDatum[]>(() => {
    if (!selectedKey) return []
    const selectedFeature = features.find((item) => entityKey(item) === selectedKey)
    if (!selectedFeature) return []
    const [lng, lat] = geoCentroid(selectedFeature)
    return [{
      lat,
      lng,
      text: selectedFeature.properties.NAME || selectedKey,
      color: entityColor(selectedKey),
    }]
  }, [features, selectedKey])

  const handleReady = () => {
    setReady(true)
    const globe = globeRef.current
    if (!globe) return
    globe.pointOfView({ lat: 31, lng: 28, altitude: 1.85 }, 0)
    const controls = globe.controls()
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.rotateSpeed = 0.55
    globe.lights([
      new AmbientLight('#9bc1c8', 1.35),
      new DirectionalLight('#fff0ce', 2.8),
    ])
    const directional = globe.lights()[1] as DirectionalLight
    directional.position.set(-180, 120, 160)
  }

  const polygonLabel = (object: object) => {
    const polygon = object as RenderPolygon
    if (isLand(polygon)) return ''
    const properties = polygon.properties
    const name = escapeHtml(properties.NAME || 'Unnamed territory')
    const subject = properties.SUBJECTO && properties.SUBJECTO !== properties.NAME
      ? `<div>Subject to ${escapeHtml(properties.SUBJECTO)}</div>`
      : ''
    return `<div class="globe-tooltip"><strong>${name}</strong>${subject}<span>${precisionLabel(properties.BORDERPRECISION)}</span></div>`
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
        showGraticules
        showAtmosphere
        atmosphereColor="#65bfd0"
        atmosphereAltitude={0.15}
        polygonsData={polygons}
        polygonGeoJsonGeometry={(object) => (object as RenderPolygon).geometry as never}
        polygonAltitude={(object) => {
          const polygon = object as RenderPolygon
          if (isLand(polygon)) return 0.004
          return entityKey(polygon) === selectedKey ? 0.022 : 0.011
        }}
        polygonCapColor={(object) => {
          const polygon = object as RenderPolygon
          if (isLand(polygon)) return 'rgba(43, 63, 54, 0.96)'
          const selected = entityKey(polygon) === selectedKey
          return rgba(entityColor(entityKey(polygon)), selected ? 0.94 : 0.7)
        }}
        polygonSideColor={(object) => {
          const polygon = object as RenderPolygon
          if (isLand(polygon)) return 'rgba(17, 31, 30, 0.8)'
          return rgba(entityColor(entityKey(polygon)), 0.32)
        }}
        polygonStrokeColor={(object) => {
          const polygon = object as RenderPolygon
          if (isLand(polygon)) return 'rgba(130, 159, 140, 0.2)'
          if (entityKey(polygon) === selectedKey) return '#fff8df'
          const precision = polygon.properties.BORDERPRECISION || 1
          return `rgba(255, 247, 220, ${0.18 + precision * 0.1})`
        }}
        polygonCapCurvatureResolution={3}
        polygonsTransitionDuration={650}
        polygonLabel={polygonLabel}
        onPolygonClick={(object) => {
          const polygon = object as RenderPolygon
          if (isLand(polygon)) onClearSelection()
          else onSelect(polygon)
        }}
        labelsData={labels}
        labelLat="lat"
        labelLng="lng"
        labelText="text"
        labelColor="color"
        labelSize={1.1}
        labelAltitude={0.035}
        labelResolution={3}
        labelDotRadius={0.22}
        labelsTransitionDuration={500}
        onGlobeClick={onClearSelection}
        onGlobeReady={handleReady}
      />
      <div className="drag-hint" aria-hidden="true">
        <span className="mouse-glyph" /> Drag to rotate · Scroll to zoom
      </div>
    </div>
  )
}
