import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { geoArea } from 'd3-geo'
import { sanitizeHistoricalFeatures } from './historical-geometry.mjs'

const datasetId = 'cliopatria'
const sourceUrl = 'https://github.com/Seshat-Global-History-Databank/cliopatria'
const licenseUrl = 'https://creativecommons.org/licenses/by/4.0/'
const coordinatePrecision = 3
const packWidth = 100

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const jsonLine = (value) => `${JSON.stringify(value)}\n`

const stringProperty = (properties, key, position) => {
  const value = properties[key]
  if (typeof value !== 'string') throw new Error(`Feature ${position} has a non-string ${key}`)
  return value
}

const finiteNumberProperty = (properties, key, position) => {
  const value = properties[key]
  if (!Number.isFinite(value)) throw new Error(`Feature ${position} has an invalid ${key}`)
  return value
}

const roundCoordinate = (value) => Math.round(value * (10 ** coordinatePrecision)) / (10 ** coordinatePrecision)

const roundCoordinates = (value) => Array.isArray(value)
  ? value.map((child) => typeof child === 'number' ? roundCoordinate(child) : roundCoordinates(child))
  : value

const assertCoordinateBounds = (value, position) => {
  if (!Array.isArray(value)) throw new Error(`Feature ${position} contains malformed coordinates`)
  if (typeof value[0] === 'number') {
    const [longitude, latitude] = value
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      throw new Error(`Feature ${position} contains coordinates outside CRS84 bounds`)
    }
    return
  }
  for (const child of value) assertCoordinateBounds(child, position)
}

const centuryStart = (year) => Math.floor(year / packWidth) * packWidth

const sourceFeatureIdentity = (feature, properties) => sha256(JSON.stringify({
  Name: properties.Name,
  FromYear: properties.FromYear,
  ToYear: properties.ToYear,
  Type: properties.Type,
  SeshatID: properties.SeshatID,
  Wikidata: properties.Wikidata,
  MemberOf: properties.MemberOf,
  geometry: feature.geometry,
}))

const normalizeFeature = (feature, position) => {
  if (!feature || feature.type !== 'Feature' || !feature.properties) {
    throw new Error(`Record ${position} is not a GeoJSON Feature with properties`)
  }
  if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
    throw new Error(`Feature ${position} has unsupported geometry type ${feature.geometry?.type || 'null'}`)
  }
  assertCoordinateBounds(feature.geometry.coordinates, position)

  const properties = feature.properties
  const name = stringProperty(properties, 'Name', position).trim()
  if (!name) throw new Error(`Feature ${position} has an empty Name`)
  const fromYear = finiteNumberProperty(properties, 'FromYear', position)
  const toYear = finiteNumberProperty(properties, 'ToYear', position)
  const area = finiteNumberProperty(properties, 'Area', position)
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || fromYear > toYear) {
    throw new Error(`Feature ${position} has invalid inclusive years ${fromYear}–${toYear}`)
  }
  if (area <= 0) throw new Error(`Feature ${position} has a non-positive Area`)
  const type = stringProperty(properties, 'Type', position)
  if (!['POLITY', 'RELATION'].includes(type)) throw new Error(`Feature ${position} has unsupported Type ${type}`)

  const wikipedia = stringProperty(properties, 'Wikipedia', position)
  const wikidata = stringProperty(properties, 'Wikidata', position)
  const seshatId = stringProperty(properties, 'SeshatID', position)
  const components = stringProperty(properties, 'Components', position)
  const memberOf = stringProperty(properties, 'MemberOf', position)
  const sourceFeatureId = `${datasetId}-${sourceFeatureIdentity(feature, properties).slice(0, 24)}`

  return {
    type: 'Feature',
    id: sourceFeatureId,
    properties: {
      NAME: name,
      ABBREVN: null,
      CONTROL: null,
      SUBJECTO: name,
      PARTOF: memberOf || null,
      BORDERPRECISION: 1,
      FromYear: fromYear,
      ToYear: toYear,
      Area: area,
      Type: type,
      Wikipedia: wikipedia,
      Wikidata: wikidata,
      SeshatID: seshatId,
      Components: components,
      MemberOf: memberOf,
      sourceFeatureId,
      datasetId,
    },
    geometry: {
      type: feature.geometry.type,
      coordinates: roundCoordinates(feature.geometry.coordinates),
    },
  }
}

const compareFeatures = (left, right) => left.properties.FromYear - right.properties.FromYear
  || left.properties.ToYear - right.properties.ToYear
  || left.properties.Type.localeCompare(right.properties.Type)
  || left.properties.NAME.localeCompare(right.properties.NAME)
  || String(left.id).localeCompare(String(right.id))

const geometryCounts = (features) => features.reduce((totals, feature) => {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
  totals.polygons += polygons.length
  totals.rings += polygons.reduce((sum, polygon) => sum + polygon.length, 0)
  return totals
}, { polygons: 0, rings: 0 })

