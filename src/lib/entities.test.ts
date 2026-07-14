import { describe, expect, it } from 'vitest'
import type { HistoricalFeature } from '../types'
import { entityColor, escapeHtml, groupEntities } from './entities'

const feature = (name: string, subject = name): HistoricalFeature => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [] },
  properties: {
    NAME: name, ABBREVN: null, CONTROL: null, SUBJECTO: subject,
    PARTOF: subject, BORDERPRECISION: 2,
  },
})

describe('entity helpers', () => {
  it('groups territories with the same governing subject', () => {
    const entities = groupEntities([feature('Province A', 'Empire'), feature('Province B', 'Empire')])
    expect(entities).toHaveLength(1)
    expect(entities[0].name).toBe('Empire')
    expect(entities[0].features).toHaveLength(2)
  })

  it('assigns stable colors and escapes tooltip text', () => {
    expect(entityColor('Rome')).toBe(entityColor('Rome'))
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })
})
