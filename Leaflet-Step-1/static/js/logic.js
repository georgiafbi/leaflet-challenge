const rangePresets = [
    { key: "1h", label: "1 hour", hours: 1 },
    { key: "3h", label: "3 hours", hours: 3 },
    { key: "6h", label: "6 hours", hours: 6 },
    { key: "12h", label: "12 hours", hours: 12 },
    { key: "24h", label: "24 hours", hours: 24 },
    { key: "2d", label: "2 days", hours: 48 },
    { key: "3d", label: "3 days", hours: 72 },
    { key: "4d", label: "4 days", hours: 96 },
    { key: "5d", label: "5 days", hours: 120 },
    { key: "6d", label: "6 days", hours: 144 },
    { key: "7d", label: "7 days", hours: 168 },
    { key: "8d", label: "8 days", hours: 192 },
    { key: "9d", label: "9 days", hours: 216 },
    { key: "10d", label: "10 days", hours: 240 },
    { key: "11d", label: "11 days", hours: 264 },
    { key: "12d", label: "12 days", hours: 288 },
    { key: "13d", label: "13 days", hours: 312 },
    { key: "14d", label: "14 days", hours: 336 },
    { key: "15d", label: "15 days", hours: 360 },
    { key: "16d", label: "16 days", hours: 384 },
    { key: "17d", label: "17 days", hours: 408 },
    { key: "18d", label: "18 days", hours: 432 },
    { key: "19d", label: "19 days", hours: 456 },
    { key: "20d", label: "20 days", hours: 480 },
    { key: "21d", label: "21 days", hours: 504 },
    { key: "22d", label: "22 days", hours: 528 },
    { key: "23d", label: "23 days", hours: 552 },
    { key: "24d", label: "24 days", hours: 576 },
    { key: "25d", label: "25 days", hours: 600 },
    { key: "26d", label: "26 days", hours: 624 },
    { key: "27d", label: "27 days", hours: 648 },
    { key: "28d", label: "28 days", hours: 672 },
    { key: "29d", label: "29 days", hours: 696 },
    { key: "30d", label: "30 days", hours: 720 }
];
const defaultRangeKey = "24h";
const depthRangeDefinitions = [
    { key: "0-10", label: "0-10 km", color: "#7ae582" },
    { key: "10-30", label: "10-30 km", color: "#4dabf7" },
    { key: "30-50", label: "30-50 km", color: "#f7d154" },
    { key: "50-70", label: "50-70 km", color: "#ff9f1c" },
    { key: "70-90", label: "70-90 km", color: "#ff6b6b" },
    { key: "90+", label: "90+ km", color: "#8b0000" }
];
const baseStyleIds = {
    light: { id: "light-v10", label: "Light Map" },
    dark: { id: "dark-v10", label: "Dark Map" },
    streets: { id: "streets-v11", label: "Street Map" }
};
const mapAttribution = 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, Imagery &copy; <a href="https://www.mapbox.com/">Mapbox</a>';

let currentRange = defaultRangeKey;
let globeMap;
let mapLoaded = false;
let quakesVisible = true;
let currentGeojson = { type: "FeatureCollection", features: [] };
let activeDepthRanges = new Set(depthRangeDefinitions.map(function (range) {
    return range.key;
}));
let requestSeq = 0;
let sliderDebounce = null;
let autoRotate = true;
let highlightQuakes = { strongest: null, deepest: null, latest: null };

function getDepthRangeKey(depth) {
    var value = Number(depth);
    if (!Number.isFinite(value)) {
        return "0-10";
    }

    if (value <= 10) return "0-10";
    if (value <= 30) return "10-30";
    if (value <= 50) return "30-50";
    if (value <= 70) return "50-70";
    if (value <= 90) return "70-90";
    return "90+";
}

function getRangePresetByKey(key) {
    return rangePresets.find(function (preset) {
        return preset.key === key;
    }) || rangePresets[4];
}

