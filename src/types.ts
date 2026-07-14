import type { Feature, FeatureCollection, Geometry } from 'geojson'

export type BorderPrecision = 1 | 2 | 3

export interface HistoricalProperties {
  NAME: string | null
  ABBREVN: string | null
  CONTROL: string | null
  SUBJECTO: string | null
  PARTOF: string | null
  BORDERPRECISION: BorderPrecision | null
}

export type HistoricalFeature = Feature<Geometry, HistoricalProperties>

export interface HistoricalMap extends FeatureCollection<Geometry, HistoricalProperties> {
  name?: string
}

export interface Snapshot {
  year: number
  filename: string
  entities: number
  features: number
}

export interface HistoricalEntityIndex {
  key: string
  name: string
  aliases: string[]
  years: number[]
  firstYear: number
  lastYear: number
  peakYear: number
  maxArea: number
}

export interface DatasetIndex {
  maps: Snapshot[]
  entities: HistoricalEntityIndex[]
  updatedAt: string
  source: string
  sourceCommit: string | null
  license: string
}

export interface EntitySummary {
  key: string
  name: string
  subject: string
  partOf: string | null
  control: string | null
  precision: BorderPrecision
  features: HistoricalFeature[]
}

export interface CivilizationProfile {
  names: string[]
  displayName: string
  period: string
  capital?: string
  overview: string
  legacy: string
  facts: string[]
  importance: number
  color: string
  source: { title: string; url: string }
}

export interface HistoricalEvent {
  id: string
  title: string
  year: number
  lat: number
  lng: number
  description: string
  entity?: string
  source: { title: string; url: string }
}

export interface LabelDatum {
  lat: number
  lng: number
  text: string
  color: string
}
