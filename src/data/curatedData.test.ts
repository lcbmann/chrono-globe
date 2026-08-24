import { describe, expect, it } from 'vitest'
import type { FreeMediaAsset } from '../types'
import { civilizationMedia } from './civilizationMedia'
import { civilizationProfiles } from './civilizations'
import { historicalEvents } from './events'
import { historicalPoints, historicalRoutes } from './layers'
import { historicalStories } from './stories'

const expectText = (value: string) => expect(value.trim().length).toBeGreaterThan(0)
const expectHttpsSource = (source: { title: string; url: string }) => {
  expectText(source.title)
  expect(new URL(source.url).protocol).toBe('https:')
}
const expectCoordinates = (lat: number, lng: number) => {
  expect(Number.isFinite(lat)).toBe(true)
  expect(Number.isFinite(lng)).toBe(true)
  expect(lat).toBeGreaterThanOrEqual(-90)
  expect(lat).toBeLessThanOrEqual(90)
  expect(lng).toBeGreaterThanOrEqual(-180)
  expect(lng).toBeLessThanOrEqual(180)
}
const expectMediaAsset = (asset: FreeMediaAsset) => {
  expect(asset.file).toMatch(/\.(?:jpe?g|png|svg|webp)$/i)
  expectText(asset.alt)
  expectText(asset.caption)
  expectText(asset.credit)
  expectText(asset.license)
  expect(new URL(asset.licenseUrl).protocol).toBe('https:')
}

describe('curated historical data integrity', () => {
  it('keeps events unique, chronological, located, and sourced', () => {
    expect(new Set(historicalEvents.map((event) => event.id)).size).toBe(historicalEvents.length)
    expect(historicalEvents.map((event) => event.year)).toEqual([...historicalEvents].map((event) => event.year).sort((left, right) => left - right))

    for (const event of historicalEvents) {
      expectText(event.id)
      expectText(event.title)
      expectText(event.description)
      expect(Number.isInteger(event.year)).toBe(true)
      expect(event.year).not.toBe(0)
      expectCoordinates(event.lat, event.lng)
      expectHttpsSource(event.source)
    }
  })

  it('keeps points and routes internally consistent', () => {
    const layerIds = [...historicalPoints, ...historicalRoutes].map((record) => record.id)
    expect(new Set(layerIds).size).toBe(layerIds.length)

    for (const point of historicalPoints) {
      expectText(point.id)
      expectText(point.name)
      expectText(point.description)
      expect(Number.isInteger(point.startYear)).toBe(true)
      expect(Number.isInteger(point.endYear)).toBe(true)
      expect(point.startYear).not.toBe(0)
      expect(point.endYear).not.toBe(0)
      expect(point.startYear).toBeLessThanOrEqual(point.endYear)
      expectCoordinates(point.lat, point.lng)
      expectHttpsSource(point.source)
    }

    for (const route of historicalRoutes) {
      expectText(route.id)
      expectText(route.name)
      expectText(route.description)
      expect(Number.isInteger(route.startYear)).toBe(true)
      expect(Number.isInteger(route.endYear)).toBe(true)
      expect(route.startYear).not.toBe(0)
      expect(route.endYear).not.toBe(0)
      expect(route.startYear).toBeLessThanOrEqual(route.endYear)
      expect(route.coordinates.length).toBeGreaterThanOrEqual(2)
      for (const coordinate of route.coordinates) expectCoordinates(coordinate.lat, coordinate.lng)
      expectHttpsSource(route.source)
    }
  })

  it('keeps story steps chronological and their event links exact', () => {
    const eventById = new Map(historicalEvents.map((event) => [event.id, event]))
    expect(new Set(historicalStories.map((story) => story.id)).size).toBe(historicalStories.length)

    for (const story of historicalStories) {
      expectText(story.id)
      expectText(story.title)
      expectText(story.subtitle)
      expect(story.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(story.steps.length).toBeGreaterThanOrEqual(2)
      expect(story.steps.map((step) => step.year)).toEqual([...story.steps].map((step) => step.year).sort((left, right) => left - right))

      for (const step of story.steps) {
        expect(Number.isInteger(step.year)).toBe(true)
        expect(step.year).not.toBe(0)
        expectText(step.title)
        expectText(step.description)
        if (!step.eventId) continue
        const event = eventById.get(step.eventId)
        expect(event, `Missing story event ${step.eventId}`).toBeDefined()
        expect(event?.year).toBe(step.year)
      }
    }
  })

  it('keeps civilization profiles complete and aliases unambiguous', () => {
    const aliases = civilizationProfiles.flatMap((profile) => profile.names.map((name) => name.toLocaleLowerCase()))
    expect(new Set(aliases).size).toBe(aliases.length)

    for (const profile of civilizationProfiles) {
      expect(profile.names.length).toBeGreaterThan(0)
      for (const name of profile.names) expectText(name)
      expectText(profile.displayName)
      expectText(profile.period)
      expectText(profile.overview)
      expectText(profile.legacy)
      expect(profile.facts.length).toBeGreaterThanOrEqual(2)
      for (const fact of profile.facts) expectText(fact)
      expect(profile.importance).toBeGreaterThan(0)
      expect(profile.importance).toBeLessThanOrEqual(1)
      expect(profile.color).toMatch(/^#[0-9a-f]{6}$/i)
      expectHttpsSource(profile.source)
    }
  })

  it('keeps free media metadata attributable and non-duplicated', () => {
    const aliases = civilizationMedia.flatMap((record) => record.names.map((name) => name.toLocaleLowerCase()))
    const assets = civilizationMedia.flatMap((record) => [record.image, record.symbol].filter((asset): asset is FreeMediaAsset => Boolean(asset)))
    expect(new Set(aliases).size).toBe(aliases.length)
    expect(new Set(assets.map((asset) => asset.file.toLocaleLowerCase())).size).toBe(assets.length)

    for (const record of civilizationMedia) {
      expect(record.names.length).toBeGreaterThan(0)
      expect(record.image || record.symbol).toBeDefined()
      for (const name of record.names) expectText(name)
      if (record.image) expectMediaAsset(record.image)
      if (record.symbol) {
        expectMediaAsset(record.symbol)
        expectText(record.symbol.context)
      }
    }
  })
})