function getRangePresetFromSlider(value) {
    return rangePresets[Number(value)] || rangePresets[4];
}

function buildRangeUrl(hours) {
    var endTime = new Date();
    var startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
    return "https://earthquake.usgs.gov/fdsnws/event/1/query.geojson?format=geojson&orderby=time&starttime=" + startTime.toISOString() + "&endtime=" + endTime.toISOString() + "&limit=20000";
}

function updateRangeSlider(selectedRange) {
    var preset = getRangePresetByKey(selectedRange);
    var slider = document.getElementById("range-slider");
    if (slider) {
        slider.value = rangePresets.indexOf(preset);
        slider.setAttribute("aria-valuetext", preset.label);
    }
}

function setPillState(mode, label) {
    var pill = document.querySelector(".status-pill");
    if (!pill) {
        return;
    }

    pill.classList.toggle("is-loading", mode === "loading");
    pill.classList.toggle("is-error", mode === "error");

    if (mode === "loading") {
        pill.textContent = "Loading · " + label;
    } else if (mode === "error") {
        pill.textContent = "Feed unavailable · " + label;
    } else {
        pill.textContent = "Live feed · " + label;
    }
}

function formatRelativeTime(timestamp) {
    var diff = Date.now() - Number(timestamp);
    if (!Number.isFinite(diff) || diff < 0) {
        return "just now";
    }
    if (diff < 60000) {
        return "just now";
    }
    var mins = Math.floor(diff / 60000);
    if (mins < 60) {
        return mins + (mins === 1 ? " min ago" : " mins ago");
    }
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) {
        return hrs + (hrs === 1 ? " hr ago" : " hrs ago");
    }
    var days = Math.floor(hrs / 24);
    return days + (days === 1 ? " day ago" : " days ago");
}

function getContinent(lon, lat) {
    // Coarse lat/lon regions; ocean quakes fall into the nearest continental region.
    if (lat <= -60) return "Antarctica";

    // Pacific islands with negative longitude (Hawaii, Fiji, Tonga)
    if (lon <= -140 && lat < 30) return "Oceania";
    if (lon < -170) {
        if (lat >= 45) return "North America";
        return lat >= 30 ? "Asia" : "Oceania";
    }

    if (lon >= -170 && lon <= -30) {
        return lat >= 7 ? "North America" : "South America";
    }

    if (lat >= 42) {
        return lon <= 60 ? "Europe" : "Asia";
    }
    if (lat >= 35 && lon <= 26) return "Europe";
    if (lon <= 32 && lat < 37 && lat >= -40) return "Africa";
    if (lon <= 52 && lat < 12 && lat >= -40) return "Africa";
    if (lat < -40) return "Oceania";
    if (lon >= 110 && lat <= -10) return "Oceania";
    if (lon >= 130 && lat < 10) return "Oceania";
    if (lon >= 165) return "Oceania";
    return "Asia";
}

function markContinentChampions(features) {
    var champions = {};

    features.forEach(function (feature) {
        var coords = feature.geometry.coordinates;
        var continent = getContinent(coords[0], coords[1]);
        feature.properties.continent = continent;
        feature.properties.isChampion = false;

        var mag = Number(feature.properties.mag || 0);
        if (!champions[continent] || mag > Number(champions[continent].properties.mag || 0)) {
            champions[continent] = feature;
        }
    });

    Object.keys(champions).forEach(function (continent) {
        champions[continent].properties.isChampion = true;
    });
}

