# Historical data model

Chrono Globe keeps the source data human-readable and replaceable. Each reconstruction is a GeoJSON `FeatureCollection` in `public/data/maps`, and `public/data/index.json` tells the app which snapshots exist.

## Snapshot index

Each index entry has:

```json
{
  "year": -323,
  "filename": "maps/-323.geojson",
  "entities": 75,
  "features": 75
}
```

Negative years are BCE; positive years are CE. There is no year zero in the user interface.

The index also contains a generated `entities` catalog. Each entry records the political key, regional aliases, source-map years, first and last appearance, largest mapped year, and maximum spherical area. It powers all-history search and visual-prominence estimates; it is not a population dataset.

## Territory properties

| Property | Meaning |
| --- | --- |
| `NAME` | Name for the individual mapped region |
| `ABBREVN` | Short source label, when present |
| `SUBJECTO` | Larger political identity used for grouping, display, and stable color |
| `PARTOF` | Cultural or political parent |
| `CONTROL` | Controlling power, when distinct |
| `BORDERPRECISION` | `1` approximate, `2` moderately precise, `3` legally documented |

The upstream files contain both `Polygon` and `MultiPolygon` geometries. Empty names are excluded from the interactive territory index but their source geometry is preserved.

The political identity is resolved as `SUBJECTO`, then `PARTOF`, then `NAME`. This distinction is important: a region such as the Bosporan Kingdom may be represented as subject to the Roman Empire. Its polygon metadata retains the regional name, while selection and education surfaces consistently identify the grouped polity as the Roman Empire.

## Refreshing the data

Run:

```powershell
npm run data:sync
npm run data:validate
npm run check
```

The sync script downloads the upstream index and every referenced GeoJSON file, converts legacy Windows-1252 text to UTF-8 when necessary, trims property values, copies the Natural Earth land topology, and records the upstream commit SHA.

Review the resulting diff before committing. A source update can change names, geometry, counts, or the set of available years.

`data:validate` checks all 53 GeoJSON files against the generated index, then verifies curated profile aliases, event and story references, optional-layer records, duplicate identifiers, and source URL syntax. It intentionally does not make network requests, so CI remains deterministic.

## Civilization media

Curated profile media lives in `src/data/civilizationMedia.ts`. Every record names the original Wikimedia Commons file, descriptive alternative text, a factual caption, the credited creator, and a public-domain or Creative Commons license link. The UI builds a Commons thumbnail URL at runtime and keeps full attribution visible beneath the image.

Flags are only shown with explicit period context. For societies without a well-supported flag, Chrono Globe either presents a documented standard or ensign under that label, or shows no symbol at all. Modern national flags must not be projected backward onto ancient and medieval entities.

The data validator checks media aliases against curated civilization profiles, rejects duplicate file records, and limits media to supported web-image formats. It does not make network requests; unavailable remote previews degrade to a link to the source file.

## Educational overlay data

`src/data/events.ts` contains dated point events. `src/data/layers.ts` contains time-bounded capitals, cities, archaeological sites, trade networks, migrations, and expeditions. `src/data/stories.ts` composes existing events and entities into guided sequences.

Every curated record requires:

- a stable identifier;
- a documented active date or date range;
- coordinates or representative route waypoints;
- cautious educational copy;
- a source title and HTTPS URL.

Routes are schematic. A route line should be described as a connection between representative waypoints, not a surveyed historical track. Large multi-generational movements must not be presented as a single journey.

## Adding denser reconstructions

Actual territorial growth can only become more accurate by adding more sourced maps. Do not manufacture an intermediate polygon by treating a visual blend as evidence.

For a new reconstruction:

1. Obtain a license-compatible, cited GeoJSON source for the target date.
2. Normalize its properties to the schema above and retain its provenance.
3. Add the file to `public/data/maps` and its date to `public/data/index.json`.
4. Rebuild the entity catalog and area metadata using the sync workflow.
5. Run `npm run data:validate` and visually compare both adjacent transitions.

High-change periods such as 334–323 BCE, 1206–1279 CE, 1492–1700 CE, 1914–1945 CE, and postwar decolonization are the most valuable targets for additional maps—but only when a defensible reconstruction is available.

## Adding a different source

Do not turn new maps into globe textures. Normalize them to GeoJSON, preserve source and license metadata, map their attributes to the properties above, and add the snapshot to the index. The globe renderer does not care how the polygon was authored.
