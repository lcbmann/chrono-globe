# Chrono Globe

Chrono Globe is an interactive, data-driven historical atlas. Rotate the Earth, choose a reconstruction on the timeline, and inspect the territories, cultures, and political entities represented at that moment.

This is a ground-up successor to a 2024 prototype that painted each historical state onto a full-size globe texture. The new version keeps physical geography and historical geography separate: the Earth is rendered once, while every changing territory is an ordinary GeoJSON feature. Adding a year no longer requires Photoshop.

## What it does

- Shows 53 worldwide source reconstructions from 123,000 BCE to 2010 CE on a readable, decade-scale historical cursor.
- Starts at 323 BCE, preserving the original project's focus on Macedon and Alexander's empire.
- Supports drag, zoom, click-to-inspect, all-history civilization search, keyboard navigation, direct year entry, and stable timeline playback.
- Displays all named territories in a reconstruction simultaneously.
- Includes curated educational profiles, contextual facts, reading links, and geolocated historical-event markers.
- Switches between a stylized atlas and a realistic NASA Blue Marble Earth.
- Uses historically associated colors and stronger visual prominence for major polities.
- Starts with subtle ambient audio after the visitor's first interaction, with a prominent mute control.
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

Historical borders are not available for every individual year. The slider moves in decade steps from 1000 BCE onward (with wider steps in deep history), but holds the latest available source map until the next reconstruction. When that map changes, the outgoing globe dissolves over the incoming one instead of blanking or rebuilding on screen. This makes growth and change readable while avoiding invented annual borders. Exact source moments such as 323 BCE remain selectable.

At runtime the app:

1. Loads the lightweight local snapshot index.
2. Resolves the selected historical year to the latest available source map and fetches that GeoJSON file only when it changes.
3. Groups map regions by their `SUBJECTO`/`PARTOF` political identity.
4. assigns a stable or editorially chosen color to that identity across time;
5. projects the vector polygons directly onto the globe.

The generated index also records each entity's first, last, and largest mapped appearance. This powers global search: selecting a civilization outside the current reconstruction jumps to its strongest available map and centers the globe.

See [docs/DATA.md](docs/DATA.md) for the schema and update workflow.

## Historical accuracy

Chrono Globe is an exploratory overview, not a definitive historical authority. Ancient power was often overlapping, seasonal, tributary, or culturally defined; a crisp modern border can be the wrong visual language. The interface exposes the source dataset's three boundary-precision levels and explains this limitation in the product.

For academic, legal, or politically sensitive use, verify a region against specialist sources. Corrections are best contributed upstream so every project using the dataset benefits.

## Data and attribution

Historical polygons come from [Historical Basemaps](https://github.com/aourednik/historical-basemaps) by Alexandre Ourednik and contributors, licensed under GPL-3.0. The project describes itself as work in progress and asks users to verify maps before academic use.

The physical land silhouette is derived from [Natural Earth](https://www.naturalearthdata.com/) through the [`world-atlas`](https://github.com/topojson/world-atlas) TopoJSON package. Natural Earth data is in the public domain; `world-atlas` is ISC licensed.

Realistic mode uses locally vendored [NASA Blue Marble](https://science.nasa.gov/earth/earth-observatory/history-of-the-blue-marble/) Earth imagery and a terrain bump texture distributed with the [`three-globe`](https://github.com/vasturiano/three-globe) examples. NASA imagery is used under NASA's [media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/); NASA does not endorse this project.

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