function buildPopupHtml(props) {
    var eventTime = new Date(Number(props.time)).toLocaleString();
    var championBadge = (props.isChampion === true || props.isChampion === "true")
        ? '<p class="champion-badge">★ Strongest in ' + props.continent + " for this range</p>"
        : "";
    return '<div class="quake-popup">' +
        "<h3>" + (props.place || "Unknown location") + "</h3>" +
        championBadge +
        "<p><strong>Magnitude:</strong> " + props.mag + "</p>" +
        "<p><strong>Depth:</strong> " + props.depth + " km</p>" +
        "<p><strong>Continent:</strong> " + (props.continent || "Unknown") + "</p>" +
        "<p><strong>Type:</strong> " + (props.type || "earthquake") + "</p>" +
        "<p><strong>Time:</strong> " + eventTime + "</p>" +
        "</div>";
}

function flyToQuake(feature) {
    if (!feature || !globeMap || !mapLoaded) {
        return;
    }

    autoRotate = false;
    var coords = feature.geometry.coordinates.slice(0, 2);
    globeMap.flyTo({ center: coords, zoom: 4.5, duration: 2200, essential: true });
    new maplibregl.Popup({ maxWidth: "320px" })
        .setLngLat(coords)
        .setHTML(buildPopupHtml(feature.properties))
        .addTo(globeMap);
}

function resetGlobeView() {
    if (!globeMap || !mapLoaded) {
        return;
    }

    autoRotate = false;
    globeMap.flyTo({ center: [-40, 25], zoom: 1.6, duration: 1800, essential: true });
}

function startAutoRotate() {
    function spin() {
        if (!autoRotate || !globeMap) {
            return;
        }
        var center = globeMap.getCenter();
        center.lng += 0.025;
        globeMap.jumpTo({ center: center });
        requestAnimationFrame(spin);
    }
    requestAnimationFrame(spin);
}

function buildBaseStyle() {
    var sources = {};
    var layers = [];

    Object.keys(baseStyleIds).forEach(function (key, index) {
        sources["base-" + key] = {
            type: "raster",
            tiles: ["https://api.mapbox.com/styles/v1/mapbox/" + baseStyleIds[key].id + "/tiles/512/{z}/{x}/{y}?access_token=" + API_KEY],
            tileSize: 512,
            attribution: mapAttribution
        };
        layers.push({
            id: "base-" + key,
            type: "raster",
            source: "base-" + key,
            layout: { visibility: index === 0 ? "visible" : "none" }
        });
    });

    return {
        version: 8,
        projection: { type: "globe" },
        sources: sources,
        layers: layers
    };
}

function hexChannelMix(hex, target, amount) {
    var value = hex.replace("#", "");
    var channels = [
        parseInt(value.substring(0, 2), 16),
        parseInt(value.substring(2, 4), 16),
        parseInt(value.substring(4, 6), 16)
    ].map(function (channel) {
        return Math.round(channel + (target - channel) * amount);
    });
    return "rgb(" + channels.join(",") + ")";
}

function createPinImage(color) {
    var width = 64;
    var height = 92;
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    var cx = width / 2;
    var cy = 26;
    var r = 22;

    // Needle
    var needleGrad = ctx.createLinearGradient(cx, cy, cx, height);
    needleGrad.addColorStop(0, "rgba(226, 232, 240, 0.95)");
    needleGrad.addColorStop(1, "rgba(100, 116, 139, 0.9)");
    ctx.beginPath();
    ctx.moveTo(cx - 2.6, cy + r * 0.55);
    ctx.lineTo(cx + 2.6, cy + r * 0.55);
    ctx.lineTo(cx, height - 2);
    ctx.closePath();
    ctx.fillStyle = needleGrad;
    ctx.fill();

    // Glass ball body
    var ballGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.08, cx, cy, r);
    ballGrad.addColorStop(0, hexChannelMix(color, 255, 0.6));
    ballGrad.addColorStop(0.45, color);
    ballGrad.addColorStop(1, hexChannelMix(color, 0, 0.45));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Glass rim
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Specular highlight
    var highlight = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.42, 1, cx - r * 0.35, cy - r * 0.42, r * 0.55);
    highlight.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = highlight;
    ctx.fill();

    // Soft bottom reflection for the glassy depth
    var reflection = ctx.createRadialGradient(cx + r * 0.22, cy + r * 0.5, 1, cx + r * 0.22, cy + r * 0.5, r * 0.5);
    reflection.addColorStop(0, "rgba(255, 255, 255, 0.28)");
    reflection.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.arc(cx + r * 0.22, cy + r * 0.5, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = reflection;
    ctx.fill();

    return ctx.getImageData(0, 0, width, height);
}

