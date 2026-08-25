import { geoArea } from 'd3-geo'

export const HEMISPHERE_AREA = Math.PI * 2

const positionsEqual = (left, right) => left.length === right.length
  && left.every((coordinate, index) => coordinate === right[index])

const cleanRing = (ring) => {
  if (!Array.isArray(ring)) return null

  const positions = []
  for (const position of ring) {
    if (!Array.isArray(position) || position.length < 2 || position.some((coordinate) => !Number.isFinite(coordinate))) {
      return null
    }
    if (positions.length === 0 || !positionsEqual(position, positions.at(-1))) positions.push(position)
  }

  if (positions.length > 1 && positionsEqual(positions[0], positions.at(-1))) positions.pop()
  if (new Set(positions.map((position) => position.join(','))).size < 3) return null

  return [...positions, positions[0]]
}

const polygonArea = (coordinates) => geoArea({ type: 'Polygon', coordinates })

const cleanPolygon = (polygon, stats) => {
  if (!Array.isArray(polygon) || polygon.length === 0) {
    stats.removedPolygons += 1
    return null
  }

  const exterior = cleanRing(polygon[0])
  if (!exterior) {
    stats.removedPolygons += 1
    return null
  }

  let coordinates = [exterior, ...polygon.slice(1).map(cleanRing).filter(Boolean)]
  let area = polygonArea(coordinates)
  if (!Number.isFinite(area) || area <= 0) {
    stats.removedPolygons += 1
    return null
  }

  // d3-geo treats an oppositely wound ring as its spherical complement. A
  // tiny source fragment can therefore become an opaque, planet-sized cap.
  // No territory in this atlas should occupy more than one hemisphere, so
  // reverse every ring in that polygon and retain the intended smaller side.
  if (area > HEMISPHERE_AREA) {
    coordinates = coordinates.map((ring) => [...ring].reverse())
    area = polygonArea(coordinates)
    stats.rewoundPolygons += 1
  }

  if (!Number.isFinite(area) || area <= 0 || area > HEMISPHERE_AREA) {
    stats.removedPolygons += 1
    return null
  }
  return coordinates
}

export const sanitizeHistoricalGeometry = (geometry, stats = { removedPolygons: 0, rewoundPolygons: 0 }) => {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null

  const sourcePolygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  const polygons = sourcePolygons.map((polygon) => cleanPolygon(polygon, stats)).filter(Boolean)
  if (polygons.length === 0) return null

  return { type: 'MultiPolygon', coordinates: polygons }
}

export const sanitizeHistoricalFeatures = (features) => {
  const stats = { removedFeatures: 0, removedPolygons: 0, rewoundPolygons: 0 }
  const sanitized = []

  for (const feature of features) {
    const geometry = sanitizeHistoricalGeometry(feature.geometry, stats)
    if (!geometry) {
      stats.removedFeatures += 1
      continue
    }
    feature.geometry = geometry
    sanitized.push(feature)
  }

  return { features: sanitized, stats }
}
