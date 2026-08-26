# Historical data model

Chrono Globe keeps source data human-readable, replaceable, and independently attributable. Complete broad reconstructions live in `public/data/maps`; interval-based source packs live under `public/data/sources`; and `public/data/index.json` registers each territory collection. A reconstruction date is not an independent dataset.

## Snapshot index

Each index entry has:

```json
{
  "year": -323,
  "filename": "maps/-323.geojson",
  "entities": 75,
  "features": 75,
  "datasetId": "historical-basemaps"
}
```

Negative years are BCE; positive years are CE. There is no year zero in the user interface.

The index also contains a generated `entities` catalog. Each entry records the political key, regional aliases, source-map years, first and last **mapped** appearance, largest mapped year, and maximum spherical area. Those endpoints describe observations in the available reconstructions, not independently sourced foundation or dissolution dates. The catalog powers all-history search and visual-prominence estimates; it is not a population dataset.

## Territory dataset registry

Schema version 2 adds a territory-source registry. `territoryDatasets` records provenance separately from the dated snapshot list:

```json
{
  "id": "historical-basemaps",
  "title": "Historical Basemaps",
  "sourceFamilyId": "historical-basemaps",
  "source": "https://github.com/aourednik/historical-basemaps",
  "license": "GPL-3.0",
  "licenseUrl": "https://www.gnu.org/licenses/gpl-3.0.html",
  "revision": { "kind": "git", "value": "<40-character commit>" },
  "scope": "global",
  "coverage": { "startYear": -123000, "endYear": 2010 },
  "methodology": "Source-authored dated world reconstructions normalized to GeoJSON."
}
```

The stable `id` links snapshots to provenance. `sourceFamilyId` identifies datasets derived from the same underlying work, so mirrors or repackagings cannot later be counted as independent corroboration. `revision` must pin a reproducible Git commit, named release, or checksum. `scope` is `global`, `regional`, or `entity`; `coverage` records the dataset's declared usable year range, while `methodology` is a concise disclosure rather than a machine-inferred claim.

`defaultTerritoryDatasetId` identifies the broad fallback reconstruction. The legacy top-level `source`, `sourceCommit`, and `license` fields remain temporarily for compatibility and must exactly match that default registry entry. Registering a dataset never silently blends its polygons into another source.

## Interval territory packs

Seshat Cliopatria is stored in lazy 100-year packs under `public/data/sources/cliopatria`. One source assertion can appear in two adjacent packs when its inclusive validity interval crosses a century boundary. The runtime loads one pack, filters records with `FromYear <= selectedYear <= ToYear`, and hides `RELATION` records by default to avoid drawing overlapping alliances and composite relationships as ordinary states.

The manifest records the pinned revision, source SHA-256, license, 508 real change dates, searchable entity history, per-pack counts and byte sizes, and geometry-repair statistics. The 165 MB upstream GeoJSON becomes roughly 67 MB of lazy runtime data; a visitor downloads only the relevant period. Modern packs are intentionally cached in a two-file window to constrain browser memory.

The runtime commits the broad fallback, filtered interval assertions, and time-aware overlays as one dated frame. While another century pack is loading, the last complete frame stays interactive; playback cannot advance until the replacement frame has rendered. This prevents stale and newly requested territory geometry from appearing together.

The Layers dialog offers:

- **Combined atlas:** broad global coverage plus reviewed, time-scoped detailed replacements; unmatched second-source assertions remain selectable boundary outlines rather than overlapping fills;
- **Detailed polities:** Cliopatria only, showing active component polities instead of drawing a composite union over those same components;
- **Broad reconstruction:** Historical Basemaps only.

Feature-level names are joined when they match after Unicode/whitespace normalization or appear in the small reviewed, time-scoped identity registry. This registry currently covers high-confidence source variants such as Alexander's empire, ancient Armenia, the Mauryan Empire, and the Seleucid state. Discovery aliases, `SUBJECTO`, `MemberOf`, and shared Seshat identifiers are not treated as proof of identity because they can describe controllers, components, successors, or names reused in another era.

