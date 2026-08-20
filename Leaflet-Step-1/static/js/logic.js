const FEED_URLS = {
  hour: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
  day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
  week: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
  month: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson"
};

const FEED_LABELS = {
  hour: "past hour",
  day: "past day",
  week: "past week",
  month: "past month"
};

const DEPTH_BANDS = [
  { max: 10, label: "-10 to 10 km", color: "#2DC937" },
  { max: 30, label: "10 to 30 km", color: "#99C140" },
  { max: 50, label: "30 to 50 km", color: "#E7B416" },
  { max: 70, label: "50 to 70 km", color: "#DB7B2B" },
  { max: 90, label: "70 to 90 km", color: "#CC3232" },
  { max: Infinity, label: "90+ km", color: "#8B0000" }
];

const MAPBOX_TOKEN = typeof API_KEY === "string" ? API_KEY.trim() : "";
const MAP_CENTER = [44.428, -110.5885];
const DEFAULT_ZOOM = 4.5;

const appState = {
  map: null,
  quakeLayer: null,
  layerControl: null,
  legendControl: null,
  activePopup: null,
  allEarthquakes: [],
  selectedFeed: "week",
  minMagnitude: 0,
  maxDepth: 700
};

function setStatus(message, type) {
  const banner = document.getElementById("status-banner");
  if (!banner) return;
  banner.className = `status-banner status-${type || "info"}`;
  banner.textContent = message;
}

function createBaseLayers() {
  const baseLayers = {
    "OpenStreetMap": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }),
    "Carto Light": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    }),
    "Carto Dark": L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    })
  };

  if (MAPBOX_TOKEN) {
    baseLayers["Mapbox Streets"] = L.tileLayer(
      "https://api.mapbox.com/styles/v1/mapbox/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
      {
        attribution:
          'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        id: "streets-v11",
        accessToken: MAPBOX_TOKEN,
        maxZoom: 18
      }
    );
    baseLayers["Mapbox Satellite"] = L.tileLayer(
      "https://api.mapbox.com/styles/v1/mapbox/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
      {
        attribution:
          'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        id: "satellite-streets-v11",
        accessToken: MAPBOX_TOKEN,
        maxZoom: 18
      }
    );
  }

  return baseLayers;
}

function initializeMap() {
  const baseLayers = createBaseLayers();
  const defaultLayer = Object.values(baseLayers)[0];

  appState.quakeLayer = L.layerGroup();
  appState.map = L.map("map-id", {
    center: MAP_CENTER,
    zoom: DEFAULT_ZOOM,
    closePopupOnClick: true,
    layers: [defaultLayer, appState.quakeLayer]
  });

  appState.map.on("popupopen", function (event) {
    if (appState.activePopup && appState.activePopup !== event.popup) {
      appState.map.closePopup(appState.activePopup);
    }
    appState.activePopup = event.popup;
  });

  appState.map.on("popupclose", function (event) {
    if (appState.activePopup === event.popup) {
      appState.activePopup = null;
    }
  });

  appState.layerControl = L.control.layers(baseLayers, { Earthquakes: appState.quakeLayer }, { collapsed: false }).addTo(appState.map);

  addLegend();
  addFilterControl();
}

function addLegend() {
  appState.legendControl = L.control({ position: "bottomleft" });
  appState.legendControl.onAdd = function () {
    const div = L.DomUtil.create("div", "info legend");
    let html = "<h3>Earthquake Depth</h3><ul>";
    DEPTH_BANDS.forEach((band) => {
      html += `<li><span class="legend-swatch" style="background:${band.color};"></span>${band.label}</li>`;
    });
    html += "</ul>";
    div.innerHTML = html;
    return div;
  };
  appState.legendControl.addTo(appState.map);
}

function addFilterControl() {
  const control = L.control({ position: "topright" });
  control.onAdd = function () {
    const container = L.DomUtil.create("div", "filter-control");
    container.innerHTML = `
      <h4>Earthquake Filters</h4>
      <label for="feed-select">Time window</label>
      <select id="feed-select">
        <option value="hour">Past Hour</option>
        <option value="day">Past Day</option>
        <option value="week" selected>Past Week</option>
        <option value="month">Past Month</option>
      </select>
      <label for="min-mag">Min magnitude: <strong id="min-mag-value">0.0</strong></label>
      <input id="min-mag" type="range" min="0" max="10" step="0.1" value="0">
      <label for="max-depth">Max depth (km)</label>
      <input id="max-depth" type="number" min="-10" max="800" step="10" value="700">
      <button id="apply-filters" type="button">Apply</button>
    `;

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    return container;
  };
  control.addTo(appState.map);

  const feedSelect = document.getElementById("feed-select");
  const minMagSlider = document.getElementById("min-mag");
  const minMagValue = document.getElementById("min-mag-value");
  const maxDepthInput = document.getElementById("max-depth");
  const applyButton = document.getElementById("apply-filters");

  minMagSlider.addEventListener("input", function (event) {
    minMagValue.textContent = Number(event.target.value).toFixed(1);
  });

  feedSelect.addEventListener("change", function (event) {
    appState.selectedFeed = event.target.value;
    loadEarthquakes();
  });

  applyButton.addEventListener("click", function () {
    appState.minMagnitude = Number.parseFloat(minMagSlider.value);
    const maxDepth = Number.parseFloat(maxDepthInput.value);
    appState.maxDepth = Number.isFinite(maxDepth) ? maxDepth : 700;
    renderEarthquakes();
  });
}

