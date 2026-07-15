import { describe, expect, it } from 'vitest'
import { buildChangeSet } from './changes'
import type { HistoricalFeature } from '../types'

const square = (name: string, size: number, control: string | null = null): HistoricalFeature => ({
  type: 'Feature',
  properties: { NAME: name, ABBREVN: null, CONTROL: control, SUBJECTO: name, PARTOF: null, BORDERPRECISION: 1 },
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, size], [size, size], [size, 0], [0, 0]]] },
})

describe('historical change detection', () => {
  it('classifies appearances, disappearances, and material area changes', () => {
    const changes = buildChangeSet([square('Old', 2), square('Growing', 1)], [square('New', 2), square('Growing', 3)])
    expect(changes.items.find((item) => item.key === 'Old')?.kind).toBe('disappeared')
    expect(changes.items.find((item) => item.key === 'New')?.kind).toBe('appeared')
    expect(changes.items.find((item) => item.key === 'Growing')?.kind).toBe('expanded')
  })

  it('detects a recorded control change', () => {
    const changes = buildChangeSet([square('Realm', 2, 'A')], [square('Realm', 2, 'B')])
    expect(changes.items[0].kind).toBe('control')
  })
})
