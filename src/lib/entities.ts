import type { EntitySummary, HistoricalFeature } from '../types'
import { civilizationProfiles } from '../data/civilizations'

const palette = [
  '#e8a34a', '#4fb3a5', '#cf6d62', '#8b82d8', '#d0b64d', '#5d96cf',
  '#cc79a7', '#7dad58', '#e07d3c', '#6eacc1', '#b480d1', '#d45f7a',
]

export const entityKey = (feature: HistoricalFeature) =>
  feature.properties.SUBJECTO || feature.properties.PARTOF || feature.properties.NAME || 'Unknown'

export const entityColor = (key: string) => {
  const profile = civilizationProfiles.find((item) => item.names.some((name) => name.toLowerCase() === key.toLowerCase()))
  if (profile) return profile.color
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return palette[Math.abs(hash) % palette.length]
}

export const groupEntities = (features: HistoricalFeature[]): EntitySummary[] => {
  const groups = new Map<string, EntitySummary>()

  for (const feature of features) {
    const regionName = feature.properties.NAME?.trim()
    if (!regionName) continue
    const key = entityKey(feature)
    const existing = groups.get(key)
    if (existing) {
      existing.features.push(feature)
      existing.precision = Math.min(existing.precision, feature.properties.BORDERPRECISION || 1) as 1 | 2 | 3
      continue
    }

    groups.set(key, {
      key,
      name: key,
      subject: feature.properties.SUBJECTO || key,
      partOf: feature.properties.PARTOF,
      control: feature.properties.CONTROL,
      precision: feature.properties.BORDERPRECISION || 1,
      features: [feature],
    })
  }

  return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character)
