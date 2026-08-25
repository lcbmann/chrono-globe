import { readFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { geoArea } from 'd3-geo'
import { HEMISPHERE_AREA } from './historical-geometry.mjs'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFile(resolve(root, path), 'utf8')
const index = JSON.parse(await read('public/data/index.json'))
const failures = []
const maps = Array.isArray(index.maps) ? index.maps : []
const indexedEntities = Array.isArray(index.entities) ? index.entities : []
const entityKeys = new Set(indexedEntities.flatMap((entity) => typeof entity.key === 'string' ? [entity.key.toLocaleLowerCase()] : []))

const fail = (message) => failures.push(message)
const assertUnique = (values, label) => {
  const seen = new Set()
  for (const value of values) {
    const normalized = value.toLocaleLowerCase()
    if (seen.has(normalized)) fail(`Duplicate ${label}: ${value}`)
    seen.add(normalized)
  }
}

if (typeof index.sourceCommit !== 'string' || !/^[0-9a-f]{40}$/i.test(index.sourceCommit)) {
  fail('Dataset index must record one immutable 40-character source commit')
}
if (!Array.isArray(index.maps) || maps.length === 0) fail('Dataset index must contain at least one map')
if (!Array.isArray(index.entities) || indexedEntities.length === 0) fail('Dataset index must contain at least one entity')
if (index.source !== 'https://github.com/aourednik/historical-basemaps') fail('Dataset index must identify the Historical Basemaps source repository')
if (index.license !== 'GPL-3.0') fail('Dataset index must retain the Historical Basemaps GPL-3.0 license')
if (typeof index.updatedAt !== 'string' || !Number.isFinite(Date.parse(index.updatedAt)) || new Date(index.updatedAt).toISOString() !== index.updatedAt) {
  fail('Dataset index updatedAt must be an ISO 8601 UTC timestamp')
}

assertUnique(maps.map((map) => String(map.year)), 'map year')
assertUnique(maps.flatMap((map) => typeof map.filename === 'string' ? [map.filename] : []), 'map filename')
assertUnique(indexedEntities.flatMap((entity) => typeof entity.key === 'string' ? [entity.key] : []), 'entity key')
for (const snapshot of maps) {
  if (!Number.isInteger(snapshot.year) || snapshot.year === 0) fail(`Map has an invalid historical year: ${snapshot.year}`)
  if (snapshot.filename !== `maps/${snapshot.year}.geojson`) fail(`Map filename does not match its year: ${snapshot.filename}`)
  if (!Number.isInteger(snapshot.entities) || snapshot.entities < 1) fail(`${snapshot.filename} has an invalid entity count`)
  if (!Number.isInteger(snapshot.features) || snapshot.features < 1) fail(`${snapshot.filename} has an invalid feature count`)
  if (snapshot.entities > snapshot.features) fail(`${snapshot.filename} records more entities than features`)
}
for (let position = 1; position < maps.length; position += 1) {
  if (maps[position].year <= maps[position - 1].year) fail('Map years must be strictly ascending')
}

const mapYears = new Set(maps.map((map) => map.year))
for (const entity of indexedEntities) {
  if (typeof entity.key !== 'string' || entity.key.trim() !== entity.key || entity.key.length === 0) fail('Entity has an invalid key')
  if (entity.name !== entity.key) fail(`Entity name must match its canonical map key: ${entity.key}`)
  if (!Array.isArray(entity.aliases) || entity.aliases.some((alias) => typeof alias !== 'string' || alias.length === 0)) {
    fail(`Entity has invalid aliases: ${entity.key}`)
  } else {
    assertUnique(entity.aliases, `alias for ${entity.key}`)
    const sortedAliases = [...entity.aliases].sort()
    if (entity.aliases.some((alias, position) => alias !== sortedAliases[position])) fail(`Entity aliases are not deterministically sorted: ${entity.key}`)
  }
  if (!Array.isArray(entity.years) || entity.years.length === 0) {
    fail(`Entity has no mapped chronology: ${entity.key}`)
    continue
  }
  if (entity.years.some((year) => !Number.isInteger(year) || year === 0 || !mapYears.has(year))) fail(`Entity references an invalid map year: ${entity.key}`)
  if (entity.years.some((year, position) => position > 0 && year <= entity.years[position - 1])) fail(`Entity years must be strictly ascending: ${entity.key}`)
  if (entity.firstYear !== entity.years[0]) fail(`Entity firstYear does not match its chronology: ${entity.key}`)
  if (entity.lastYear !== entity.years.at(-1)) fail(`Entity lastYear does not match its chronology: ${entity.key}`)
  if (!entity.years.includes(entity.peakYear)) fail(`Entity peakYear is outside its chronology: ${entity.key}`)
  if (!Number.isFinite(entity.maxArea) || entity.maxArea <= 0) fail(`Entity has an invalid maximum area: ${entity.key}`)
}

const inspectCoordinates = (coordinates, issues) => {
  if (!Array.isArray(coordinates)) return
  if (typeof coordinates[0] === 'number') {
    const [lng, lat] = coordinates
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) issues.nonFinite = true
    else if (lng < -180 || lng > 180 || lat < -90 || lat > 90) issues.outOfBounds = true
    for (const coordinate of coordinates) {
      if (Number.isFinite(coordinate) && Math.abs(coordinate * 1e5 - Math.round(coordinate * 1e5)) > 1e-6) issues.excessPrecision = true
    }
    return
  }
  for (const child of coordinates) inspectCoordinates(child, issues)
}

