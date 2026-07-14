# Chrono Globe

Chrono Globe is an interactive, data-driven historical atlas. Rotate the Earth, choose a reconstruction on the timeline, and inspect the territories, cultures, and political entities represented at that moment.

This is a ground-up successor to a 2024 prototype that painted each historical state onto a full-size globe texture. The new version keeps physical geography and historical geography separate: the Earth is rendered once, while every changing territory is an ordinary GeoJSON feature. Adding a year no longer requires Photoshop.

## What it does

- Shows 53 worldwide reconstructions from 123,000 BCE to 2010 CE.
- Starts at 323 BCE, preserving the original project's focus on Macedon and Alexander's empire.
- Supports drag, zoom, click-to-inspect, territory search, keyboard navigation, direct year entry, and timeline playback.
- Displays all named territories in a reconstruction simultaneously.
- Carries boundary-confidence metadata into the interface.
- Loads every map locally after the data sync; the published app does not depend on a live map API.
- Uses a responsive, accessible React interface and a WebGL globe with a permanent vector land silhouette.

## Run it locally

```powershell
npm install
npm run data:sync
npm run dev
```

Then open `http://localhost:5173`.

The repository includes the synced data used by the deployed app. Run `npm run data:sync` only when refreshing it from upstream.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run data:sync` | Download, normalize, and locally vendor every historical snapshot |
| `npm run test` | Run unit tests |
| `npm run lint` | Run Oxc lint checks |
| `npm run build` | Type-check and build the production app |
| `npm run check` | Run lint, tests, and the production build |

## How the timeline works

Historical borders are not available for every individual year. The slider moves across the 53 source reconstructions rather than pretending that unsupported annual data exists. Entering a year such as `359 BCE` chooses the nearest available reconstruction and shows exactly which snapshot is active.

At runtime the app:

1. Loads the lightweight local snapshot index.
2. Fetches only the selected GeoJSON file.
3. Groups map regions by their `SUBJECTO`/`PARTOF` political identity.
4. assigns a stable color to that identity across time;
5. projects the vector polygons directly onto the globe.

See [docs/DATA.md](docs/DATA.md) for the schema and update workflow.

## Historical accuracy

Chrono Globe is an exploratory overview, not a definitive historical authority. Ancient power was often overlapping, seasonal, tributary, or culturally defined; a crisp modern border can be the wrong visual language. The interface exposes the source dataset's three boundary-precision levels and explains this limitation in the product.

For academic, legal, or politically sensitive use, verify a region against specialist sources. Corrections are best contributed upstream so every project using the dataset benefits.

## Data and attribution

Historical polygons come from [Historical Basemaps](https://github.com/aourednik/historical-basemaps) by Alexandre Ourednik and contributors, licensed under GPL-3.0. The project describes itself as work in progress and asks users to verify maps before academic use.

The physical land silhouette is derived from [Natural Earth](https://www.naturalearthdata.com/) through the [`world-atlas`](https://github.com/topojson/world-atlas) TopoJSON package. Natural Earth data is in the public domain; `world-atlas` is ISC licensed.

The application code is GPL-3.0-or-later so the historical data and the software can be redistributed together under compatible terms. See [LICENSE](LICENSE).

## Architecture

- React + TypeScript + Vite
- `react-globe.gl` / Three.js for rendering and interaction
- GeoJSON for historical territories
- TopoJSON for the permanent land silhouette
- Vitest for data-model utilities
- GitHub Actions for verified GitHub Pages builds

No database or backend is required. A static host is enough.

## Contributing

Application fixes and visual improvements are welcome here. Historical boundary corrections should normally be proposed to Historical Basemaps first, then imported with `npm run data:sync`. See [CONTRIBUTING.md](CONTRIBUTING.md).
