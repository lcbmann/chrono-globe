export interface MarkerLocation {
  key: string
  lat: number
  lng: number
}

export interface MarkerOffset {
  x: number
  y: number
}

const coordinateKey = ({ lat, lng }: MarkerLocation) => `${lat.toFixed(4)}:${lng.toFixed(4)}`

export const buildMarkerOffsets = (markers: MarkerLocation[]) => {
  const groups = new Map<string, MarkerLocation[]>()
  markers.forEach((marker) => {
    const key = coordinateKey(marker)
    groups.set(key, [...(groups.get(key) || []), marker])
  })

  const offsets = new Map<string, MarkerOffset>()
  groups.forEach((group) => {
    const ordered = [...group].sort((left, right) => left.key.localeCompare(right.key))
    if (ordered.length === 1) {
      offsets.set(ordered[0].key, { x: 0, y: 0 })
      return
    }
    if (ordered.length === 2) {
      offsets.set(ordered[0].key, { x: -11, y: 7 })
      offsets.set(ordered[1].key, { x: 11, y: -7 })
      return
    }

    const radius = 12
    ordered.forEach((marker, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / ordered.length
      offsets.set(marker.key, {
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
      })
    })
  })
  return offsets
}
