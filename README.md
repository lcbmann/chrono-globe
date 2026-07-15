# Chrono Globe

Chrono Globe is an interactive, data-driven historical atlas. Rotate the Earth, choose a reconstruction on the timeline, and inspect the territories, cultures, and political entities represented at that moment.

This is a ground-up successor to a 2024 prototype that painted each historical state onto a full-size globe texture. The new version keeps physical geography and historical geography separate: the Earth is rendered once, while every changing territory is an ordinary GeoJSON feature. Adding a year no longer requires Photoshop.

## What it does

- Shows 53 worldwide source reconstructions from 123,000 BCE to 2010 CE on a readable, decade-scale historical cursor.
- Starts at 323 BCE, preserving the original project's focus on Macedon and Alexander's empire.
- Supports drag, zoom, click-to-inspect, alias-aware all-history civilization search, keyboard navigation, direct year entry, and stable timeline playback.
- Displays all named territories in a reconstruction simultaneously.
- Includes broad, globally distributed educational profiles, contextual facts, reading links, and geolocated historical-event markers.
- Adds curated public-domain and Creative Commons imagery to major profiles, plus date-specific flags, standards, and ensigns where the historical evidence supports them.
- Compares two arbitrary timeline years side by side and summarizes appeared, disappeared, expanded, contracted, and changed-control entities.
- Provides guided stories that move the date, camera, highlighted civilization, and historical moment together.
- Adds time-aware capitals, cities, archaeological sites, trade networks, migrations, and expedition routes as optional layers.
- Gives each indexed entity a mapped chronology with first, largest, and last appearances plus focused playback.
- Preserves the selected year, entity, event, globe appearance, comparison, layers, story step, and camera in a shareable URL.
- Offers region, era, entity-type, and curated-profile discovery filters.
- Keeps creator, source-file, and license attribution beside every reused image; missing remote previews fall back to the source page without breaking the explorer.
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
| `npm run data:validate` | Validate map files, index counts, aliases, event/story references, layer records, and source URLs |
| `npm run test` | Run unit tests |
| `npm run lint` | Run Oxc lint checks |
| `npm run build` | Type-check and build the production app |
| `npm run check` | Validate data, lint, test, and create the production build |

## How the timeline works

Historical borders are not available for every individual year. The slider moves in decade steps from 1000 BCE onward (with wider steps in deep history) and also includes exact source dates and featured historical moments. Between two source reconstructions, Chrono Globe progressively blends the outgoing and incoming extents. This makes expansion, contraction, division, and disappearance easier to follow, but the blended shapes are explicitly presented as a visual transition rather than an invented annual border record.

At runtime the app:

1. Loads the lightweight local snapshot index.
2. Resolves the selected historical year to the surrounding source maps, fetching and caching the two GeoJSON files needed for the transition.
3. Groups map regions by their `SUBJECTO`/`PARTOF` political identity.
4. assigns a stable or editorially chosen color to that identity across time;
5. projects the vector polygons directly onto the globe.

The generated index also records each entity's first, last, and largest mapped appearance. This powers global search: selecting a civilization outside the current reconstruction jumps to its strongest available map and centers the globe.

Change mode compares the spherical area grouped under each stable entity key. A change is categorized as an appearance, disappearance, material expansion or contraction, or a recorded control change. It is a map-to-map comparison—not a claim about population, power, or every event between the two source dates.

## Guided stories, layers, and links

Guided stories live in `src/data/stories.ts`; their event references are checked automatically. Time-aware place and route records live in `src/data/layers.ts`. Routes deliberately connect representative waypoints and should not be treated as precise tracks or exhaustive networks.

The URL is part of the user interface. Opening a shared link reconstructs the selected date, entity or event, comparison year, active layers, story step, globe mode, and camera. No server-side account or saved state is required.

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
- A code-split WebGL renderer so the interface shell can load independently of Three.js
- GeoJSON for historical territories
- TopoJSON for the permanent land silhouette
- Vitest for data-model utilities
- GitHub Actions for verified GitHub Pages builds

No database or backend is required. A static host is enough.

## Contributing

Application fixes and visual improvements are welcome here. Historical boundary corrections should normally be proposed to Historical Basemaps first, then imported with `npm run data:sync`. New dates require a sourced GeoJSON reconstruction; Chrono Globe does not synthesize annual borders or population estimates from neighboring maps. See [CONTRIBUTING.md](CONTRIBUTING.md).
