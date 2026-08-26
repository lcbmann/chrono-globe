# Seshat Cliopatria import

Chrono Globe vendors a normalized copy of [Seshat Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria), a global interval-based polity dataset. The imported release is v0.2.0 at commit `ad28a691b7c07c1fca89d0e0636d324667d2a258`, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Cliopatria is an additional territorial assertion source. It does not silently overwrite Historical Basemaps, and its supra-polity `RELATION` records remain tagged separately from `POLITY` records. The interface hides relations by default.

Some `POLITY` records form explicit hierarchies: a parenthesized composite lists `Components`, while its member records point back through `MemberOf`. Rendering both levels as filled polygons duplicates the same land. Chrono Globe therefore shows the composite level in the combined overview and the component level in Detailed polities. Unmatched Cliopatria assertions are boundary outlines in the combined overview and remain fully selectable; switching to Detailed polities shows their fills.

## Rebuilding the local packs

Download the pinned source outside the repository and extract it. On PowerShell:

```powershell
$revision = 'ad28a691b7c07c1fca89d0e0636d324667d2a258'
$work = Join-Path $env:TEMP 'chrono-globe-cliopatria'
New-Item -ItemType Directory -Force -Path $work | Out-Null
Invoke-WebRequest "https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/$revision/cliopatria.geojson.zip" -OutFile "$work/cliopatria.geojson.zip"
tar -xf "$work/cliopatria.geojson.zip" -C $work
node --max-old-space-size=3072 scripts/import-cliopatria.mjs --input "$work/cliopatria_polities_only.geojson" --revision $revision
```

The importer writes `public/data/sources/cliopatria/manifest.json` and 100-year GeoJSON packs under `public/data/sources/cliopatria/packs`. Use `--output <directory>` for a non-repository staging run. A full 40-character commit SHA is required when the revision kind is `git`, preventing an unpinned source refresh.

Run the focused importer tests and the complete repository checks afterward:

```powershell
npx vitest run scripts/import-cliopatria.test.mjs
npm run check
```

## Normalization contract

- Every inclusive `FromYear`–`ToYear` record is copied into each 100-year pack it intersects. At runtime the selected pack is filtered back to the exact interval.
- `POLITY` and `RELATION` records are both retained and remain distinguishable through `Type`.
- Original `Wikipedia`, `Wikidata`, `SeshatID`, `Components`, `MemberOf`, `Area`, `FromYear`, and `ToYear` values are preserved.
- Each record receives a deterministic source-feature identifier and `datasetId: "cliopatria"`.
- Coordinates are rounded to three decimal degrees, rings are checked, and winding is repaired for the globe renderer. No polygon simplification or cross-source geometry fusion occurs.
- Because Cliopatria does not supply per-feature boundary confidence, every imported boundary is conservatively marked approximate (`BORDERPRECISION: 1`).
- The compact manifest contains all entity names, source change years, interval coverage, checksums, pack counts, and geometry-repair counts so search and timelines do not need to load every polygon pack.

The v0.2.0 import contains 13,765 intervals: 13,380 polity records and 385 relationship records covering 3,400 BCE through 2024 CE. It produces 55 packs, 1,633 searchable names, and 508 distinct source change years. Ring sanitation rewinds 4,185 polygon parts, drops 54 inner rings that collapse at the declared coordinate precision, and removes no complete polygon or feature.

## Update review

Cliopatria uses release versioning and may change its schema. The importer intentionally stops on unknown record types, missing required fields, invalid ranges, unsupported geometry, duplicate generated identifiers, or any complete feature that geometry sanitation would discard. When adopting another release, review the manifest and generated-data diff, compare representative ancient and modern years in the browser, and update this document's pinned revision and measured counts.