const buildEntityCatalog = (features) => {
  const groups = new Map()
  for (const feature of features) {
    const { NAME: name, FromYear: fromYear, ToYear: toYear } = feature.properties
    const current = groups.get(name) || {
      key: name,
      name,
      aliases: [],
      years: new Set(),
      firstYear: fromYear,
      lastYear: toYear,
      areaByYear: new Map(),
      datasetIds: [datasetId],
    }
    if (fromYear !== 0) current.years.add(fromYear)
    current.firstYear = Math.min(current.firstYear, fromYear)
    current.lastYear = Math.max(current.lastYear, toYear)
    current.areaByYear.set(fromYear, (current.areaByYear.get(fromYear) || 0) + geoArea(feature))
    groups.set(name, current)
  }

  return [...groups.values()].map((entity) => {
    const rankedAreas = [...entity.areaByYear.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])
    const [peakYear, maxArea] = rankedAreas[0]
    return {
      key: entity.key,
      name: entity.name,
      aliases: entity.aliases,
      years: [...entity.years].sort((left, right) => left - right),
      firstYear: entity.firstYear,
      lastYear: entity.lastYear,
      peakYear,
      maxArea,
      datasetIds: entity.datasetIds,
    }
  }).sort((left, right) => left.name.localeCompare(right.name))
}

const validateRevision = (kind, value) => {
  if (!['git', 'release', 'checksum'].includes(kind)) throw new Error(`Unsupported revision kind: ${kind}`)
  if (typeof value !== 'string' || !value.trim()) throw new Error('A source revision is required')
  if (kind === 'git' && !/^[0-9a-f]{40}$/i.test(value)) throw new Error('A git revision must be a full 40-character commit SHA')
}

const assertManagedPackPath = (outputDirectory, packDirectory) => {
  const output = resolve(outputDirectory)
  const pack = resolve(packDirectory)
  if (pack === output || !pack.startsWith(`${output}${sep}`) || basename(pack) !== 'packs') {
    throw new Error(`Refusing to replace unsafe pack directory: ${pack}`)
  }
}

