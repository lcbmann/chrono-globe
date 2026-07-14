import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outputDirectory = join(root, 'public', 'data')
const mapDirectory = join(outputDirectory, 'maps')
const sourceRepository = 'aourednik/historical-basemaps'
const sourceBase = `https://raw.githubusercontent.com/${sourceRepository}/master`

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
  ['Monte Alb�n', 'Monte Albán'],
  ['Teotihuac�n', 'Teotihuacán'],
])

const cleanText = (value) => {
  if (typeof value !== 'string') return value
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return knownTextRepairs.get(cleaned) || cleaned || null
}

const sourceIndex = await downloadJson(`${sourceBase}/index.json`)
const maps = []

for (const [position, item] of sourceIndex.years.entries()) {
  const map = await downloadJson(`${sourceBase}/geojson/${item.filename}`)

  for (const feature of map.features) {
    if (!feature.properties) continue
    for (const key of ['NAME', 'ABBREVN', 'CONTROL', 'SUBJECTO', 'PARTOF']) {
      feature.properties[key] = cleanText(feature.properties[key])
    }
  }

  const filename = `${item.year}.geojson`
  await writeFile(join(mapDirectory, filename), `${JSON.stringify(map)}\n`, 'utf8')

  const namedFeatures = map.features.filter((feature) => feature.properties?.NAME)
  maps.push({
    year: item.year,
    filename: `maps/${filename}`,
    entities: new Set(namedFeatures.map((feature) => feature.properties.NAME)).size,
    features: namedFeatures.length,
  })

  process.stdout.write(`\rSynced ${position + 1}/${sourceIndex.years.length} historical maps`)
}

const commitResponse = await fetch(`https://api.github.com/repos/${sourceRepository}/commits/master`, {
  headers: { Accept: 'application/vnd.github+json' },
})
const commit = commitResponse.ok ? await commitResponse.json() : null

await copyFile(
  join(root, 'node_modules', 'world-atlas', 'land-110m.json'),
  join(outputDirectory, 'land-110m.json'),
)

await writeFile(
  join(outputDirectory, 'index.json'),
  `${JSON.stringify(
    {
      maps,
      updatedAt: new Date().toISOString(),
      source: `https://github.com/${sourceRepository}`,
      sourceCommit: commit?.sha ?? null,
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