function createStarImage(color) {
    var size = 96;
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    var cx = size / 2;
    var cy = size / 2;
    var outerR = 40;
    var innerR = 17;

    function starPath(radiusOuter, radiusInner) {
        ctx.beginPath();
        for (var i = 0; i < 10; i++) {
            var radius = i % 2 === 0 ? radiusOuter : radiusInner;
            var angle = (Math.PI / 5) * i - Math.PI / 2;
            var x = cx + radius * Math.cos(angle);
            var y = cy + radius * Math.sin(angle);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
    }

    // Outer golden glow
    var glow = ctx.createRadialGradient(cx, cy, outerR * 0.3, cx, cy, outerR * 1.2);
    glow.addColorStop(0, "rgba(255, 215, 90, 0.55)");
    glow.addColorStop(1, "rgba(255, 215, 90, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, outerR * 1.18, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Star body in the depth color, glassy gradient
    var bodyGrad = ctx.createRadialGradient(cx - outerR * 0.3, cy - outerR * 0.35, outerR * 0.08, cx, cy, outerR);
    bodyGrad.addColorStop(0, hexChannelMix(color, 255, 0.65));
    bodyGrad.addColorStop(0.5, color);
    bodyGrad.addColorStop(1, hexChannelMix(color, 0, 0.4));
    starPath(outerR, innerR);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Golden rim
    ctx.strokeStyle = "rgba(255, 214, 90, 0.95)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Specular highlight
    var highlight = ctx.createRadialGradient(cx - outerR * 0.3, cy - outerR * 0.4, 1, cx - outerR * 0.3, cy - outerR * 0.4, outerR * 0.55);
    highlight.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
    starPath(outerR, innerR);
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.arc(cx - outerR * 0.28, cy - outerR * 0.35, outerR * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = highlight;
    ctx.fill();
    ctx.restore();

    return ctx.getImageData(0, 0, size, size);
}

function applyDepthFilters() {
    if (!globeMap || !globeMap.getLayer("quake-pins")) {
        return;
    }

    var active = Array.from(activeDepthRanges);
    globeMap.setFilter("quake-pins", [
        "all",
        ["in", ["get", "depthKey"], ["literal", active]],
        ["!=", ["get", "isChampion"], true]
    ]);
    globeMap.setLayoutProperty("quake-pins", "visibility", quakesVisible ? "visible" : "none");

    if (globeMap.getLayer("quake-stars")) {
        globeMap.setFilter("quake-stars", [
            "all",
            ["in", ["get", "depthKey"], ["literal", active]],
            ["==", ["get", "isChampion"], true]
        ]);
        globeMap.setLayoutProperty("quake-stars", "visibility", quakesVisible ? "visible" : "none");
    }
}

function setBaseLayer(selectedKey) {
    if (!globeMap) {
        return;
    }

    Object.keys(baseStyleIds).forEach(function (key) {
        if (globeMap.getLayer("base-" + key)) {
            globeMap.setLayoutProperty("base-" + key, "visibility", key === selectedKey ? "visible" : "none");
        }
    });
}

function toggleDepthRange(rangeKey) {
    if (activeDepthRanges.has(rangeKey)) {
        activeDepthRanges.delete(rangeKey);
    } else {
        activeDepthRanges.add(rangeKey);
    }

    applyDepthFilters();

    document.querySelectorAll(".legend-toggle").forEach(function (button) {
        var isActive = activeDepthRanges.has(button.dataset.depthKey);
        button.classList.toggle("is-off", !isActive);
        button.setAttribute("aria-pressed", String(isActive));
        var state = button.querySelector(".legend-state");
        if (state) {
            state.textContent = isActive ? "On" : "Off";
        }
    });
}

function buildMapPanels() {
    var wrap = document.getElementById("map-wrap");
    if (!wrap) {
        return;
    }

    var basePanel = document.createElement("div");
    basePanel.className = "map-panel base-panel";

    Object.keys(baseStyleIds).forEach(function (key, index) {
        var label = document.createElement("label");
        label.className = "base-option";

        var input = document.createElement("input");
        input.type = "radio";
        input.name = "basemap";
        input.value = key;
        input.checked = index === 0;
        input.addEventListener("change", function () {
            setBaseLayer(key);
        });

        var text = document.createElement("span");
        text.textContent = baseStyleIds[key].label;

        label.appendChild(input);
        label.appendChild(text);
        basePanel.appendChild(label);
    });

    var divider = document.createElement("div");
    divider.className = "base-divider";
    basePanel.appendChild(divider);

    var quakeToggle = document.createElement("label");
    quakeToggle.className = "base-option";
    var quakeInput = document.createElement("input");
    quakeInput.type = "checkbox";
    quakeInput.checked = true;
    quakeInput.addEventListener("change", function (event) {
        quakesVisible = event.target.checked;
        applyDepthFilters();
    });
    var quakeText = document.createElement("span");
    quakeText.textContent = "Earthquakes";
    quakeToggle.appendChild(quakeInput);
    quakeToggle.appendChild(quakeText);
    basePanel.appendChild(quakeToggle);

    var legendPanel = document.createElement("div");
    legendPanel.className = "map-panel legend-panel";

    var heading = document.createElement("h3");
    heading.textContent = "Depth";
    legendPanel.appendChild(heading);

    var list = document.createElement("div");
    list.className = "legend-list";

    depthRangeDefinitions.forEach(function (range) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "legend-toggle";
        button.dataset.depthKey = range.key;
        button.setAttribute("aria-pressed", "true");
        button.innerHTML = '<span class="legend-swatch" style="background:' + range.color + '"></span><span class="legend-label">' + range.label + '</span><span class="legend-state">On</span>';
        button.addEventListener("click", function () {
            toggleDepthRange(range.key);
        });
        list.appendChild(button);
    });

    legendPanel.appendChild(list);

    var starNote = document.createElement("p");
    starNote.className = "legend-note";
    starNote.innerHTML = '<span class="legend-star">★</span> Strongest quake per continent';
    legendPanel.appendChild(starNote);

    wrap.appendChild(basePanel);
    wrap.appendChild(legendPanel);
}

function createHomeControl() {
    var container;
    return {
        onAdd: function () {
            container = document.createElement("div");
            container.className = "maplibregl-ctrl maplibregl-ctrl-group";

            var button = document.createElement("button");
            button.type = "button";
            button.className = "home-control";
            button.title = "Reset to default view";
            button.setAttribute("aria-label", "Reset to default view");
            button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>';
            button.addEventListener("click", resetGlobeView);

            container.appendChild(button);
            return container;
        },
        onRemove: function () {
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }
    };
}

function createMap() {
    if (globeMap) {
        return globeMap;
    }

    globeMap = new maplibregl.Map({
        container: "map-id",
        style: buildBaseStyle(),
        center: [-40, 25],
        zoom: 1.6,
        minZoom: 0.8,
        maxZoom: 18
    });

    globeMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    globeMap.addControl(createHomeControl(), "top-left");

    var geolocate = new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserLocation: true,
        fitBoundsOptions: { zoom: 8 }
    });
    globeMap.addControl(geolocate, "top-left");
    geolocate.on("geolocate", function () {
        autoRotate = false;
    });

    window.earthquakeApp = { getMap: function () { return globeMap; } };

    globeMap.on("load", function () {
        globeMap.setProjection({ type: "globe" });

        globeMap.addSource("earthquakes", {
            type: "geojson",
            data: currentGeojson
        });

        depthRangeDefinitions.forEach(function (range) {
            globeMap.addImage("pin-" + range.key, createPinImage(range.color), { pixelRatio: 2 });
            globeMap.addImage("star-" + range.key, createStarImage(range.color), { pixelRatio: 2 });
        });

        globeMap.addLayer({
            id: "quake-pins",
            type: "symbol",
            source: "earthquakes",
            layout: {
                "icon-image": ["concat", "pin-", ["get", "depthKey"]],
                "icon-size": [
                    "interpolate", ["linear"], ["coalesce", ["get", "mag"], 0],
                    0, 0.45,
                    2, 0.6,
                    4, 0.85,
                    6, 1.25,
                    8, 1.7
                ],
                "icon-anchor": "bottom",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "symbol-sort-key": ["*", -1, ["coalesce", ["get", "mag"], 0]]
            },
            paint: {
                "icon-opacity": 0.95
            }
        });

        globeMap.addLayer({
            id: "quake-stars",
            type: "symbol",
            source: "earthquakes",
            layout: {
                "icon-image": ["concat", "star-", ["get", "depthKey"]],
                "icon-size": [
                    "interpolate", ["linear"], ["coalesce", ["get", "mag"], 0],
                    0, 0.55,
                    4, 0.75,
                    6, 1.0,
                    8, 1.35
                ],
                "icon-anchor": "center",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true
            },
            paint: {
                "icon-opacity": 1
            }
        });

        function handleQuakeClick(event) {
            var feature = event.features && event.features[0];
            if (!feature) {
                return;
            }

            new maplibregl.Popup({ maxWidth: "320px" })
                .setLngLat(feature.geometry.coordinates.slice(0, 2))
                .setHTML(buildPopupHtml(feature.properties))
                .addTo(globeMap);
        }

        globeMap.on("click", "quake-pins", handleQuakeClick);
        globeMap.on("click", "quake-stars", handleQuakeClick);

        ["quake-pins", "quake-stars"].forEach(function (layerId) {
            globeMap.on("mouseenter", layerId, function () {
                globeMap.getCanvas().style.cursor = "pointer";
            });
            globeMap.on("mouseleave", layerId, function () {
                globeMap.getCanvas().style.cursor = "";
            });
        });

        applyDepthFilters();
        mapLoaded = true;

        if (currentGeojson.features.length) {
            globeMap.getSource("earthquakes").setData(currentGeojson);
        }

        ["mousedown", "touchstart", "wheel", "dblclick"].forEach(function (eventName) {
            globeMap.on(eventName, function () {
                autoRotate = false;
            });
        });
        startAutoRotate();
    });

    return globeMap;
}

