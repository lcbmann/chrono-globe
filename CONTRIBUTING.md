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
