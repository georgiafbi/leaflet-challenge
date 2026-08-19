# Leaflet Challenge

Interactive earthquake map built with Leaflet and USGS GeoJSON feeds.

## Project structure

- `/home/runner/work/leaflet-challenge/leaflet-challenge/index.html` - app entry page
- `/home/runner/work/leaflet-challenge/leaflet-challenge/Leaflet-Step-1/static/js/logic.js` - map, data loading, rendering, and controls
- `/home/runner/work/leaflet-challenge/leaflet-challenge/Leaflet-Step-1/static/js/config.js` - optional Mapbox token config
- `/home/runner/work/leaflet-challenge/leaflet-challenge/Leaflet-Step-1/static/css/style.css` - styling

## Run locally

1. Open `/home/runner/work/leaflet-challenge/leaflet-challenge/index.html` in a browser.
2. For best results, run via a local static server (for example `python -m http.server`) and open the served URL.

## Optional Mapbox API key

The app works without a Mapbox key by using OpenStreetMap/Carto base layers.

If you want Mapbox base layers:

1. Edit `/home/runner/work/leaflet-challenge/leaflet-challenge/Leaflet-Step-1/static/js/config.js`.
2. Set a local token value for `API_KEY` (do not commit your real token).

## Controls

- Time feed selector: past hour/day/week/month
- Minimum magnitude slider
- Maximum depth filter

## Quality checks

Run:

```bash
npm run check
```

This validates JavaScript syntax in project scripts.