function updateSummary(data) {
    var quakes = Array.isArray(data && data.features) ? data.features : [];
    var totalEl = document.getElementById("total-events");
    var strongestEl = document.getElementById("strongest-magnitude");
    var deepestEl = document.getElementById("deepest-depth");
    var latestEl = document.getElementById("latest-event");

    if (!quakes.length) {
        highlightQuakes = { strongest: null, deepest: null, latest: null };
        if (totalEl) totalEl.textContent = "0";
        if (strongestEl) strongestEl.textContent = "0.0 M";
        if (deepestEl) deepestEl.textContent = "0 km";
        if (latestEl) {
            latestEl.textContent = "--";
            latestEl.removeAttribute("title");
        }
        return;
    }

    var strongestQuake = quakes.reduce(function (best, quake) {
        return Number(quake.properties.mag || 0) > Number(best.properties.mag || 0) ? quake : best;
    }, quakes[0]);

    var deepestQuake = quakes.reduce(function (best, quake) {
        return Number(quake.geometry.coordinates[2] || 0) > Number(best.geometry.coordinates[2] || 0) ? quake : best;
    }, quakes[0]);

    var latestQuake = quakes.reduce(function (latest, quake) {
        return quake.properties.time > latest.properties.time ? quake : latest;
    }, quakes[0]);

    highlightQuakes = { strongest: strongestQuake, deepest: deepestQuake, latest: latestQuake };

    if (totalEl) totalEl.textContent = quakes.length.toLocaleString();
    if (strongestEl) strongestEl.textContent = Number(strongestQuake.properties.mag || 0).toFixed(1) + " M";
    if (deepestEl) deepestEl.textContent = Number(deepestQuake.geometry.coordinates[2] || 0).toFixed(0) + " km";
    if (latestEl) {
        latestEl.textContent = formatRelativeTime(latestQuake.properties.time);
        latestEl.title = new Date(latestQuake.properties.time).toLocaleString();
    }
}

