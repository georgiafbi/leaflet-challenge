# Earthquake Monitor

An interactive MapLibre GL globe that visualizes recent earthquake activity from the USGS Earthquake Catalog.

## Features

- Quick time-range presets for 1 hour, 24 hours, 7 days, and 30 days, plus all intermediate ranges
- Paginated USGS requests, including ranges with more than 20,000 events
- One-decimal magnitude labels embedded in 3D sphere markers at a glance; marker size increases with magnitude and color continues to represent depth
- Low-zoom clustering that reduces overlap and expands into individual events when selected
- Summary cards for total, strongest, deepest, and latest events
- Clickable summary cards that navigate to notable earthquakes
- Light, dark, and street basemaps
- Toggleable earthquake and depth layers with a one-click filter reset
- Phone-first layout with compact 2×2 stats, collapsible Layers control, and a safe-area-aware legend sheet
- Default-open, collapsible map legend and persistent selected-event highlighting
- Country or offshore-area labels in earthquake details
- Lazy USGS popup enrichment with named faults, tectonic plates, and concise tectonic context when authoritative detail metadata is available
- Broad geographic-group champions marked with ringed epicenter symbols and staggered, depth-colored seismic pings around glossy cores
- Depth-colored seismic pings also identify the current strongest, deepest, and latest earthquakes
- Keyboard-accessible controls and reduced-motion support
- Responsive layouts for desktop and mobile screens

## Technology

- HTML, CSS, and browser-native JavaScript
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [Rapid Editor Country Coder](https://github.com/rapideditor/country-coder) for local point-in-polygon country lookup
- [USGS Earthquake Catalog API](https://earthquake.usgs.gov/fdsnws/event/1/)
- Mapbox raster styles

No build step or package installation is required.

## Run locally

Serve the repository root with any static web server and open `index.html`. VS Code's Live Server extension is one convenient option. Opening `index.html` directly also works for most features, but browser geolocation requires a secure HTTP origin such as `localhost` or HTTPS.

## Mapbox token

The basemaps use the public Mapbox access token in `static/js/config.js`. Mapbox public tokens are expected to be visible in browser applications; they are identifiers, not server-side secrets.

For your own deployment:

1. Create a public token in the Mapbox account dashboard.
2. Replace `API_KEY` in `static/js/config.js`.
3. Add allowed-URL restrictions for the production domain to prevent unauthorized quota usage.
4. Grant only the scopes required to read styles and tiles.

Never place a secret Mapbox token in client-side JavaScript.

## Data behavior

The app queries a fixed start and end time for each selected range. Requests use the USGS maximum page size of 20,000 and continue with offsets until the final page is received. Selecting another range aborts the previous request.

Geographic classification uses a hybrid model. Land coordinates are matched locally to a country with the pinned `@rapideditor/country-coder` browser bundle; no per-event geocoding requests are made. Coordinates without a land match receive a named ocean or sea fallback such as **North Pacific Ocean** or **Caribbean Sea**. If the optional lookup bundle cannot load, the app remains usable and falls back to a broad regional label.

Country Coder uses generalized polygons intended for fast client-side lookup. Labels near disputed borders, coastlines, and small islands should therefore be treated as informative rather than authoritative. Champion epicenters intentionally use a separate set of six broad geographic groups, preventing country-level classification from filling the globe with champion markers.

Scientific popup context is loaded only when an individual earthquake popup opens, keeping the main feed fast. The event's USGS GeoJSON detail record is fetched once and cached for later selections. Named faults, plate names, and excerpts are derived only from an inline USGS **Tectonic Summary** product; the app omits these rows when that product is unavailable rather than inferring them from location. Most small or recent events do not include a tectonic summary.

## Accessibility

- The globe does not auto-rotate when the operating system requests reduced motion.
- Champion seismic pings become stable rings when the operating system requests reduced motion.
- The map includes a pause/resume rotation control.
- Summary cards and legend filters are keyboard operable.
- Time-range presets, the complete range selector, and the collapsible legend are keyboard operable.
- Mobile Layers and legend controls expose synchronized expanded/collapsed states to assistive technology.
- Feed state changes are announced through a polite live region.

## Tests

Open `tests/logic-tests.html` in a browser. The dependency-free test page validates:

- Depth range boundaries
- Sphere markers across all magnitude values, with ringed epicenter emphasis for champions
- Embedded marker-magnitude formatting
- Time-range preset fallback
- Stable earthquake identity used by selected-marker highlighting
- Collapsible mobile map-panel state
- Paginated USGS query parameters
- Safe popup handling of untrusted strings
- USGS tectonic-summary parsing and optional scientific popup details
- Representative broad champion-group classification
- Country lookup and offshore-area fallback
- One champion per broad geographic group
- Summary calculations

The page title starts with `PASS` when all tests succeed and `FAILED` when any test fails.

## Project structure

- `../index.html` — application entry point
- `static/css/style.css` — responsive application styling
- `static/js/config.js` — public Mapbox token configuration
- `static/js/logic.js` — map, data, controls, and presentation logic
- `tests/` — browser-native regression tests

## Data attribution

Earthquake data is provided by the U.S. Geological Survey. Map data is attributed to OpenStreetMap contributors, with imagery provided by Mapbox.
