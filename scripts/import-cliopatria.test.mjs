import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { importCliopatria } from './import-cliopatria.mjs'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

const polygon = (offset = 0) => ({
  type: 'Polygon',
  coordinates: [[
    [offset + 0.00049, 0.00049],
    [offset + 0.00049, 10.12349],
    [offset + 10.12349, 10.12349],
    [offset + 10.12349, 0.00049],
    [offset + 0.00049, 0.00049],
  ]],
})

const sourceFeature = ({ name, fromYear, toYear, type = 'POLITY', offset = 0 }) => ({
  type: 'Feature',
  properties: {
    Name: name,
    FromYear: fromYear,
    ToYear: toYear,
    Area: 1234.5,
    Type: type,
    Wikipedia: `${name.replaceAll(' ', '_')}`,
    Wikidata: 'Q123',
    SeshatID: type === 'POLITY' ? 'fixture_polity' : '',
    Components: type === 'RELATION' ? name : '',
    MemberOf: type === 'POLITY' ? 'Fixture sphere' : '',
  },
  geometry: polygon(offset),
})

const writeFixture = async (features) => {
  const directory = await mkdtemp(join(tmpdir(), 'chrono-globe-cliopatria-test-'))
  temporaryDirectories.push(directory)
  const inputPath = join(directory, 'cliopatria.geojson')
  await writeFile(inputPath, JSON.stringify({ type: 'FeatureCollection', features }), 'utf8')
  return { directory, inputPath }
}

describe('Cliopatria importer', () => {
  it('creates deterministic inclusive century packs and a searchable manifest', async () => {
    const fixture = await writeFixture([
      sourceFeature({ name: 'Fixture polity', fromYear: -150, toYear: 50 }),
      sourceFeature({ name: 'Fixture relation', fromYear: 95, toYear: 205, type: 'RELATION', offset: 20 }),
    ])
    const revision = 'a'.repeat(40)
    const firstOutput = join(fixture.directory, 'first')
    const secondOutput = join(fixture.directory, 'second')
    const first = await importCliopatria({ inputPath: fixture.inputPath, outputDirectory: firstOutput, revision })
    const second = await importCliopatria({ inputPath: fixture.inputPath, outputDirectory: secondOutput, revision })

    expect(first.manifest.coverage).toEqual({ startYear: -150, endYear: 205 })
    expect(first.manifest.counts).toMatchObject({
      features: 2,
      sourceFeatures: 2,
      importedFeatures: 2,
      polities: 1,
      relations: 1,
      uniqueNames: 2,
      changeYears: 2,
      packs: 5,
      packFeatureCopies: 6,
    })
    expect(first.manifest.changeYears).toEqual([-150, 95])
    expect(first.manifest.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'Fixture polity', years: [-150], firstYear: -150, lastYear: 50, datasetIds: ['cliopatria'] }),
      expect.objectContaining({ key: 'Fixture relation', years: [95], firstYear: 95, lastYear: 205, datasetIds: ['cliopatria'] }),
    ]))
    expect(first.manifest.geometry).toEqual({
      coordinatePrecision: 3,
      removedFeatures: 0,
      removedPolygons: 0,
      removedRings: 0,
      rewoundPolygons: 0,
      simplified: false,
    })

    const zeroPack = JSON.parse(await readFile(join(firstOutput, 'packs/0.geojson'), 'utf8'))
    expect(zeroPack.features).toHaveLength(2)
    expect(zeroPack.features.map((feature) => feature.properties.Type).sort()).toEqual(['POLITY', 'RELATION'])
    expect(zeroPack.features[0].geometry.type).toBe('MultiPolygon')
    expect(zeroPack.features[0].properties).toMatchObject({
      BORDERPRECISION: 1,
      datasetId: 'cliopatria',
    })
    expect(JSON.stringify(zeroPack.features[0].geometry)).not.toContain('10.12349')

    expect(second.manifest.sourceSha256).toBe(first.manifest.sourceSha256)
    expect(second.manifest.entities).toEqual(first.manifest.entities)
    const firstIds = zeroPack.features.map((feature) => feature.id)
    const secondZeroPack = JSON.parse(await readFile(join(secondOutput, 'packs/0.geojson'), 'utf8'))
    expect(secondZeroPack.features.map((feature) => feature.id)).toEqual(firstIds)
  })

  it('refuses schema drift and complete geometry loss', async () => {
    const invalidType = await writeFixture([sourceFeature({ name: 'Unknown record', fromYear: 1, toYear: 2, type: 'EVENT' })])
    await expect(importCliopatria({
      inputPath: invalidType.inputPath,
      outputDirectory: join(invalidType.directory, 'output'),
      revision: 'b'.repeat(40),
    })).rejects.toThrow('unsupported Type EVENT')

    const collapsed = sourceFeature({ name: 'Collapsed', fromYear: 1, toYear: 2 })
    collapsed.geometry.coordinates = [[[1, 1], [1, 1], [1, 1], [1, 1]]]
    const invalidGeometry = await writeFixture([collapsed])
    await expect(importCliopatria({
      inputPath: invalidGeometry.inputPath,
      outputDirectory: join(invalidGeometry.directory, 'output'),
      revision: 'c'.repeat(40),
    })).rejects.toThrow('Geometry sanitation would remove 1 complete feature')

    const outOfBounds = sourceFeature({ name: 'Off world', fromYear: 1, toYear: 2 })
    outOfBounds.geometry.coordinates[0][0] = [181, 0]
    const invalidCoordinates = await writeFixture([outOfBounds])
    await expect(importCliopatria({
      inputPath: invalidCoordinates.inputPath,
      outputDirectory: join(invalidCoordinates.directory, 'output'),
      revision: 'd'.repeat(40),
    })).rejects.toThrow('coordinates outside CRS84 bounds')
  })
})