const positionsEqual = (left, right) => Array.isArray(left) && Array.isArray(right)
  && left.length === right.length && left.every((coordinate, index) => coordinate === right[index])

const inspectGeometry = (geometry, issues) => {
  if (geometry?.type !== 'MultiPolygon' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    issues.invalidShape += 1
    return
  }
  for (const polygon of geometry.coordinates) {
    const exterior = polygon?.[0]
    const uniquePositions = Array.isArray(exterior)
      ? new Set(exterior.slice(0, -1).map((position) => Array.isArray(position) ? position.join(',') : '')).size
      : 0
    if (!Array.isArray(exterior) || exterior.length < 4 || !positionsEqual(exterior[0], exterior.at(-1)) || uniquePositions < 3) {
      issues.invalidShape += 1
      continue
    }
    const area = geoArea({ type: 'Polygon', coordinates: polygon })
    if (!Number.isFinite(area) || area <= 0) issues.degenerate += 1
    else if (area > HEMISPHERE_AREA) issues.reversed += 1
  }
}

const derivedEntities = new Map()
for (const snapshot of maps) {
  const path = resolve(root, 'public/data', snapshot.filename)
  try {
    await access(path)
    const map = JSON.parse(await readFile(path, 'utf8'))
    if (map.type !== 'FeatureCollection' || !Array.isArray(map.features)) fail(`${snapshot.filename} is not a GeoJSON FeatureCollection`)
    else {
      const usable = map.features.filter((feature) => feature.properties?.NAME && feature.properties.NAME !== '?')
      if (usable.length !== map.features.length) fail(`${snapshot.filename} ships ${map.features.length - usable.length} unusable unnamed features`)
      if (usable.length !== snapshot.features) fail(`${snapshot.filename} contains ${usable.length} named features; index records ${snapshot.features}`)
      const uniqueNames = new Set(usable.map((feature) => feature.properties.NAME)).size
      if (uniqueNames !== snapshot.entities) fail(`${snapshot.filename} contains ${uniqueNames} named entities; index records ${snapshot.entities}`)
      const coordinateIssues = { nonFinite: false, outOfBounds: false, excessPrecision: false }
      const geometryIssues = { invalidShape: 0, degenerate: 0, reversed: 0 }
      const seenThisYear = new Set()
      for (const feature of usable) {
        inspectCoordinates(feature.geometry?.coordinates, coordinateIssues)
        inspectGeometry(feature.geometry, geometryIssues)
        const properties = feature.properties
        const key = properties.SUBJECTO || properties.PARTOF || properties.NAME
        if (typeof key !== 'string' || key.length === 0) {
          fail(`${snapshot.filename} contains a feature without a canonical entity key`)
          continue
        }
        const normalized = key.toLocaleLowerCase()
        const history = derivedEntities.get(normalized) || { key, aliases: new Set(), years: [] }
        if (history.key !== key) fail(`Canonical entity key differs only by case: ${history.key} / ${key}`)
        history.aliases.add(properties.NAME)
        if (!seenThisYear.has(normalized)) history.years.push(snapshot.year)
        seenThisYear.add(normalized)
        derivedEntities.set(normalized, history)
      }
      if (coordinateIssues.nonFinite) fail(`${snapshot.filename} contains non-finite coordinates`)
      if (coordinateIssues.outOfBounds) fail(`${snapshot.filename} contains coordinates outside longitude/latitude bounds`)
      if (coordinateIssues.excessPrecision) fail(`${snapshot.filename} contains coordinates beyond the five-decimal runtime precision`)
      if (geometryIssues.invalidShape) fail(`${snapshot.filename} contains ${geometryIssues.invalidShape} malformed polygon(s)`)
      if (geometryIssues.degenerate) fail(`${snapshot.filename} contains ${geometryIssues.degenerate} zero-area polygon(s)`)
      if (geometryIssues.reversed) fail(`${snapshot.filename} contains ${geometryIssues.reversed} reversed polygon(s) covering more than a hemisphere`)
    }
  } catch (error) {
    fail(`Could not validate ${snapshot.filename}: ${error instanceof Error ? error.message : error}`)
  }
}