function loadEarthquakeData(rangeKey) {
    var preset = typeof rangeKey === "number" ? getRangePresetFromSlider(rangeKey) : getRangePresetByKey(rangeKey);
    currentRange = preset.key;
    updateRangeSlider(currentRange);
    setPillState("loading", preset.label);

    var seq = ++requestSeq;

    fetch(buildRangeUrl(preset.hours))
        .then(function (response) {
            if (!response.ok) {
                throw new Error("USGS request failed: " + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            if (seq !== requestSeq) {
                return;
            }

            var features = (data.features || []).map(function (feature) {
                var depth = feature.geometry.coordinates[2];
                feature.properties.depth = Number.isFinite(Number(depth)) ? Number(depth).toFixed(1) : "0";
                feature.properties.depthKey = getDepthRangeKey(depth);
                return feature;
            });

            markContinentChampions(features);

            currentGeojson = { type: "FeatureCollection", features: features };
            updateSummary(currentGeojson);
            setPillState("live", preset.label);

            if (mapLoaded && globeMap.getSource("earthquakes")) {
                globeMap.getSource("earthquakes").setData(currentGeojson);
            }
        })
        .catch(function (error) {
            if (seq !== requestSeq) {
                return;
            }

            console.error("Failed to load earthquake data:", error);
            currentGeojson = { type: "FeatureCollection", features: [] };
            updateSummary(currentGeojson);
            setPillState("error", preset.label);
            if (mapLoaded && globeMap.getSource("earthquakes")) {
                globeMap.getSource("earthquakes").setData(currentGeojson);
            }
        });
}

function wireStatCard(valueId, title, action) {
    var valueEl = document.getElementById(valueId);
    if (!valueEl) {
        return;
    }

    var card = valueEl.closest(".stat-card");
    if (!card) {
        return;
    }

    card.classList.add("is-clickable");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.title = title;
    card.addEventListener("click", action);
    card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            action();
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    createMap();
    buildMapPanels();
    updateRangeSlider(currentRange);

    var slider = document.getElementById("range-slider");
    if (slider) {
        slider.addEventListener("input", function (event) {
            var preset = getRangePresetFromSlider(Number(event.target.value));
            currentRange = preset.key;
            setPillState("loading", preset.label);

            if (sliderDebounce) {
                clearTimeout(sliderDebounce);
            }
            sliderDebounce = setTimeout(function () {
                loadEarthquakeData(currentRange);
            }, 250);
        });
    }

    wireStatCard("total-events", "Reset globe view", resetGlobeView);
    wireStatCard("strongest-magnitude", "Fly to the strongest quake", function () {
        flyToQuake(highlightQuakes.strongest);
    });
    wireStatCard("deepest-depth", "Fly to the deepest quake", function () {
        flyToQuake(highlightQuakes.deepest);
    });
    wireStatCard("latest-event", "Fly to the latest quake", function () {
        flyToQuake(highlightQuakes.latest);
    });

    loadEarthquakeData(currentRange);
});
