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

export interface FreeMediaAsset {
  file: string
  alt: string
  caption: string
  credit: string
  license: string
  licenseUrl: string
}

export interface HistoricalSymbol extends FreeMediaAsset {
  kind: 'flag' | 'standard' | 'ensign'
  context: string
}

export interface CivilizationMedia {
  names: string[]
  image?: FreeMediaAsset
  symbol?: HistoricalSymbol
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

export type OverlayPointKind = 'capital' | 'city' | 'site'
export type RouteKind = 'trade' | 'migration' | 'expedition'

export interface HistoricalPoint {
  id: string
  name: string
  kind: OverlayPointKind
  lat: number
  lng: number
  startYear: number
  endYear: number
  description: string
  entity?: string
  source: { title: string; url: string }
}

export interface RouteCoordinate {
  lat: number
  lng: number
}

export interface HistoricalRoute {
  id: string
  name: string
  kind: RouteKind
  startYear: number
  endYear: number
  description: string
  coordinates: RouteCoordinate[]
  source: { title: string; url: string }
}

export interface LayerVisibility {
  events: boolean
  capitals: boolean
  cities: boolean
  sites: boolean
  trade: boolean
  migrations: boolean
  expeditions: boolean
}

export interface StoryStep {
  year: number
  title: string
  description: string
  entity?: string
  eventId?: string
}

export interface HistoricalStory {
  id: string
  title: string
  subtitle: string
  color: string
  steps: StoryStep[]
}

export type ChangeKind = 'appeared' | 'disappeared' | 'expanded' | 'contracted' | 'control' | 'stable'

export interface EntityChange {
  key: string
  kind: ChangeKind
  beforeArea: number
  afterArea: number
  magnitude: number
}

export interface ChangeSet {
  items: EntityChange[]
  counts: Record<ChangeKind, number>
}

export interface GlobeViewpoint {
  lat: number
  lng: number
  altitude: number
}

export interface LabelDatum {
  lat: number
  lng: number
  text: string
  color: string
}