Cliopatria composite assertions are identified through their explicit `Components`/`MemberOf` graph. The combined overview uses one aggregate level; the detailed-only view uses the active components. Raw source assertions and provenance remain unchanged in the bundled packs.

## Territory properties

| Property | Meaning |
| --- | --- |
| `NAME` | Name for the individual mapped region |
| `ABBREVN` | Short source label, when present |
| `SUBJECTO` | Larger political identity used for grouping, display, and stable color |
| `PARTOF` | Cultural or political parent |
| `CONTROL` | Controlling power, when distinct |
| `BORDERPRECISION` | `1` approximate, `2` moderately precise, `3` legally documented |

The upstream files contain both `Polygon` and `MultiPolygon` geometries. Local runtime snapshots retain only features with usable names because unnamed geometry cannot be identified or explained by the interface and was already discarded before rendering. Coordinates are rounded to five decimal places—far more spatial precision than these approximate historical reconstructions claim—without polygon simplification.

The political identity is resolved as `SUBJECTO`, then `PARTOF`, then `NAME`. This distinction is important: a region such as the Bosporan Kingdom may be represented as subject to the Roman Empire. Its polygon metadata retains the regional name, while selection and education surfaces consistently identify the grouped polity as the Roman Empire.

## Refreshing the data

Run:

```powershell
npm run data:sync
npm run data:validate
npm run check
```

The current Historical Basemaps adapter resolves and pins one upstream commit before downloading the index and every referenced GeoJSON file, so one refresh cannot mix revisions. It converts legacy Windows-1252 text to UTF-8 when necessary, trims and explicitly repairs known damaged property values, removes unusable unnamed features, copies the Natural Earth land topology, and records the pinned commit in both the registry and compatibility fields.

Entity chronology and spherical-area metadata are calculated from the cleaned full-precision geometry. Coordinate rounding happens only afterward, immediately before the smaller runtime snapshots are written.

Review the resulting diff before committing. A source update can change names, geometry, counts, or the set of available years.

`data:validate` checks all 53 broad GeoJSON files and all registered Cliopatria packs, requires every snapshot to reference a registered territory dataset, validates dataset IDs, source families, HTTPS sources, licenses, scope, methodology, immutable revisions, manifest counts, file sizes, interval-to-pack membership, unique source IDs, and geometry. It independently recomputes each broad snapshot's feature and unique-name counts, then reconstructs every canonical entity's chronology and alias set from the map files and requires the generated catalog to match exactly. It also checks curated profile aliases, event and story entity references, optional-layer records, duplicate identifiers, and HTTPS source URLs.

Vitest adds semantic checks for curated events, places, routes, stories, profiles, and freely licensed media: valid date ranges and coordinates, exact story-to-event years, complete educational copy, unique identifiers and aliases, and attribution metadata. Both checks are offline and deterministic, so CI does not depend on source-site availability.

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
5. Run `npm run data:validate` and visually compare both adjacent snapshots.

High-change periods such as 334–323 BCE, 1206–1279 CE, 1492–1700 CE, 1914–1945 CE, and postwar decolonization are the most valuable targets for additional maps—but only when a defensible reconstruction is available.

## Adding a different source

Do not turn new maps into globe textures. Before importing geometry:

1. Confirm that the source license permits redistribution and use alongside the application. A citation without compatible data rights is not enough.
2. Create a registry entry with a stable ID, underlying source family, immutable revision, scope, coverage, and methodology note.
3. Build a source-specific adapter rather than extending another source's cleanup rules by accident.
4. Normalize its geometry to GeoJSON and retain the source's own feature identifier wherever possible.
5. Link every emitted snapshot to its registry entry with `datasetId`.

Every additional source must define an explicit selection or composition rule. Registering several sources must never silently union, average, or vote their conflicting boundaries into one polygon. Sources that map direct rule, tribute, claims, influence, or cultural extent are not interchangeable even when their dates and names match.