if (derivedEntities.size !== indexedEntities.length) fail(`Map files contain ${derivedEntities.size} canonical entities; index records ${indexedEntities.length}`)
for (const entity of indexedEntities) {
  if (typeof entity.key !== 'string') continue
  const derived = derivedEntities.get(entity.key.toLocaleLowerCase())
  if (!derived) {
    fail(`Indexed entity is absent from all map files: ${entity.key}`)
    continue
  }
  if (derived.key !== entity.key) fail(`Indexed entity key does not preserve map spelling: ${entity.key}`)
  if (JSON.stringify(derived.years) !== JSON.stringify(entity.years)) fail(`Indexed chronology differs from map files: ${entity.key}`)
  const expectedAliases = [...derived.aliases].filter((alias) => alias !== derived.key).sort()
  if (JSON.stringify(expectedAliases) !== JSON.stringify(entity.aliases)) fail(`Indexed aliases differ from map files: ${entity.key}`)
}
for (const derived of derivedEntities.values()) {
  if (!entityKeys.has(derived.key.toLocaleLowerCase())) fail(`Map entity is missing from the index: ${derived.key}`)
}

const eventsSource = await read('src/data/events.ts')
const eventIds = [...eventsSource.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1])
const eventEntities = [...eventsSource.matchAll(/\bentity:\s*'([^']+)'/g)].map((match) => match[1])
assertUnique(eventIds, 'event id')
for (const entity of eventEntities) if (!entityKeys.has(entity.toLocaleLowerCase())) fail(`Event references missing entity: ${entity}`)

const profileSource = await read('src/data/civilizations.ts')
const profileNames = [...profileSource.matchAll(/\bnames:\s*\[([^\]]+)\]/g)].flatMap((match) => [...match[1].matchAll(/'([^']+)'/g)].map((name) => name[1]))
assertUnique(profileNames, 'civilization profile alias')
for (const name of profileNames) if (!entityKeys.has(name.toLocaleLowerCase())) fail(`Civilization profile alias does not match the index: ${name}`)

const mediaSource = await read('src/data/civilizationMedia.ts')
const mediaNames = [...mediaSource.matchAll(/\bnames:\s*\[([^\]]+)\]/g)].flatMap((match) => [...match[1].matchAll(/'([^']+)'/g)].map((name) => name[1]))
const mediaFiles = [...mediaSource.matchAll(/\bimage\('([^']+)'/g)].map((match) => match[1])
const profileNameKeys = new Set(profileNames.map((name) => name.toLocaleLowerCase()))
assertUnique(mediaNames, 'civilization media alias')
assertUnique(mediaFiles, 'civilization media file')
for (const name of mediaNames) if (!profileNameKeys.has(name.toLocaleLowerCase())) fail(`Civilization media alias does not match a curated profile: ${name}`)
for (const file of mediaFiles) if (!/\.(?:jpe?g|png|svg|webp)$/i.test(file)) fail(`Civilization media has an unsupported file type: ${file}`)

const layersSource = await read('src/data/layers.ts')
const pointAndRouteIds = [...layersSource.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1])
assertUnique(pointAndRouteIds, 'layer id')
const pointEntities = [...layersSource.matchAll(/\bentity:\s*'([^']+)'/g)].map((match) => match[1])
for (const entity of pointEntities) if (!entityKeys.has(entity.toLocaleLowerCase())) fail(`Layer point references missing entity: ${entity}`)

const storiesSource = await read('src/data/stories.ts')
const storyIds = [...storiesSource.matchAll(/^\s+id:\s*'([^']+)'/gm)].map((match) => match[1])
const storyEventIds = [...storiesSource.matchAll(/\beventId:\s*'([^']+)'/g)].map((match) => match[1])
const storyEntities = [...storiesSource.matchAll(/\bentity:\s*'([^']+)'/g)].map((match) => match[1])
assertUnique(storyIds, 'story id')
for (const id of storyEventIds) if (!eventIds.includes(id)) fail(`Story references missing event: ${id}`)
for (const entity of storyEntities) if (!entityKeys.has(entity.toLocaleLowerCase())) fail(`Story references missing entity: ${entity}`)

const sourceFiles = [eventsSource, profileSource, layersSource]
for (const source of sourceFiles) {
  for (const match of source.matchAll(/\burl:\s*(?:`([^`]+)`|'([^']+)')/g)) {
    const url = match[1] || match[2]
    if (url.includes('${')) continue
    try {
      if (new URL(url).protocol !== 'https:') fail(`Source URL must use HTTPS: ${url}`)
    } catch { fail(`Invalid source URL: ${url}`) }
  }
}

for (const match of mediaSource.matchAll(/https:\/\/[^'"\s]+/g)) {
  try {
    if (new URL(match[0]).protocol !== 'https:') fail(`Media license URL must use HTTPS: ${match[0]}`)
  } catch { fail(`Invalid media license URL: ${match[0]}`) }
}

if (failures.length > 0) {
  console.error(`Historical data validation failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Validated ${maps.length} maps, ${indexedEntities.length} indexed entities, ${eventIds.length} events, ${profileNames.length} profile aliases, ${mediaFiles.length} free media assets, ${pointAndRouteIds.length} layer records, and ${storyIds.length} stories.`)
}
