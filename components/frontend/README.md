# Taxi Manager frontend

React + Vite + TypeScript dashboard for a university NYC taxi-demand forecasting project.

## Current increment

Demand Explorer, geographic coverage, and deterministic data services are implemented:

- Demand Explorer (`/explorer`) and Overview (`/overview`) routes, shared responsive navigation.
- Tailwind styling and local shadcn-style Button/Card components.
- A shared MapLibre map using 69 real Manhattan taxi-zone polygons stored locally.
- Click/hover interactions, selected-zone outline, zoom-to-zone, Back to All Zones, reset, zoom controls.
- An accessible zone selector with unique IDs, including the three island zones.
- A replaceable zone service adapter and TanStack Query loading/error/retry handling.
- Strict TypeScript and tests for geography and the service boundary.
- Deterministic zone-hour demand and separate shared Manhattan weather fixtures.
- Typed clock, demand, weather, summary, and evaluation service contracts.
- Correct New York daylight-saving intervals, partial observation handling, and
  aggregation/evaluation calculations tested independently of the views.
- Demand Explorer date picker, previous/next/Today navigation, and synchronized zone/hour filters.
- Recharts hourly graph with full-height clickable intervals and keyboard selection.
- Daily observed/predicted map toggle with a shared scale across dates and metrics.
- Daily statistics/weather by default; optional hourly information with completed-only comparisons.

Demand Explorer and Overview are functional. Overview includes 7/30-day and custom
ranges, demand trends, zone-hour MAE/WAPE, daily error, and linked rankings/map.
Docker and Kubernetes remain pending.
The original source datasets are not modified or bundled.

## Develop

Use Node 22.13+ (or Node 24+); `.nvmrc` selects the already-installed Node 22.23.2.
An older Homebrew Node may take precedence in your shell; check `node --version`.

```sh
cd frontend
nvm use               # if using nvm; nvm install if the selected version is absent
npm ci
npm run dev
```

Open the local URL printed by Vite. Neither a backend nor a map token is required.
All geometry and MapLibre worker code are served by Vite or the built application.
The data services use a fixed January 15, 2025, 17:30 New York demo time. To change
it, copy `.env.example` to `.env.local`, edit `VITE_DEMO_NOW`, and restart Vite.
There is no running replay or live-data infrastructure.

```sh
npm test
npm run lint
npm run build
npm run preview
```

The production output is `dist/`. A future production static server must return
`index.html` for SPA paths such as `/explorer` and `/overview`.

## How it works

### App and presentation

- `main.tsx` creates one QueryClient and supplies it and BrowserRouter to React.
- `App` defines the two page routes and redirects unknown paths to Demand Explorer.
- `AppLayout` renders shared navigation, a skip-to-content link, and the route outlet.
- `DemandExplorer` loads the fixed demo clock, then renders synchronized date,
  zone, and interval selections with service-backed map/chart/weather data.
  `Overview` connects one applied range to aggregate cards, demand/error charts,
  completed-observation rankings, and the shared geographic map.
- `Button` uses Radix Slot for link/button composition and shared variant styling.
  `Card` supplies consistent panel styling. `cn` combines conditional classes and
  resolves conflicting Tailwind utilities.

### Geographic data flow

1. `useZones` requests the Manhattan geometry through `zoneService.getZones`.
   TanStack Query caches the static data across both routes and forwards cancellation.
2. `getZones` retrieves the local GeoJSON, checks HTTP status, then calls `parseZones`.
3. `parseZones` rejects malformed collections, duplicate/inconsistent IDs, invalid
   properties, and invalid coordinate arrays before data reaches the map.
4. Demand Explorer owns date/zone/optional-hour selection. Overview owns an applied
   date range and a separate geographic highlight. Both reuse `ZoneSelector` and
   `TaxiZoneMap`; Overview highlights do not filter its Manhattan-wide statistics.
5. `TaxiZoneMap` creates/destroys MapLibre, its popup, event handlers, and resize
   observer with React's lifecycle. Selection changes update the outline and camera;
   the parent still owns the selected ID. Reduced-motion preferences skip animation.
   A locally bundled worker processes the GeoJSON. Hover content is inserted as
   text, not interpreted as HTML. If WebGL fails, selection remains available.
6. `getZoneBounds` computes the camera bounds from all vertices and polygon parts,
   so multipart zones and islands are included rather than silently omitted.

### Preparing source data

`python3 scripts/prepare-zones.py CITY.geojson TLC.zip LOOKUP.csv` prepares the
static asset. `read_dbf` extracts the original shapefile attributes using Python's
standard library. `main` matches polygons to those attributes, joins lookup names,
checks that IDs are unique and complete, then writes the local GeoJSON. It preserves
the official coordinates. See `public/data/README.md` for source URLs and the
explanation of restoring island IDs 104/105 from the original TLC attributes.

## Future service integration

`src/services/index.ts` exports the configured `zoneService`, `clockService`,
`demandService`, and `weatherService`. Their Promise-based contracts accept
optional abort signals and can be replaced with HTTP adapters at that composition
point. `useExplorerData` connects these services to Demand Explorer without
importing mock generators into UI components. `useOverviewData` calls the existing
range-summary service for all analytical views. Daily summary rows also include
zone-hour evaluation metrics for the daily MAE chart.

See [Data services and calculations](docs/data-services.md) for request/response
contracts, example usage, observation states, units, eligibility rules, timezone
behavior, and a function-by-function explanation of this increment. The frontend
will communicate with an HTTP API, not directly with Kafka or Spark.

See [Demand Explorer](docs/demand-explorer.md) for the selection/data flow, exact
chart hit-region mechanism, daily metric scale, selection reset behavior, and responsibilities of
each new or modified function in the Explorer increment. See [Overview](docs/overview.md)
for range behavior, metric eligibility, map/ranking semantics, and function responsibilities.

## Verification and known limitations

Geometry tests check the 69 unique IDs, Central Park (43), separate island
coordinates, Manhattan bounds, invalid payload rejection, multipart bounds, and
empty geometry. Service tests check cancellation forwarding, HTTP failures, and
invalid response data.

Demand/weather tests cover deterministic generation, cross-service consistency,
All Zones aggregation without double-counting aggregate rows, partial observations,
inclusive ranges, 23/25-hour DST days, busiest rankings, MAE/WAPE calculations,
zero denominators, no observations, invalid inputs, and cancellation. The
production build and lint also check the new data-layer source and tests.

Explorer component tests verify synchronized filters and chart selection with real
data services, including pending/error/retry/empty states and independent weather
failure. Overview tests cover presets, validated custom ranges, incomplete/future
coverage, metric display, map highlights, retry, and empty data. Actual canvas coloring, chart click geometry, and responsive layouts are
verified in the browser. Test-only dependencies are Testing Library and jsdom.

MapLibre is a substantial dependency; Vite may report a large-chunk warning.
The dependency audit also reports a transitive development-tool vulnerability
in picomatch, propagated through Vite/Vitest/TypeScript ESLint. Updating within
the existing dependency ranges did not resolve it. No forced toolchain downgrade
has been applied. This does not imply the audit findings are resolved.
The production-only audit (`npm audit --omit=dev`) reports zero vulnerabilities.
