import { readFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFile(resolve(root, path), 'utf8')
const index = JSON.parse(await read('public/data/index.json'))
const failures = []
const entityKeys = new Set(index.entities.map((entity) => entity.key.toLocaleLowerCase()))

const fail = (message) => failures.push(message)
const assertUnique = (values, label) => {
  const seen = new Set()
  for (const value of values) {
    const normalized = value.toLocaleLowerCase()
    if (seen.has(normalized)) fail(`Duplicate ${label}: ${value}`)
    seen.add(normalized)
  }
}

assertUnique(index.maps.map((map) => String(map.year)), 'map year')
assertUnique(index.maps.map((map) => map.filename), 'map filename')
if (new Set(index.entities.map((entity) => entity.key)).size !== index.entities.length) fail('The entity index contains duplicate exact keys')

for (const snapshot of index.maps) {
  const path = resolve(root, 'public/data', snapshot.filename)
  try {
    await access(path)
    const map = JSON.parse(await readFile(path, 'utf8'))
    if (map.type !== 'FeatureCollection' || !Array.isArray(map.features)) fail(`${snapshot.filename} is not a GeoJSON FeatureCollection`)
    else {
      const usable = map.features.filter((feature) => feature.properties?.NAME)
      if (usable.length !== snapshot.features) fail(`${snapshot.filename} contains ${usable.length} named features; index records ${snapshot.features}`)
    }
  } catch (error) {
    fail(`Could not validate ${snapshot.filename}: ${error instanceof Error ? error.message : error}`)
  }
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
assertUnique(storyIds, 'story id')
for (const id of storyEventIds) if (!eventIds.includes(id)) fail(`Story references missing event: ${id}`)

const sourceFiles = [eventsSource, profileSource, layersSource]
for (const source of sourceFiles) {
  for (const match of source.matchAll(/\burl:\s*(?:`([^`]+)`|'([^']+)')/g)) {
    const url = match[1] || match[2]
    if (url.includes('${')) continue
    try { new URL(url) } catch { fail(`Invalid source URL: ${url}`) }
  }
}

for (const match of mediaSource.matchAll(/https:\/\/[^'"\s]+/g)) {
  try { new URL(match[0]) } catch { fail(`Invalid media license URL: ${match[0]}`) }
}

if (failures.length > 0) {
  console.error(`Historical data validation failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Validated ${index.maps.length} maps, ${index.entities.length} indexed entities, ${eventIds.length} events, ${profileNames.length} profile aliases, ${mediaFiles.length} free media assets, ${pointAndRouteIds.length} layer records, and ${storyIds.length} stories.`)
}
