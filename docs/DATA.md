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

## Territory properties

| Property | Meaning |
| --- | --- |
| `NAME` | Display name for the mapped region |
| `ABBREVN` | Short source label, when present |
| `SUBJECTO` | Larger political entity used for grouping and stable color |
| `PARTOF` | Cultural or political parent |
| `CONTROL` | Controlling power, when distinct |
| `BORDERPRECISION` | `1` approximate, `2` moderately precise, `3` legally documented |

The upstream files contain both `Polygon` and `MultiPolygon` geometries. Empty names are excluded from the interactive territory index but their source geometry is preserved.

## Refreshing the data

Run:

```powershell
npm run data:sync
npm run check
```

The sync script downloads the upstream index and every referenced GeoJSON file, converts legacy Windows-1252 text to UTF-8 when necessary, trims property values, copies the Natural Earth land topology, and records the upstream commit SHA.

Review the resulting diff before committing. A source update can change names, geometry, counts, or the set of available years.

## Adding a different source

Do not turn new maps into globe textures. Normalize them to GeoJSON, preserve source and license metadata, map their attributes to the properties above, and add the snapshot to the index. The globe renderer does not care how the polygon was authored.
