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

export interface DatasetIndex {
  maps: Snapshot[]
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

export interface LabelDatum {
  lat: number
  lng: number
  text: string
  color: string
}