function getDepthColor(depth) {
  for (let i = 0; i < DEPTH_BANDS.length; i += 1) {
    if (depth <= DEPTH_BANDS[i].max) {
      return DEPTH_BANDS[i].color;
    }
  }
  return DEPTH_BANDS[DEPTH_BANDS.length - 1].color;
}

function getMarkerRadius(magnitude) {
  if (!Number.isFinite(magnitude) || magnitude <= 0) return 5000;
  return Math.min(150000, Math.pow(magnitude, 1.8) * 8000);
}

function formatTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "Unknown time";
  return new Date(timestamp).toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEarthquake(feature) {
  if (!feature || !feature.geometry || !Array.isArray(feature.geometry.coordinates)) return null;
  const coords = feature.geometry.coordinates;
  if (coords.length < 3) return null;

  const longitude = Number(coords[0]);
  const latitude = Number(coords[1]);
  const rawDepth = Number(coords[2]);

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }

  const rawMagnitude = Number(feature.properties && feature.properties.mag);
  const magnitude = Number.isFinite(rawMagnitude) && rawMagnitude > 0 ? rawMagnitude : 0;
  const depth = Number.isFinite(rawDepth) ? rawDepth : 0;

  return {
    id: feature.id || "unknown",
    latitude,
    longitude,
    magnitude,
    depth,
    place: (feature.properties && feature.properties.place) || "Unknown location",
    type: (feature.properties && feature.properties.type) || "earthquake",
    time: Number(feature.properties && feature.properties.time)
  };
}

function createMarker(earthquake) {
  const color = getDepthColor(earthquake.depth);
  const safePlace = escapeHtml(earthquake.place);
  const safeId = escapeHtml(earthquake.id);
  const safeType = escapeHtml(earthquake.type);
  return L.circle([earthquake.latitude, earthquake.longitude], {
    color: "#ffffff",
    weight: 1,
    fillColor: color,
    fillOpacity: 0.75,
    radius: getMarkerRadius(earthquake.magnitude)
  }).bindPopup(`
    <h3>${safePlace}</h3>
    <p><strong>ID:</strong> ${safeId}</p>
    <p><strong>Type:</strong> ${safeType}</p>
    <p><strong>Magnitude:</strong> ${earthquake.magnitude.toFixed(1)}</p>
    <p><strong>Depth:</strong> ${earthquake.depth.toFixed(1)} km</p>
    <p><strong>Time:</strong> ${formatTime(earthquake.time)}</p>
  `);
}

function renderEarthquakes() {
  if (!appState.quakeLayer) return;

  const filtered = appState.allEarthquakes.filter((quake) => {
    return quake.magnitude >= appState.minMagnitude && quake.depth <= appState.maxDepth;
  });

  appState.quakeLayer.clearLayers();
  filtered.forEach((quake) => createMarker(quake).addTo(appState.quakeLayer));

  if (filtered.length === 0) {
    setStatus("No earthquakes match the current filters.", "warning");
    return;
  }

  setStatus(
    `Showing ${filtered.length} earthquakes from the ${FEED_LABELS[appState.selectedFeed]} feed.`,
    "success"
  );
}

async function loadEarthquakes() {
  const feedUrl = FEED_URLS[appState.selectedFeed];
  setStatus(`Loading earthquake data from the ${FEED_LABELS[appState.selectedFeed]} feed...`, "loading");

  try {
    const payload = await d3.json(feedUrl);
    const features = payload && Array.isArray(payload.features) ? payload.features : [];
    appState.allEarthquakes = features.map(normalizeEarthquake).filter(Boolean);
    renderEarthquakes();
  } catch (error) {
    appState.allEarthquakes = [];
    appState.quakeLayer.clearLayers();
    setStatus("Unable to load earthquake data right now. Please try again.", "error");
  }
}

initializeMap();
loadEarthquakes();
