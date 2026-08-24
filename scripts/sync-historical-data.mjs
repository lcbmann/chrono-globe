import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoArea } from 'd3-geo'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outputDirectory = join(root, 'public', 'data')
const mapDirectory = join(outputDirectory, 'maps')
const sourceRepository = 'aourednik/historical-basemaps'

await mkdir(mapDirectory, { recursive: true })

const decodeJson = (buffer) => {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
  } catch {
    return JSON.parse(new TextDecoder('windows-1252').decode(buffer))
  }
}

const downloadJson = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not download ${url}: ${response.status}`)
  }
  return decodeJson(await response.arrayBuffer())
}

const knownTextRepairs = new Map([
  ['Arag�n', 'Aragón'],
  ['Baltic tribes', 'Baltic Tribes'],
  ['Chinese warlords', 'Chinese Warlords'],
  ['CochimÃ­', 'Cochimí'],
  ['Cochimà', 'Cochimí'],
  ['Eastern North Amercian hunter-gatherers', 'Eastern North American hunter-gatherers'],
  ['HIghland Mesolithic Hunter-Foragers', 'Highland Mesolithic Hunter-Foragers'],
  ['Hindu kingdoms', 'Hindu Kingdoms'],
  ['Khoiasan', 'Khoisan'],
  ['Maori', 'Māori'],
  ['M?ori', 'Māori'],
  ['Monte Alb�n', 'Monte Albán'],
  ['Monte Alb?n', 'Monte Albán'],
  ['Monte Albàn', 'Monte Albán'],
  ['North American Pacifi foraging, hunting and fishing peoples', 'North American Pacific foraging, hunting and fishing peoples'],
  ['Plateau fichers and hunter gatherers', 'Plateau fishers and hunter-gatherers'],
  ['Rajput kingdoms', 'Rajput Kingdoms'],
  ['Saharan pastoral nomads', 'Saharan Pastoral Nomads'],
  ['Teotihuac�n', 'Teotihuacán'],
  ['Teotihuacàn', 'Teotihuacán'],
  ['Tokugawa shogunate', 'Tokugawa Shogunate'],
  ['Zhow states', 'Zhou states'],
])

const cleanText = (value) => {
  if (typeof value !== 'string') return value
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return knownTextRepairs.get(cleaned) || cleaned || null
}

const roundCoordinates = (value) => Array.isArray(value)
  ? value.map(roundCoordinates)
  : typeof value === 'number' ? Number(value.toFixed(5)) : value

// Resolve the branch once and download every file from that immutable revision,
// preventing a long sync from mixing files if upstream changes mid-run.
const commitResponse = await fetch(`https://api.github.com/repos/${sourceRepository}/commits/master`, {
  headers: { Accept: 'application/vnd.github+json' },
})
if (!commitResponse.ok) {
  throw new Error(`Could not resolve an immutable Historical Basemaps revision: ${commitResponse.status}`)
}
const commit = await commitResponse.json()
if (typeof commit.sha !== 'string' || !/^[0-9a-f]{40}$/i.test(commit.sha)) {
  throw new Error('Historical Basemaps returned an invalid commit revision.')
}
const sourceRevision = commit.sha
const sourceBase = `https://raw.githubusercontent.com/${sourceRepository}/${sourceRevision}`

const sourceIndex = await downloadJson(`${sourceBase}/index.json`)
const maps = []
const entityHistory = new Map()

for (const [position, item] of sourceIndex.years.entries()) {
  const map = await downloadJson(`${sourceBase}/geojson/${item.filename}`)

  for (const feature of map.features) {
    if (!feature.properties) continue
    for (const key of ['NAME', 'ABBREVN', 'CONTROL', 'SUBJECTO', 'PARTOF']) {
      feature.properties[key] = cleanText(feature.properties[key])
    }
  }

  // Unnamed geometries cannot be identified or explained by the interface.
  // Removing them avoids shipping work that the renderer immediately discards.
  map.features = map.features.filter((feature) => feature.properties?.NAME && feature.properties.NAME !== '?')

  const filename = `${item.year}.geojson`
  const namedFeatures = map.features
  const entitiesThisYear = new Map()
  for (const feature of namedFeatures) {
    const properties = feature.properties
    const key = properties.SUBJECTO || properties.PARTOF || properties.NAME
    const entry = entitiesThisYear.get(key) || { area: 0, aliases: new Set() }
    entry.area += geoArea(feature)
    entry.aliases.add(properties.NAME)
    entitiesThisYear.set(key, entry)
  }
  for (const [key, current] of entitiesThisYear) {
    const history = entityHistory.get(key) || { key, name: key, aliases: new Set(), years: [], peakYear: item.year, maxArea: 0 }
    current.aliases.forEach((alias) => history.aliases.add(alias))
    history.years.push(item.year)
    if (current.area > history.maxArea) {
      history.maxArea = current.area
      history.peakYear = item.year
    }
    entityHistory.set(key, history)
  }
  maps.push({
    year: item.year,
    filename: `maps/${filename}`,
    entities: new Set(namedFeatures.map((feature) => feature.properties.NAME)).size,
    features: namedFeatures.length,
  })

  // Preserve full precision for historical area/index calculations above, then
  // trim only the browser payload. Five decimal places is finer than this
  // dataset's source certainty while materially reducing download and parse cost.
  for (const feature of namedFeatures) {
    if (feature.geometry?.coordinates) feature.geometry.coordinates = roundCoordinates(feature.geometry.coordinates)
  }
  await writeFile(join(mapDirectory, filename), `${JSON.stringify(map)}\n`, 'utf8')

  process.stdout.write(`\rSynced ${position + 1}/${sourceIndex.years.length} historical maps`)
}

const entities = [...entityHistory.values()].map((entity) => ({
  ...entity,
  aliases: [...entity.aliases].filter((alias) => alias !== entity.name).sort(),
  firstYear: entity.years[0],
  lastYear: entity.years.at(-1),
})).sort((left, right) => left.name.localeCompare(right.name))

await copyFile(
  join(root, 'node_modules', 'world-atlas', 'land-110m.json'),
  join(outputDirectory, 'land-110m.json'),
)

await writeFile(
  join(outputDirectory, 'index.json'),
  `${JSON.stringify(
    {
      maps,
      entities,
      updatedAt: new Date().toISOString(),
      source: `https://github.com/${sourceRepository}`,
      sourceCommit: sourceRevision,
      license: 'GPL-3.0',
    },
    null,
    2,
  )}\n`,
  'utf8',
)

const readme = await readFile(join(root, 'README.md'), 'utf8')
if (!readme.includes('Historical Basemaps')) {
  throw new Error('README must retain Historical Basemaps attribution before data can be synced.')
}

process.stdout.write(`\nDone. ${maps.length} local snapshots are ready.\n`)
