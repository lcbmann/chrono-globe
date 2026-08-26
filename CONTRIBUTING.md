# Contributing

Thanks for helping improve Chrono Globe.

## Application changes

1. Create a focused branch.
2. Run `npm install` and `npm run data:sync` if the local data is missing.
3. Make the smallest coherent change.
4. Run `npm run check`.
5. Describe visual changes and historical-data changes separately in the pull request.

## Historical corrections

The map data is shared infrastructure. Please propose factual or geometric corrections to [Historical Basemaps](https://github.com/aourednik/historical-basemaps) first. Once accepted upstream, refresh this repository with `npm run data:sync`.

If a local override is genuinely needed, document its sources and reasoning next to the data. Never present an uncertain reconstruction as a surveyed boundary.

## Additional territory datasets

New boundary sources must have redistribution-compatible terms and a reproducible revision. Give each independent source a stable `datasetId` and `sourceFamilyId`, normalize it through its own importer, and make the main index builder preserve the emitted manifest's registry metadata. Repackagings derived from the same underlying atlas share a source family and must not be presented as independent agreement.

Keep new source geometry separate until the application has an explicit source-selection or composition rule. Do not automatically union, average, or interpolate conflicting reconstructions, and do not treat direct rule, tribute, claims, influence, and cultural extent as equivalent boundaries.