export const importCliopatria = async ({
  inputPath,
  outputDirectory = resolve('public/data/sources/cliopatria'),
  revisionKind = 'git',
  revision,
}) => {
  if (!inputPath) throw new Error('An extracted Cliopatria GeoJSON path is required')
  validateRevision(revisionKind, revision)

  const absoluteInput = isAbsolute(inputPath) ? inputPath : resolve(inputPath)
  const absoluteOutput = isAbsolute(outputDirectory) ? outputDirectory : resolve(outputDirectory)
  const sourceBytes = await readFile(absoluteInput)
  const sourceSha256 = sha256(sourceBytes)
  let source
  try {
    source = JSON.parse(sourceBytes.toString('utf8'))
  } catch (error) {
    throw new Error(`Could not parse Cliopatria GeoJSON: ${error instanceof Error ? error.message : error}`)
  }
  if (source?.type !== 'FeatureCollection' || !Array.isArray(source.features)) {
    throw new Error('Cliopatria input must be a GeoJSON FeatureCollection')
  }
  const declaredCrs = source.crs?.properties?.name
  if (declaredCrs && declaredCrs !== 'urn:ogc:def:crs:OGC:1.3:CRS84' && declaredCrs !== 'EPSG:4326') {
    throw new Error(`Cliopatria input uses unsupported coordinate reference system: ${declaredCrs}`)
  }

  const ids = new Set()
  const normalized = source.features.map((feature, position) => {
    const next = normalizeFeature(feature, position)
    if (ids.has(next.id)) throw new Error(`Duplicate generated source feature id: ${next.id}`)
    ids.add(next.id)
    return next
  })
  normalized.sort(compareFeatures)
  const geometryBefore = geometryCounts(normalized)
  const sanitized = sanitizeHistoricalFeatures(normalized)
  if (sanitized.stats.removedFeatures > 0) {
    throw new Error(`Geometry sanitation would remove ${sanitized.stats.removedFeatures} complete feature(s); review the source before importing`)
  }

  const features = sanitized.features
  const geometryAfter = geometryCounts(features)
  const packs = new Map()
  for (const feature of features) {
    const firstPack = centuryStart(feature.properties.FromYear)
    const lastPack = centuryStart(feature.properties.ToYear)
    for (let startYear = firstPack; startYear <= lastPack; startYear += packWidth) {
      const records = packs.get(startYear) || []
      records.push(feature)
      packs.set(startYear, records)
    }
  }

  const packDirectory = join(absoluteOutput, 'packs')
  assertManagedPackPath(absoluteOutput, packDirectory)
  const stagingDirectory = join(absoluteOutput, `.packs-${process.pid}`)
  await mkdir(absoluteOutput, { recursive: true })
  await rm(stagingDirectory, { recursive: true, force: true })
  await mkdir(stagingDirectory, { recursive: true })

  const packEntries = []
  let packFeatureCopies = 0
  try {
    for (const [startYear, records] of [...packs.entries()].sort((left, right) => left[0] - right[0])) {
      records.sort(compareFeatures)
      const endYear = startYear + packWidth - 1
      const filename = `packs/${startYear}.geojson`
      const collection = {
        type: 'FeatureCollection',
        name: `Seshat Cliopatria ${startYear}–${endYear}`,
        datasetId,
        startYear,
        endYear,
        features: records,
      }
      const payload = jsonLine(collection)
      await writeFile(join(stagingDirectory, `${startYear}.geojson`), payload, 'utf8')
      const polities = records.filter((feature) => feature.properties.Type === 'POLITY').length
      const relations = records.length - polities
      packEntries.push({ startYear, endYear, filename, features: records.length, polities, relations, bytes: Buffer.byteLength(payload) })
      packFeatureCopies += records.length
    }
    await rm(packDirectory, { recursive: true, force: true })
    await rename(stagingDirectory, packDirectory)
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true })
    throw error
  }

  const polities = features.filter((feature) => feature.properties.Type === 'POLITY').length
  const relations = features.length - polities
  const coverage = {
    startYear: Math.min(...features.map((feature) => feature.properties.FromYear)),
    endYear: Math.max(...features.map((feature) => feature.properties.ToYear)),
  }
  const changeYears = [...new Set(features.map((feature) => feature.properties.FromYear).filter((year) => year !== 0))]
    .sort((left, right) => left - right)
  const entities = buildEntityCatalog(features)
  const manifest = {
    schemaVersion: 1,
    datasetId,
    title: 'Seshat Cliopatria',
    sourceFamilyId: 'seshat-cliopatria',
    source: sourceUrl,
    license: 'CC-BY-4.0',
    licenseUrl,
    revision: { kind: revisionKind, value: revision },
    scope: 'global',
    coverage,
    methodology: 'Inclusive source intervals are duplicated into 100-year packs for lazy runtime filtering. Coordinates are rounded to three decimal degrees, invalid rings are removed, winding is repaired, and no geometric simplification or cross-source fusion is performed.',
    crs: 'OGC:CRS84',
    sourceFile: basename(absoluteInput),
    sourceSha256,
    counts: {
      features: features.length,
      sourceFeatures: source.features.length,
      importedFeatures: features.length,
      polities,
      relations,
      uniqueNames: entities.length,
      changeYears: changeYears.length,
      packs: packEntries.length,
      packFeatureCopies,
    },
    geometry: {
      coordinatePrecision,
      removedFeatures: sanitized.stats.removedFeatures,
      removedPolygons: sanitized.stats.removedPolygons,
      removedRings: geometryBefore.rings - geometryAfter.rings,
      rewoundPolygons: sanitized.stats.rewoundPolygons,
      simplified: false,
    },
    changeYears,
    entities,
    packs: packEntries,
  }
  const manifestPath = join(absoluteOutput, 'manifest.json')
  const temporaryManifestPath = `${manifestPath}.tmp`
  await writeFile(temporaryManifestPath, jsonLine(manifest), 'utf8')
  await rename(temporaryManifestPath, manifestPath)

  return { manifest, manifestPath, outputDirectory: absoluteOutput }
}

const help = `Import an extracted Seshat Cliopatria GeoJSON file into lazy 100-year packs.

Usage:
  node scripts/import-cliopatria.mjs --input <cliopatria.geojson> --revision <commit> [options]

Options:
  --output <directory>       Output directory (default: public/data/sources/cliopatria)
  --revision-kind <kind>     git, release, or checksum (default: git)
  --revision <value>         Immutable source revision; full 40-character SHA for git
  --help                     Show this help
`

const main = async () => {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      output: { type: 'string' },
      revision: { type: 'string' },
      'revision-kind': { type: 'string', default: 'git' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  })
  if (values.help) {
    process.stdout.write(help)
    return
  }
  const result = await importCliopatria({
    inputPath: values.input,
    outputDirectory: values.output,
    revisionKind: values['revision-kind'],
    revision: values.revision,
  })
  const { counts, coverage, geometry } = result.manifest
  process.stdout.write(
    `Imported ${counts.importedFeatures} Cliopatria intervals (${counts.polities} polities, ${counts.relations} relations) `
    + `covering ${coverage.startYear}–${coverage.endYear} into ${counts.packs} packs. `
    + `Geometry: ${geometry.rewoundPolygons} polygon(s) rewound, ${geometry.removedPolygons} polygon(s), `
    + `${geometry.removedRings} ring(s), and ${geometry.removedFeatures} feature(s) removed.\n`
    + `Manifest: ${relative(resolve(), result.manifestPath) || result.manifestPath}\n`,
  )
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`)
    process.exitCode = 1
  })
}
