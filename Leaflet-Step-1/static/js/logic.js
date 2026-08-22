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
const earthquakePageSize = 20000;
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
const compactViewportQuery = window.matchMedia("(max-width: 640px), (max-width: 900px) and (max-height: 500px)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const zoomEasterEggs = [
    { key: "closer", zoom: 3.5, message: "Closer look activated. The tectonic plates are pretending not to notice." },
    { key: "enhance", zoom: 6, message: "Enhance! Sadly, geology still refuses to load in 4K." },
    { key: "neighborhood", zoom: 10, message: "Welcome to the neighborhood. Please keep seismic activity after 10 p.m. to a minimum." },
    { key: "too-close", zoom: 15, message: "That’s very close. If you can smell sulfur, zoom out." }
];

let currentRange = defaultRangeKey;
let lastSuccessfulRange = defaultRangeKey;
let hasSuccessfulFeed = false;
let globeMap;
let mapLoaded = false;
let quakesVisible = true;
let currentGeojson = { type: "FeatureCollection", features: [] };
let activeDepthRanges = new Set(depthRangeDefinitions.map(function (range) {
    return range.key;
}));
let requestSeq = 0;
let activeRequestController = null;
let autoRotate = !reducedMotionQuery.matches;
let rotationAnimationId = null;
let championPingAnimationId = null;
let championPingLastFrame = 0;
let rotationControlButton = null;
let highlightQuakes = { strongest: null, deepest: null, latest: null };
let selectedQuakeId = null;
let lastEasterEggZoom = 1.6;
let easterEggToastTimer = null;
let activeQuakePopup = null;
const shownZoomEasterEggs = new Set();
const eventDetailCache = new Map();

function getZoomEasterEgg(previousZoom, currentZoom, shownKeys) {
    if (!Number.isFinite(previousZoom) || !Number.isFinite(currentZoom) || currentZoom <= previousZoom) {
        return null;
    }

    var seen = shownKeys || new Set();
    return zoomEasterEggs.slice().reverse().find(function (easterEgg) {
        return previousZoom < easterEgg.zoom && currentZoom >= easterEgg.zoom && !seen.has(easterEgg.key);
    }) || null;
}

function showZoomEasterEgg(message) {
    var wrap = document.getElementById("map-wrap");
    if (!wrap) {
        return;
    }

    var toast = document.getElementById("zoom-easter-egg");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "zoom-easter-egg";
        toast.className = "zoom-easter-egg";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.setAttribute("aria-atomic", "true");
        wrap.appendChild(toast);
    }

    window.clearTimeout(easterEggToastTimer);
    toast.classList.remove("is-visible");
    toast.textContent = message;
    void toast.offsetWidth;
    toast.classList.add("is-visible");
    easterEggToastTimer = window.setTimeout(function () {
        toast.classList.remove("is-visible");
    }, 3600);
}

function handleZoomEasterEgg(currentZoom) {
    var easterEgg = getZoomEasterEgg(lastEasterEggZoom, currentZoom, shownZoomEasterEggs);
    lastEasterEggZoom = currentZoom;
    if (!easterEgg) {
        return;
    }

    shownZoomEasterEggs.add(easterEgg.key);
    showZoomEasterEgg(easterEgg.message);
}

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

function getMagnitudeShapeKey(magnitude) {
    return "sphere";
}

function getNumericMagnitude(magnitude) {
    if (magnitude === null || magnitude === undefined || magnitude === "") {
        return null;
    }
    var value = Number(magnitude);
    return Number.isFinite(value) ? value : null;
}

function formatMagnitudeLabel(magnitude) {
    var value = getNumericMagnitude(magnitude);
    if (value === null) {
        return "—";
    }
    var rounded = Number(value.toFixed(1));
    return (Object.is(rounded, -0) ? 0 : rounded).toFixed(1);
}

function getRangePresetByKey(key) {
    return rangePresets.find(function (preset) {
        return preset.key === key;
    }) || rangePresets[4];
}

function getRangePresetFromSlider(value) {
    return rangePresets[Number(value)] || rangePresets[4];
}

function buildRangeUrl(startTime, endTime, offset) {
    var params = new URLSearchParams({
        format: "geojson",
        orderby: "time",
        starttime: startTime.toISOString(),
        endtime: endTime.toISOString(),
        limit: String(earthquakePageSize),
        offset: String(offset)
    });
    return "https://earthquake.usgs.gov/fdsnws/event/1/query.geojson?" + params.toString();
}

function updateRangeControls(selectedRange) {
    var preset = getRangePresetByKey(selectedRange);
    var select = document.getElementById("range-select");
    if (select) {
        select.value = preset.key;
    }

    document.querySelectorAll(".range-preset").forEach(function (button) {
        var isActive = button.dataset.range === preset.key;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

function setPillState(mode, label) {
    var pill = document.querySelector(".status-pill");
    if (!pill) {
        return;
    }

    pill.setAttribute("aria-live", mode === "live" ? "off" : "polite");
    pill.classList.toggle("is-loading", mode === "loading");
    pill.classList.toggle("is-error", mode === "error" || mode === "stale");

    if (mode === "loading") {
        pill.textContent = "Loading · " + label;
    } else if (mode === "stale") {
        pill.textContent = "Update failed · showing " + label;
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

function getChampionGroup(lon, lat) {
    // Coarse, stable groups keep champion markers limited to a handful worldwide.
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

function getOffshoreArea(lon, lat) {
    if (!Number.isFinite(Number(lon)) || !Number.isFinite(Number(lat))) {
        return "Unknown area";
    }

    if (lat <= -60) return "Southern Ocean";
    if (lat >= 66) return "Arctic Ocean";
    if (lon >= -6 && lon <= 37 && lat >= 30 && lat <= 46) return "Mediterranean Sea";
    if (lon >= -90 && lon <= -58 && lat >= 8 && lat <= 24) return "Caribbean Sea";
    if (lon >= -98 && lon <= -80 && lat >= 18 && lat <= 31) return "Gulf of Mexico";
    if (lon >= 20 && lon <= 120 && lat < 30) return lat >= 0 ? "North Indian Ocean" : "South Indian Ocean";
    if (lon >= -70 && lon <= 20) return lat >= 0 ? "North Atlantic Ocean" : "South Atlantic Ocean";
    return lat >= 0 ? "North Pacific Ocean" : "South Pacific Ocean";
}

function getCountryAt(lon, lat) {
    if (!Number.isFinite(Number(lon)) || !Number.isFinite(Number(lat))) {
        return null;
    }
    if (!window.countryCoder || typeof window.countryCoder.feature !== "function") {
        return null;
    }

    try {
        var feature = window.countryCoder.feature([Number(lon), Number(lat)]);
        if (!feature || !feature.properties) {
            return null;
        }
        return {
            name: feature.properties.nameEn || null,
            code: feature.properties.iso1A2 || null
        };
    } catch (error) {
        console.warn("Country lookup failed; using an area label instead.", error);
        return null;
    }
}

function classifyGeography(lon, lat) {
    var championGroup = getChampionGroup(Number(lon), Number(lat));
    var country = getCountryAt(lon, lat);
    var lookupAvailable = Boolean(window.countryCoder && typeof window.countryCoder.feature === "function");

    return {
        country: country && country.name,
        countryCode: country && country.code,
        displayRegion: country && country.name
            ? country.name
            : lookupAvailable ? getOffshoreArea(lon, lat) : championGroup + " region",
        championGroup: championGroup
    };
}

function normalizeEarthquakeFeature(feature) {
    if (!feature || feature.type !== "Feature" || !feature.geometry || feature.geometry.type !== "Point" ||
            !Array.isArray(feature.geometry.coordinates) || !feature.properties ||
            typeof feature.properties !== "object") {
        return null;
    }

    var coordinates = feature.geometry.coordinates;
    var requiredValues = [coordinates[0], coordinates[1], coordinates[2], feature.properties.time];
    if (requiredValues.some(function (value) {
        return value === null || value === undefined || value === "";
    })) {
        return null;
    }
    var lon = Number(coordinates[0]);
    var lat = Number(coordinates[1]);
    var depth = Number(coordinates[2]);
    var timestamp = Number(feature.properties.time);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(depth) ||
            !Number.isFinite(timestamp) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
        return null;
    }

    var properties = Object.assign({}, feature.properties);
    properties.mag = getNumericMagnitude(properties.mag);
    properties.time = timestamp;
    properties.depth = depth.toFixed(1);
    properties.depthKey = getDepthRangeKey(depth);
    properties.shapeKey = getMagnitudeShapeKey(properties.mag);
    properties.magnitudeLabel = formatMagnitudeLabel(properties.mag);

    var normalized = Object.assign({}, feature, {
        geometry: Object.assign({}, feature.geometry, {
            coordinates: [lon, lat, depth].concat(coordinates.slice(3))
        }),
        properties: properties
    });
    properties.eventId = getQuakeIdentity(normalized);
    properties.isSelected = false;
    properties.isStrongest = false;
    properties.isDeepest = false;
    properties.isLatest = false;
    properties.isSummaryHighlight = false;
    return normalized;
}

function markRegionalChampions(features) {
    var champions = {};

    features.forEach(function (feature) {
        var coords = feature.geometry.coordinates;
        var classification = classifyGeography(coords[0], coords[1]);
        feature.properties.country = classification.country;
        feature.properties.countryCode = classification.countryCode;
        feature.properties.displayRegion = classification.displayRegion;
        feature.properties.championGroup = classification.championGroup;
        feature.properties.isChampion = false;

        var mag = getNumericMagnitude(feature.properties.mag);
        var currentChampion = champions[classification.championGroup];
        if (mag !== null && (!currentChampion || mag > getNumericMagnitude(currentChampion.properties.mag))) {
            champions[classification.championGroup] = feature;
        }
    });

    Object.keys(champions).forEach(function (group) {
        champions[group].properties.isChampion = true;
    });
}

function appendPopupRow(container, label, value, wide) {
    var row = document.createElement("p");
    row.className = "popup-fact" + (wide ? " popup-fact--wide" : "");
    var strong = document.createElement("strong");
    strong.textContent = label;
    row.appendChild(strong);
    row.appendChild(document.createTextNode(String(value)));
    container.appendChild(row);
}

function getPreferredProduct(products) {
    if (!Array.isArray(products) || !products.length) {
        return null;
    }

    return products.slice().sort(function (a, b) {
        var weightDifference = Number(b.preferredWeight || 0) - Number(a.preferredWeight || 0);
        return weightDifference || Number(b.updateTime || 0) - Number(a.updateTime || 0);
    })[0];
}

function getTectonicSummaryText(detail) {
    var products = detail && detail.properties && detail.properties.products;
    var generalTextProducts = products && products["general-text"];
    if (!Array.isArray(generalTextProducts)) {
        return "";
    }

    var summaries = generalTextProducts.map(function (product) {
        var contents = product && product.contents ? Object.values(product.contents) : [];
        var inlineContent = contents.find(function (content) {
            return content && typeof content.bytes === "string" && /tectonic\s+summary/i.test(content.bytes);
        });
        return inlineContent ? { product: product, html: inlineContent.bytes } : null;
    }).filter(Boolean);

    if (!summaries.length) {
        return "";
    }

    var preferred = getPreferredProduct(summaries.map(function (summary) { return summary.product; }));
    var selected = summaries.find(function (summary) { return summary.product === preferred; }) || summaries[0];
    var parsed = new DOMParser().parseFromString(selected.html, "text/html");
    var heading = parsed.querySelector("h2, h3");
    if (heading && /tectonic\s+summary/i.test(heading.textContent)) {
        heading.remove();
    }
    return parsed.body.textContent.replace(/\s+/g, " ").trim();
}

function uniqueNames(values) {
    var seen = new Set();
    return values.filter(function (value) {
        var cleaned = value.replace(/^the\s+/i, "").trim();
        var key = cleaned.toLocaleLowerCase();
        if (!cleaned || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    }).map(function (value) {
        return value.replace(/^the\s+/i, "").trim();
    });
}

function extractNamedFaults(text) {
    var matches = [];
    var pattern = /\b((?:[A-Z][\p{L}’'’-]*\s+){1,5}(?:(?:transform|strike-slip|thrust|normal|reverse)\s+)?(?:Fault|fault)(?:\s+(?:Zone|zone|System|system))?)\b/gu;
    var match;
    while ((match = pattern.exec(text)) !== null) {
        matches.push(match[1]);
    }
    var uniqueFaults = uniqueNames(matches);
    return uniqueFaults.filter(function (fault) {
        var key = fault.toLocaleLowerCase();
        return !uniqueFaults.some(function (candidate) {
            var candidateKey = candidate.toLocaleLowerCase();
            return candidateKey !== key && candidateKey.indexOf(key + " ") === 0;
        });
    });
}

function extractPlateNames(text) {
    var names = [];
    var properName = "[A-Z][\\p{L}’'’-]*(?:\\s+[A-Z][\\p{L}’'’-]*){0,2}";
    var pluralPattern = new RegExp("\\b(" + properName + "(?:,\\s*" + properName + "){0,4}(?:,?\\s+and\\s+" + properName + ")?)\\s+(?:micro)?plates\\b", "gu");
    var singularPattern = new RegExp("\\b(" + properName + ")\\s+(?:micro)?plate\\b", "gu");
    var match;

    while ((match = pluralPattern.exec(text)) !== null) {
        match[1].split(/,\s*(?:and\s+)?|\s+and\s+/).forEach(function (name) {
            names.push(name);
        });
    }
    while ((match = singularPattern.exec(text)) !== null) {
        names.push(match[1]);
    }
    return uniqueNames(names);
}

function getTectonicExcerpt(text) {
    var sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    var ranked = sentences.map(function (sentence, index) {
        var cleaned = sentence.trim();
        var score = 0;
        if (/(?:micro)?plates?\b/i.test(cleaned)) score += 3;
        if (/(?:Fault|fault)(?:\s+(?:Zone|zone|System|system))?\b/.test(cleaned)) score += 2;
        if (/subduction|tectonic|trench|transform/i.test(cleaned)) score += 1;
        return { text: cleaned, index: index, score: score };
    }).filter(function (sentence) {
        return sentence.score > 0;
    }).sort(function (a, b) {
        return b.score - a.score || a.index - b.index;
    }).slice(0, 2).sort(function (a, b) {
        return a.index - b.index;
    });

    var excerpt = ranked.map(function (sentence) { return sentence.text; }).join(" ");
    if (excerpt.length <= 420) {
        return excerpt;
    }
    return excerpt.slice(0, 417).replace(/\s+\S*$/, "") + "…";
}

function extractTectonicMetadata(detail) {
    var summary = getTectonicSummaryText(detail);
    if (!summary) {
        return {};
    }

    return {
        faults: extractNamedFaults(summary),
        plates: extractPlateNames(summary),
        tectonicContext: getTectonicExcerpt(summary)
    };
}

function getEventDetail(detailUrl) {
    var parsedUrl;
    try {
        parsedUrl = new URL(detailUrl);
    } catch (error) {
        return Promise.resolve({});
    }
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "earthquake.usgs.gov") {
        return Promise.resolve({});
    }

    if (!eventDetailCache.has(parsedUrl.href)) {
        eventDetailCache.set(parsedUrl.href, fetch(parsedUrl.href)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("USGS event detail request failed: " + response.status);
                }
                return response.json();
            })
            .then(extractTectonicMetadata)
            .catch(function (error) {
                console.warn("USGS scientific context is unavailable for this event.", error);
                return {};
            }));
    }
    return eventDetailCache.get(parsedUrl.href);
}

function buildPopupContent(props) {
    var eventTime = new Date(Number(props.time)).toLocaleString();
    var content = document.createElement("div");
    content.className = "quake-popup";

    var heading = document.createElement("h3");
    heading.textContent = props.place || "Unknown location";
    content.appendChild(heading);

    if (props.isChampion === true || props.isChampion === "true") {
        var championBadge = document.createElement("p");
        championBadge.className = "champion-badge";
        var championDepthKey = props.depthKey || getDepthRangeKey(props.depth);
        var championDepthRange = depthRangeDefinitions.find(function (range) {
            return range.key === championDepthKey;
        }) || depthRangeDefinitions[1];
        championBadge.appendChild(createChampionEpicenterBadge(championDepthRange.color));
        championBadge.appendChild(document.createTextNode("Strongest in the " + (props.championGroup || "unknown") + " group for this range"));
        content.appendChild(championBadge);
    }

    appendPopupRow(content, "Magnitude", formatMagnitudeLabel(props.mag));
    appendPopupRow(content, "Depth", props.depth + " km");
    appendPopupRow(content, "Country/area", props.displayRegion || "Unknown");
    appendPopupRow(content, "Type", props.type || "earthquake");
    appendPopupRow(content, "Time", eventTime, true);
    if (props.enrichmentState === "loading") {
        appendPopupRow(content, "USGS context", "Loading scientific details…", true);
    }
    if (Array.isArray(props.faults) && props.faults.length) {
        appendPopupRow(content, "Named fault/zone", props.faults.join(", "), true);
    }
    if (Array.isArray(props.plates) && props.plates.length) {
        appendPopupRow(content, "Tectonic plates", props.plates.join(", "), true);
    }
    if (props.tectonicContext) {
        appendPopupRow(content, "Plate tectonics", props.tectonicContext, true);
    }
    return content;
}

function setActiveQuakePopup(popup) {
    var previousPopup = activeQuakePopup;
    activeQuakePopup = popup || null;
    if (previousPopup && previousPopup !== popup) {
        previousPopup.remove();
    }

    if (activeQuakePopup && typeof activeQuakePopup.on === "function") {
        activeQuakePopup.on("close", function () {
            if (activeQuakePopup === popup) {
                activeQuakePopup = null;
                clearSelectedQuakeState();
            }
        });
    }
    return activeQuakePopup;
}

function openQuakePopup(coordinates, properties) {
    var popupProperties = Object.assign({}, properties, properties.detail ? { enrichmentState: "loading" } : {});
    var popup = new maplibregl.Popup({ maxWidth: "340px", offset: 10 })
        .setLngLat(coordinates)
        .setDOMContent(buildPopupContent(popupProperties));

    setActiveQuakePopup(popup);
    popup.addTo(globeMap);

    if (properties.detail) {
        getEventDetail(properties.detail).then(function (metadata) {
            if (!popup.isOpen()) {
                return;
            }
            popup.setDOMContent(buildPopupContent(Object.assign({}, properties, metadata)));
        });
    }
    return popup;
}

function getQuakeIdentity(feature) {
    if (!feature) {
        return null;
    }
    if (feature.id !== undefined && feature.id !== null) {
        return String(feature.id);
    }
    if (feature.properties && feature.properties.eventId) {
        return String(feature.properties.eventId);
    }
    if (feature.properties && feature.properties.code) {
        return String(feature.properties.code);
    }
    return null;
}

function getVisibleGeojson() {
    return {
        type: "FeatureCollection",
        features: currentGeojson.features.filter(function (feature) {
            return activeDepthRanges.has(feature.properties.depthKey);
        })
    };
}

function refreshEarthquakeSource() {
    if (mapLoaded && globeMap && globeMap.getSource("earthquakes")) {
        globeMap.getSource("earthquakes").setData(getVisibleGeojson());
    }
}

function selectQuake(feature) {
    var identity = getQuakeIdentity(feature);
    if (!identity) {
        return;
    }

    selectedQuakeId = identity;
    currentGeojson.features.forEach(function (quake) {
        quake.properties.isSelected = getQuakeIdentity(quake) === selectedQuakeId;
    });
    refreshEarthquakeSource();
}

function clearSelectedQuakeState(refreshSource) {
    selectedQuakeId = null;
    currentGeojson.features.forEach(function (quake) {
        quake.properties.isSelected = false;
    });
    if (refreshSource !== false) {
        refreshEarthquakeSource();
    }
}

function clearQuakeSelection(refreshSource) {
    setActiveQuakePopup(null);
    clearSelectedQuakeState(refreshSource);
}

function flyToQuake(feature) {
    if (!feature || !globeMap || !mapLoaded) {
        return;
    }

    setAutoRotate(false);
    selectQuake(feature);
    if (compactViewportQuery.matches) {
        document.getElementById("map-wrap").scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "start"
        });
    }
    var coords = feature.geometry.coordinates.slice(0, 2);
    globeMap.flyTo({ center: coords, zoom: 4.5, duration: 2200, essential: false });
    openQuakePopup(coords, feature.properties);
}

function resetGlobeView() {
    if (!globeMap || !mapLoaded) {
        return;
    }

    clearQuakeSelection();
    setAutoRotate(false);
    globeMap.flyTo({ center: [-40, 25], zoom: 1.6, duration: 1800, essential: false });
}

function updateRotationControl() {
    if (!rotationControlButton) {
        return;
    }

    var label = autoRotate ? "Pause globe rotation" : "Resume globe rotation";
    rotationControlButton.title = label;
    rotationControlButton.setAttribute("aria-label", label);
    rotationControlButton.setAttribute("aria-pressed", String(autoRotate));
    rotationControlButton.textContent = autoRotate ? "Ⅱ" : "▶";
}

function setAutoRotate(enabled) {
    autoRotate = Boolean(enabled);
    updateRotationControl();
    if (autoRotate) {
        startAutoRotate();
    }
}

function startAutoRotate() {
    if (rotationAnimationId !== null || !autoRotate || !globeMap) {
        return;
    }

    function spin() {
        if (!autoRotate || !globeMap) {
            rotationAnimationId = null;
            return;
        }
        var center = globeMap.getCenter();
        center.lng += 0.025;
        globeMap.jumpTo({ center: center });
        rotationAnimationId = requestAnimationFrame(spin);
    }
    rotationAnimationId = requestAnimationFrame(spin);
}

function getChampionPingFrame(elapsed, phaseOffset) {
    var duration = 2200;
    var time = Number.isFinite(Number(elapsed)) ? Number(elapsed) : 0;
    var offset = Number.isFinite(Number(phaseOffset)) ? Number(phaseOffset) : 0;
    var phase = (((time / duration) + offset) % 1 + 1) % 1;
    var easedPhase = 1 - Math.pow(1 - phase, 2);
    return {
        phase: phase,
        expansion: 4 + (18 * easedPhase),
        opacity: 0.78 * Math.pow(1 - phase, 1.45)
    };
}

function getChampionPingRadiusExpression(expansion) {
    return [
        "+",
        [
            "interpolate", ["linear"], ["coalesce", ["get", "mag"], 0],
            0, 13,
            4, 18,
            6, 24,
            8, 32
        ],
        expansion
    ];
}

function setChampionPingLayerFrame(layerId, frame) {
    if (!globeMap || !globeMap.getLayer(layerId)) {
        return;
    }
    globeMap.setPaintProperty(layerId, "circle-radius", getChampionPingRadiusExpression(frame.expansion));
    globeMap.setPaintProperty(layerId, "circle-opacity", frame.opacity * 0.13);
    globeMap.setPaintProperty(layerId, "circle-stroke-opacity", frame.opacity);
}

function hasVisiblePingCandidates(features, activeRanges) {
    var ranges = activeRanges instanceof Set ? activeRanges : new Set(activeRanges || []);
    return Array.isArray(features) && features.some(function (feature) {
        var properties = feature && feature.properties;
        return properties && ranges.has(properties.depthKey) &&
            (properties.isChampion === true || properties.isSummaryHighlight === true);
    });
}

function getChampionPingMotionMode(options) {
    if (!options.hasMap || !options.hasLayerA || !options.hasLayerB || !options.quakesVisible ||
            !options.hasCandidates || options.documentHidden) {
        return "off";
    }
    return options.reducedMotion ? "static" : "animated";
}

function getCurrentChampionPingMotionMode() {
    return getChampionPingMotionMode({
        hasMap: Boolean(globeMap),
        hasLayerA: Boolean(globeMap && globeMap.getLayer("quake-champion-ping-a")),
        hasLayerB: Boolean(globeMap && globeMap.getLayer("quake-champion-ping-b")),
        quakesVisible: quakesVisible,
        hasCandidates: hasVisiblePingCandidates(currentGeojson.features, activeDepthRanges),
        documentHidden: document.hidden,
        reducedMotion: reducedMotionQuery.matches
    });
}

function transitionChampionPingMotion(options) {
    if (options.animationId !== null && options.animationId !== undefined) {
        options.cancelFrame(options.animationId);
    }
    if (options.mode === "static") {
        options.applyStaticFrames();
        return null;
    }
    if (options.mode === "animated") {
        return options.requestFrame(options.renderFrame);
    }
    return null;
}

function renderChampionPings(timestamp) {
    if (getCurrentChampionPingMotionMode() !== "animated") {
        championPingAnimationId = null;
        return;
    }

    if (!championPingLastFrame || timestamp - championPingLastFrame >= 32) {
        championPingLastFrame = timestamp;
        setChampionPingLayerFrame("quake-champion-ping-a", getChampionPingFrame(timestamp, 0));
        setChampionPingLayerFrame("quake-champion-ping-b", getChampionPingFrame(timestamp, 0.5));
    }
    championPingAnimationId = requestAnimationFrame(renderChampionPings);
}

function syncChampionPingMotion() {
    championPingLastFrame = 0;
    var motionMode = getCurrentChampionPingMotionMode();
    championPingAnimationId = transitionChampionPingMotion({
        animationId: championPingAnimationId,
        mode: motionMode,
        cancelFrame: function (animationId) {
            cancelAnimationFrame(animationId);
        },
        requestFrame: function (callback) {
            return requestAnimationFrame(callback);
        },
        renderFrame: renderChampionPings,
        applyStaticFrames: function () {
            setChampionPingLayerFrame("quake-champion-ping-a", getChampionPingFrame(0, 0.16));
            setChampionPingLayerFrame("quake-champion-ping-b", getChampionPingFrame(0, 0.62));
        }
    });
}

function handleReducedMotionChange(event) {
    if (event && event.matches) {
        setAutoRotate(false);
    }
    syncChampionPingMotion();
    return {
        reducedMotion: Boolean(event && event.matches),
        autoRotate: autoRotate
    };
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
        glyphs: "https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=" + API_KEY,
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

function getDepthColorExpression(lightenAmount) {
    var expression = ["match", ["get", "depthKey"]];
    depthRangeDefinitions.forEach(function (range) {
        expression.push(range.key);
        expression.push(lightenAmount ? hexChannelMix(range.color, 255, lightenAmount) : range.color);
    });
    expression.push(lightenAmount ? hexChannelMix(depthRangeDefinitions[0].color, 255, lightenAmount) : depthRangeDefinitions[0].color);
    return expression;
}

function createPyramidImage(color) {
    var width = 72;
    var height = 66;
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    var apex = { x: 36, y: 5 };
    var left = { x: 8, y: 54 };
    var front = { x: 37, y: 62 };
    var right = { x: 64, y: 52 };

    ctx.beginPath();
    ctx.ellipse(36, 62, 25, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(2, 6, 23, 0.34)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(front.x, front.y);
    ctx.closePath();
    var lightFace = ctx.createLinearGradient(12, 18, 43, 58);
    lightFace.addColorStop(0, hexChannelMix(color, 255, 0.72));
    lightFace.addColorStop(0.48, hexChannelMix(color, 255, 0.18));
    lightFace.addColorStop(1, hexChannelMix(color, 0, 0.22));
    ctx.fillStyle = lightFace;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(front.x, front.y);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    var darkFace = ctx.createLinearGradient(35, 8, 61, 57);
    darkFace.addColorStop(0, hexChannelMix(color, 255, 0.28));
    darkFace.addColorStop(0.55, color);
    darkFace.addColorStop(1, hexChannelMix(color, 0, 0.52));
    ctx.fillStyle = darkFace;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(front.x, front.y);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.58)";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y + 1);
    ctx.lineTo(front.x, front.y - 1);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
    ctx.lineWidth = 1;
    ctx.stroke();

    return ctx.getImageData(0, 0, width, height);
}

function createCubeImage(color) {
    var width = 72;
    var height = 66;
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");

    ctx.beginPath();
    ctx.ellipse(36, 62, 25, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(2, 6, 23, 0.34)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(36, 5);
    ctx.lineTo(64, 20);
    ctx.lineTo(36, 36);
    ctx.lineTo(8, 20);
    ctx.closePath();
    var topFace = ctx.createLinearGradient(13, 10, 58, 31);
    topFace.addColorStop(0, hexChannelMix(color, 255, 0.8));
    topFace.addColorStop(0.55, hexChannelMix(color, 255, 0.3));
    topFace.addColorStop(1, color);
    ctx.fillStyle = topFace;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(8, 20);
    ctx.lineTo(36, 36);
    ctx.lineTo(36, 62);
    ctx.lineTo(8, 47);
    ctx.closePath();
    var leftFace = ctx.createLinearGradient(8, 22, 37, 57);
    leftFace.addColorStop(0, hexChannelMix(color, 255, 0.22));
    leftFace.addColorStop(1, hexChannelMix(color, 0, 0.28));
    ctx.fillStyle = leftFace;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(64, 20);
    ctx.lineTo(64, 47);
    ctx.lineTo(36, 62);
    ctx.lineTo(36, 36);
    ctx.closePath();
    var rightFace = ctx.createLinearGradient(37, 31, 63, 55);
    rightFace.addColorStop(0, color);
    rightFace.addColorStop(1, hexChannelMix(color, 0, 0.56));
    ctx.fillStyle = rightFace;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(36, 5);
    ctx.lineTo(64, 20);
    ctx.lineTo(64, 47);
    ctx.lineTo(36, 62);
    ctx.lineTo(8, 47);
    ctx.lineTo(8, 20);
    ctx.closePath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, 20);
    ctx.lineTo(36, 36);
    ctx.lineTo(64, 20);
    ctx.moveTo(36, 36);
    ctx.lineTo(36, 62);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.34)";
    ctx.lineWidth = 1;
    ctx.stroke();

    return ctx.getImageData(0, 0, width, height);
}

function createSphereImage(color) {
    var width = 72;
    var height = 66;
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    var cx = width / 2;
    var cy = height / 2;
    var radius = 27;

    // The sphere is centered on its geographic point so it reads as set into the surface.
    var sphereGrad = ctx.createRadialGradient(cx - 10, cy - 11, 2, cx, cy, radius * 1.08);
    sphereGrad.addColorStop(0, hexChannelMix(color, 255, 0.76));
    sphereGrad.addColorStop(0.3, hexChannelMix(color, 255, 0.2));
    sphereGrad.addColorStop(0.67, color);
    sphereGrad.addColorStop(1, hexChannelMix(color, 0, 0.58));
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = sphereGrad;
    ctx.fill();

    // A tight highlight adds gloss without flattening the sphere.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    var highlight = ctx.createRadialGradient(cx - 11, cy - 12, 1, cx - 11, cy - 12, 15);
    highlight.addColorStop(0, "rgba(255, 255, 255, 0.94)");
    highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.ellipse(cx - 10, cy - 11, 14, 10, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = highlight;
    ctx.fill();

    var lowerReflection = ctx.createRadialGradient(cx + 8, cy + 15, 1, cx + 8, cy + 15, 15);
    lowerReflection.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    lowerReflection.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy + 16, 13, 8, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = lowerReflection;
    ctx.fill();
    ctx.restore();

    // Fine rim keeps pale spheres distinct from light basemaps.
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    return ctx.getImageData(0, 0, width, height);
}

function createSelectionRingImage() {
    var width = 88;
    var height = 82;
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    var cx = width / 2;
    var cy = height / 2;

    var glow = ctx.createRadialGradient(cx, cy, 27, cx, cy, 39);
    glow.addColorStop(0, "rgba(125, 211, 252, 0)");
    glow.addColorStop(0.68, "rgba(125, 211, 252, 0.18)");
    glow.addColorStop(1, "rgba(125, 211, 252, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, 39, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 33, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 37, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    return ctx.getImageData(0, 0, width, height);
}

function createChampionSelectionRingImage() {
    var width = 128;
    var height = 128;
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    var cx = width / 2;
    var cy = height / 2;

    var glow = ctx.createRadialGradient(cx, cy, 50, cx, cy, 61);
    glow.addColorStop(0, "rgba(125, 211, 252, 0)");
    glow.addColorStop(0.65, "rgba(125, 211, 252, 0.22)");
    glow.addColorStop(1, "rgba(125, 211, 252, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, 61, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 54, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.98)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
    ctx.lineWidth = 2;
    ctx.stroke();

    return ctx.getImageData(0, 0, width, height);
}

function createEpicenterImage(color) {
    var width = 104;
    var height = 104;
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    var cx = width / 2;
    var cy = height / 2;
    var coreR = 24;
    var innerRingR = 33;
    var outerRingR = 42;

    // A symmetric halo keeps the epicenter visible without lifting it off the globe.
    var glow = ctx.createRadialGradient(cx, cy, innerRingR, cx, cy, 48);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    glow.addColorStop(0.52, hexChannelMix(color, 255, 0.48));
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.restore();

    // Broken seismic rings distinguish regional champions from ordinary spheres.
    [
        { radius: outerRingR, dash: [16, 7], offset: 1 },
        { radius: innerRingR, dash: [11, 6], offset: -4 }
    ].forEach(function (ring) {
        ctx.save();
        ctx.setLineDash(ring.dash);
        ctx.lineDashOffset = ring.offset;
        ctx.beginPath();
        ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = hexChannelMix(color, 0, 0.62);
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = hexChannelMix(color, 255, 0.68);
        ctx.lineWidth = 2.25;
        ctx.stroke();
        ctx.restore();
    });

    // The depth-colored spherical core remains centered on the earthquake coordinate.
    var coreGrad = ctx.createRadialGradient(cx - 8, cy - 9, 2, cx, cy, coreR * 1.08);
    coreGrad.addColorStop(0, hexChannelMix(color, 255, 0.86));
    coreGrad.addColorStop(0.32, hexChannelMix(color, 255, 0.28));
    coreGrad.addColorStop(0.7, color);
    coreGrad.addColorStop(1, hexChannelMix(color, 0, 0.5));
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();
    ctx.strokeStyle = hexChannelMix(color, 0, 0.7);
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, coreR - 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.68)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // A compact highlight preserves the glossy sphere language of regular markers.
    var highlight = ctx.createRadialGradient(cx - 9, cy - 10, 1, cx - 9, cy - 10, 14);
    highlight.addColorStop(0, "rgba(255, 255, 255, 0.94)");
    highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, coreR - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(cx - 9, cy - 10, 13, 9, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = highlight;
    ctx.fill();
    ctx.restore();

    return ctx.getImageData(0, 0, width, height);
}

function createChampionEpicenterBadge(color) {
    var canvas = document.createElement("canvas");
    canvas.width = 104;
    canvas.height = 104;
    canvas.className = "champion-epicenter-badge";
    canvas.setAttribute("aria-hidden", "true");
    canvas.getContext("2d").putImageData(createEpicenterImage(color), 0, 0);
    return canvas;
}

function applyDepthFilters() {
    if (!globeMap || !globeMap.getLayer("quake-spheres")) {
        return;
    }

    var active = Array.from(activeDepthRanges);
    globeMap.setFilter("quake-spheres", [
        "all",
        ["in", ["get", "depthKey"], ["literal", active]],
        ["!=", ["get", "isChampion"], true]
    ]);
    globeMap.setLayoutProperty("quake-spheres", "visibility", quakesVisible ? "visible" : "none");

    if (globeMap.getLayer("quake-champions")) {
        globeMap.setFilter("quake-champions", [
            "all",
            ["in", ["get", "depthKey"], ["literal", active]],
            ["==", ["get", "isChampion"], true]
        ]);
        globeMap.setLayoutProperty("quake-champions", "visibility", quakesVisible ? "visible" : "none");
    }

    ["quake-clusters", "quake-cluster-count", "quake-champion-ping-a", "quake-champion-ping-b", "quake-selection", "quake-champion-selection"].forEach(function (layerId) {
        if (globeMap.getLayer(layerId)) {
            globeMap.setLayoutProperty(layerId, "visibility", quakesVisible ? "visible" : "none");
        }
    });
    syncChampionPingMotion();
    refreshEarthquakeSource();
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

    var selectedQuake = selectedQuakeId && currentGeojson.features.find(function (feature) {
        return getQuakeIdentity(feature) === selectedQuakeId;
    });
    if (selectedQuake && !activeDepthRanges.has(selectedQuake.properties.depthKey)) {
        clearQuakeSelection(false);
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

function resetMapFilters() {
    activeDepthRanges = new Set(depthRangeDefinitions.map(function (range) {
        return range.key;
    }));
    quakesVisible = true;

    var quakeInput = document.getElementById("quake-visibility");
    if (quakeInput) {
        quakeInput.checked = true;
    }
    document.querySelectorAll(".legend-toggle").forEach(function (button) {
        button.classList.remove("is-off");
        button.setAttribute("aria-pressed", "true");
        var state = button.querySelector(".legend-state");
        if (state) {
            state.textContent = "On";
        }
    });
    applyDepthFilters();
}

function setMapPanelExpanded(panel, button, content, expanded) {
    panel.classList.toggle("is-expanded", expanded);
    button.setAttribute("aria-expanded", String(expanded));
    content.hidden = !expanded;
}

function buildMapPanels() {
    var wrap = document.getElementById("map-wrap");
    if (!wrap) {
        return;
    }

    var basePanel = document.createElement("div");
    basePanel.className = "map-panel base-panel";

    var baseHeader = document.createElement("button");
    baseHeader.type = "button";
    baseHeader.className = "base-panel-header";
    baseHeader.setAttribute("aria-controls", "map-layer-options");
    baseHeader.setAttribute("aria-label", "Map layers, Light Map selected");
    baseHeader.innerHTML = '<span aria-hidden="true">◫</span><span>Layers</span><span class="base-current">Light</span>';
    basePanel.appendChild(baseHeader);

    var baseContent = document.createElement("div");
    baseContent.id = "map-layer-options";
    baseContent.className = "base-panel-content";

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
            var current = baseHeader.querySelector(".base-current");
            if (current) {
                current.textContent = baseStyleIds[key].label.replace(" Map", "");
            }
            baseHeader.setAttribute("aria-label", "Map layers, " + baseStyleIds[key].label + " selected");
            if (compactViewportQuery.matches) {
                setMapPanelExpanded(basePanel, baseHeader, baseContent, false);
                baseHeader.focus();
            }
        });

        var text = document.createElement("span");
        text.textContent = baseStyleIds[key].label;

        label.appendChild(input);
        label.appendChild(text);
        baseContent.appendChild(label);
    });

    var divider = document.createElement("div");
    divider.className = "base-divider";
    baseContent.appendChild(divider);

    var quakeToggle = document.createElement("label");
    quakeToggle.className = "base-option";
    var quakeInput = document.createElement("input");
    quakeInput.type = "checkbox";
    quakeInput.id = "quake-visibility";
    quakeInput.checked = true;
    quakeInput.addEventListener("change", function (event) {
        quakesVisible = event.target.checked;
        if (!quakesVisible) {
            clearQuakeSelection(false);
        }
        applyDepthFilters();
        if (compactViewportQuery.matches) {
            setMapPanelExpanded(basePanel, baseHeader, baseContent, false);
            baseHeader.focus();
        }
    });
    var quakeText = document.createElement("span");
    quakeText.textContent = "Earthquakes";
    quakeToggle.appendChild(quakeInput);
    quakeToggle.appendChild(quakeText);
    baseContent.appendChild(quakeToggle);
    basePanel.appendChild(baseContent);

    baseHeader.addEventListener("click", function () {
        var expanded = baseHeader.getAttribute("aria-expanded") === "true";
        setMapPanelExpanded(basePanel, baseHeader, baseContent, !expanded);
    });

    var legendPanel = document.createElement("div");
    legendPanel.className = "map-panel legend-panel";

    var header = document.createElement("button");
    header.type = "button";
    header.className = "legend-header";
    header.setAttribute("aria-controls", "earthquake-legend-content");

    var heading = document.createElement("h3");
    heading.textContent = "Map legend";
    var chevron = document.createElement("span");
    chevron.className = "legend-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "▾";
    header.appendChild(heading);
    header.appendChild(chevron);
    legendPanel.appendChild(header);

    var content = document.createElement("div");
    content.id = "earthquake-legend-content";
    content.className = "legend-content";
    header.addEventListener("click", function () {
        var expanded = header.getAttribute("aria-expanded") === "true";
        setMapPanelExpanded(legendPanel, header, content, !expanded);
    });

    var depthTitle = document.createElement("p");
    depthTitle.className = "legend-subtitle";
    depthTitle.textContent = "Depth";
    content.appendChild(depthTitle);

    var list = document.createElement("div");
    list.className = "legend-list";

    depthRangeDefinitions.forEach(function (range) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "legend-toggle";
        button.dataset.depthKey = range.key;
        button.setAttribute("aria-pressed", "true");
        button.innerHTML = '<span class="legend-swatch" style="background:' + range.color + '"></span><span class="legend-label">' + range.label.replace(" km", '<span class="legend-unit"> km</span>') + '</span><span class="legend-state">On</span>';
        button.addEventListener("click", function () {
            toggleDepthRange(range.key);
        });
        list.appendChild(button);
    });

    content.appendChild(list);

    var magnitudeLegend = document.createElement("div");
    magnitudeLegend.className = "magnitude-legend";
    magnitudeLegend.innerHTML = '<p class="legend-subtitle">Magnitude · label &amp; size</p><div class="magnitude-scale"><span class="magnitude-item"><i class="magnitude-shape is-sphere"></i><span class="legend-desktop-copy">Sphere marker<br><small>Number = magnitude</small></span><span class="legend-mobile-copy">Magnitude</span></span></div>';
    content.appendChild(magnitudeLegend);

    var championNote = document.createElement("p");
    championNote.className = "legend-note";
    championNote.appendChild(createChampionEpicenterBadge(depthRangeDefinitions[1].color));
    var championDesktopCopy = document.createElement("span");
    championDesktopCopy.className = "legend-desktop-copy";
    championDesktopCopy.textContent = "Strongest quake per broad geographic group";
    var championMobileCopy = document.createElement("span");
    championMobileCopy.className = "legend-mobile-copy";
    championMobileCopy.textContent = "Champion";
    championNote.appendChild(championDesktopCopy);
    championNote.appendChild(championMobileCopy);
    content.appendChild(championNote);

    var clusterNote = document.createElement("p");
    clusterNote.className = "legend-note";
    clusterNote.innerHTML = '<span class="cluster-legend-icon" aria-hidden="true">12</span><span class="legend-desktop-copy">Numbered circles group nearby events; select one to zoom in</span><span class="legend-mobile-copy">Clusters</span>';
    content.appendChild(clusterNote);

    var resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "legend-reset";
    resetButton.innerHTML = '<span class="legend-reset-icon" aria-hidden="true">↺</span><span class="legend-desktop-copy">Reset map filters</span><span class="legend-mobile-copy">Reset</span>';
    resetButton.addEventListener("click", resetMapFilters);
    content.appendChild(resetButton);

    legendPanel.appendChild(content);

    function syncPanelsForViewport(event) {
        var compact = event ? event.matches : compactViewportQuery.matches;
        var restoreBaseFocus = compact && baseContent.contains(document.activeElement);
        setMapPanelExpanded(basePanel, baseHeader, baseContent, !compact);
        if (!event) {
            setMapPanelExpanded(legendPanel, header, content, true);
        }
        if (restoreBaseFocus) {
            baseHeader.focus();
        }
    }
    syncPanelsForViewport();
    if (compactViewportQuery.addEventListener) {
        compactViewportQuery.addEventListener("change", syncPanelsForViewport);
    } else {
        compactViewportQuery.addListener(syncPanelsForViewport);
    }

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

function createRotationControl() {
    var container;
    return {
        onAdd: function () {
            container = document.createElement("div");
            container.className = "maplibregl-ctrl maplibregl-ctrl-group";

            rotationControlButton = document.createElement("button");
            rotationControlButton.type = "button";
            rotationControlButton.className = "rotation-control";
            rotationControlButton.addEventListener("click", function () {
                setAutoRotate(!autoRotate);
            });
            updateRotationControl();

            container.appendChild(rotationControlButton);
            return container;
        },
        onRemove: function () {
            rotationControlButton = null;
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
        maxZoom: 18,
        attributionControl: false
    });

    globeMap.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    globeMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    globeMap.addControl(createHomeControl(), "top-left");
    globeMap.addControl(createRotationControl(), "top-left");

    var geolocate = new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserLocation: true,
        fitBoundsOptions: { zoom: 8 }
    });
    globeMap.addControl(geolocate, "top-left");
    geolocate.on("geolocate", function () {
        setAutoRotate(false);
    });

    lastEasterEggZoom = globeMap.getZoom();
    globeMap.on("zoomend", function () {
        handleZoomEasterEgg(globeMap.getZoom());
    });

    window.earthquakeApp.getMap = function () { return globeMap; };

    globeMap.on("load", function () {
        globeMap.setProjection({ type: "globe" });

        globeMap.addSource("earthquakes", {
            type: "geojson",
            data: getVisibleGeojson(),
            cluster: true,
            clusterMaxZoom: 3,
            clusterRadius: 48
        });

        depthRangeDefinitions.forEach(function (range) {
            globeMap.addImage("sphere-" + range.key, createSphereImage(range.color), { pixelRatio: 2 });
            globeMap.addImage("epicenter-" + range.key, createEpicenterImage(range.color), { pixelRatio: 2 });
        });
        globeMap.addImage("selection-ring", createSelectionRingImage(), { pixelRatio: 2 });
        globeMap.addImage("champion-selection-ring", createChampionSelectionRingImage(), { pixelRatio: 2 });

        globeMap.addLayer({
            id: "quake-clusters",
            type: "circle",
            source: "earthquakes",
            filter: ["has", "point_count"],
            paint: {
                "circle-color": [
                    "step", ["get", "point_count"],
                    "rgba(14, 165, 233, 0.82)",
                    25, "rgba(37, 99, 235, 0.86)",
                    100, "rgba(109, 40, 217, 0.9)"
                ],
                "circle-radius": [
                    "step", ["get", "point_count"],
                    17,
                    25, 22,
                    100, 28
                ],
                "circle-stroke-width": 2,
                "circle-stroke-color": "rgba(255, 255, 255, 0.9)"
            }
        });

        globeMap.addLayer({
            id: "quake-cluster-count",
            type: "symbol",
            source: "earthquakes",
            filter: ["has", "point_count"],
            layout: {
                "text-field": ["get", "point_count_abbreviated"],
                "text-size": 12,
                "text-font": ["Open Sans Bold"]
            },
            paint: {
                "text-color": "#ffffff"
            }
        });

        ["a", "b"].forEach(function (wave) {
            globeMap.addLayer({
                id: "quake-champion-ping-" + wave,
                type: "circle",
                source: "earthquakes",
                filter: [
                    "any",
                    ["==", ["get", "isChampion"], true],
                    ["==", ["get", "isSummaryHighlight"], true]
                ],
                paint: {
                    "circle-radius": getChampionPingRadiusExpression(4),
                    "circle-color": getDepthColorExpression(0),
                    "circle-opacity": 0.08,
                    "circle-blur": 0.25,
                    "circle-stroke-width": 2,
                    "circle-stroke-color": getDepthColorExpression(0.62),
                    "circle-stroke-opacity": 0.72
                }
            });
        });

        globeMap.addLayer({
            id: "quake-selection",
            type: "symbol",
            source: "earthquakes",
            filter: [
                "all",
                ["==", ["get", "isSelected"], true],
                ["!=", ["get", "isChampion"], true]
            ],
            layout: {
                "icon-image": "selection-ring",
                "icon-size": [
                    "interpolate", ["linear"], ["coalesce", ["get", "mag"], 0],
                    0, 0.45,
                    4, 0.85,
                    6, 1.25,
                    8, 1.7
                ],
                "icon-anchor": "center",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true
            }
        });

        globeMap.addLayer({
            id: "quake-spheres",
            type: "symbol",
            source: "earthquakes",
            layout: {
                "icon-image": ["concat", ["get", "shapeKey"], "-", ["get", "depthKey"]],
                "icon-size": [
                    "interpolate", ["linear"], ["zoom"],
                    1, [
                        "interpolate", ["linear"], ["coalesce", ["get", "mag"], 0],
                        0, 0.34, 2, 0.44, 4, 0.62, 6, 0.9, 8, 1.2
                    ],
                    5, [
                        "interpolate", ["linear"], ["coalesce", ["get", "mag"], 0],
                        0, 0.45, 2, 0.6, 4, 0.85, 6, 1.25, 8, 1.7
                    ]
                ],
                "icon-anchor": "center",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "text-field": ["get", "magnitudeLabel"],
                "text-font": ["Open Sans Bold"],
                "text-size": [
                    "interpolate", ["linear"], ["coalesce", ["get", "mag"], 0],
                    0, 7.5,
                    3.5, 9,
                    6.5, 10.5,
                    8, 12
                ],
                "text-offset": [0, 0],
                "text-anchor": "center",
                "text-allow-overlap": true,
                "text-ignore-placement": true,
                "text-optional": false,
                "symbol-sort-key": ["coalesce", ["get", "mag"], 0]
            },
            paint: {
                "icon-opacity": 0.95,
                "text-color": "#ffffff",
                "text-halo-color": "rgba(15, 23, 42, 0.96)",
                "text-halo-width": 1.25,
                "text-halo-blur": 0.25
            }
        });

        var championIconSize = [
            "interpolate", ["linear"], ["coalesce", ["get", "mag"], 0],
            0, 0.55,
            4, 0.75,
            6, 1.0,
            8, 1.35
        ];

        globeMap.addLayer({
            id: "quake-champions",
            type: "symbol",
            source: "earthquakes",
            layout: {
                "icon-image": ["concat", "epicenter-", ["get", "depthKey"]],
                "icon-size": championIconSize,
                "icon-anchor": "center",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "text-field": ["get", "magnitudeLabel"],
                "text-font": ["Open Sans Bold"],
                "text-size": [
                    "interpolate", ["linear"], ["coalesce", ["get", "mag"], 0],
                    0, 8,
                    4, 9.5,
                    6, 11,
                    8, 12.5
                ],
                "text-offset": [0, 0],
                "text-anchor": "center",
                "text-allow-overlap": true,
                "text-ignore-placement": true,
                "text-optional": false
            },
            paint: {
                "icon-opacity": 1,
                "text-color": "#fff7d6",
                "text-halo-color": "rgba(69, 26, 3, 0.98)",
                "text-halo-width": 1.5,
                "text-halo-blur": 0.25
            }
        });

        // Champion artwork has its own larger, topmost ring so selection stays visible.
        globeMap.addLayer({
            id: "quake-champion-selection",
            type: "symbol",
            source: "earthquakes",
            filter: [
                "all",
                ["==", ["get", "isSelected"], true],
                ["==", ["get", "isChampion"], true]
            ],
            layout: {
                "icon-image": "champion-selection-ring",
                "icon-size": championIconSize,
                "icon-anchor": "center",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true
            }
        });

        function handleQuakeClick(event) {
            var feature = event.features && event.features[0];
            if (!feature) {
                return;
            }

            selectQuake(feature);
            openQuakePopup(feature.geometry.coordinates.slice(0, 2), feature.properties);
        }

        globeMap.on("click", "quake-spheres", handleQuakeClick);
        globeMap.on("click", "quake-champions", handleQuakeClick);
        globeMap.on("click", "quake-clusters", function (event) {
            var cluster = event.features && event.features[0];
            if (!cluster) {
                return;
            }
            var source = globeMap.getSource("earthquakes");
            Promise.resolve(source.getClusterExpansionZoom(cluster.properties.cluster_id))
                .then(function (zoom) {
                    setAutoRotate(false);
                    globeMap.easeTo({
                        center: cluster.geometry.coordinates.slice(0, 2),
                        zoom: zoom,
                        duration: 900,
                        essential: false
                    });
                });
        });

        ["quake-spheres", "quake-champions", "quake-clusters"].forEach(function (layerId) {
            globeMap.on("mouseenter", layerId, function () {
                globeMap.getCanvas().style.cursor = "pointer";
            });
            globeMap.on("mouseleave", layerId, function () {
                globeMap.getCanvas().style.cursor = "";
            });
        });

        applyDepthFilters();
        mapLoaded = true;
        syncChampionPingMotion();

        if (currentGeojson.features.length) {
            refreshEarthquakeSource();
        }

        ["mousedown", "touchstart", "wheel", "dblclick"].forEach(function (eventName) {
            globeMap.on(eventName, function () {
                setAutoRotate(false);
            });
        });
        var loadedAttribution = globeMap.getContainer().querySelector(".maplibregl-ctrl-attrib.maplibregl-compact-show");
        var attributionToggle = loadedAttribution && loadedAttribution.querySelector(".maplibregl-ctrl-attrib-button");
        if (attributionToggle) {
            attributionToggle.click();
        }
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
    var announcementEl = document.getElementById("feed-announcement");

    if (!quakes.length) {
        highlightQuakes = { strongest: null, deepest: null, latest: null };
        if (totalEl) totalEl.textContent = "0";
        if (strongestEl) strongestEl.textContent = "—";
        if (deepestEl) deepestEl.textContent = "0 km";
        if (latestEl) {
            latestEl.textContent = "--";
            latestEl.removeAttribute("title");
        }
        if (announcementEl) announcementEl.textContent = "No earthquakes were found for this range.";
        return;
    }

    var strongestQuake = quakes.reduce(function (best, quake) {
        var magnitude = getNumericMagnitude(quake.properties.mag);
        if (magnitude === null) return best;
        return !best || magnitude > getNumericMagnitude(best.properties.mag) ? quake : best;
    }, null);

    var deepestQuake = quakes.reduce(function (best, quake) {
        return Number(quake.geometry.coordinates[2] || 0) > Number(best.geometry.coordinates[2] || 0) ? quake : best;
    }, quakes[0]);

    var latestQuake = quakes.reduce(function (latest, quake) {
        return quake.properties.time > latest.properties.time ? quake : latest;
    }, quakes[0]);

    highlightQuakes = { strongest: strongestQuake, deepest: deepestQuake, latest: latestQuake };
    quakes.forEach(function (quake) {
        quake.properties.isStrongest = quake === strongestQuake;
        quake.properties.isDeepest = quake === deepestQuake;
        quake.properties.isLatest = quake === latestQuake;
        quake.properties.isSummaryHighlight = quake.properties.isStrongest || quake.properties.isDeepest || quake.properties.isLatest;
    });

    if (totalEl) totalEl.textContent = quakes.length.toLocaleString();
    if (strongestEl) strongestEl.textContent = strongestQuake ? getNumericMagnitude(strongestQuake.properties.mag).toFixed(1) + " M" : "—";
    if (deepestEl) deepestEl.textContent = Number(deepestQuake.geometry.coordinates[2] || 0).toFixed(0) + " km";
    if (latestEl) {
        latestEl.textContent = formatRelativeTime(latestQuake.properties.time);
        latestEl.title = new Date(latestQuake.properties.time).toLocaleString();
    }
    if (announcementEl) {
        announcementEl.textContent = quakes.length.toLocaleString() + " earthquakes loaded; strongest " +
            (strongestQuake ? "magnitude " + getNumericMagnitude(strongestQuake.properties.mag).toFixed(1) : "magnitude unavailable") +
            "; deepest " + Number(deepestQuake.geometry.coordinates[2]).toFixed(0) + " kilometers.";
    }
}

function fetchEarthquakePages(startTime, endTime, seq, controller, offset, accumulatedFeatures) {
    var pageOffset = offset || 1;
    var features = accumulatedFeatures || [];

    return fetch(buildRangeUrl(startTime, endTime, pageOffset), { signal: controller.signal })
        .then(function (response) {
            if (!response.ok) {
                throw new Error("USGS request failed: " + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            if (seq !== requestSeq) {
                return [];
            }

            var pageFeatures = Array.isArray(data.features) ? data.features : [];
            features = features.concat(pageFeatures);
            if (pageFeatures.length === earthquakePageSize) {
                return fetchEarthquakePages(startTime, endTime, seq, controller, pageOffset + earthquakePageSize, features);
            }
            return features;
        });
}

function loadEarthquakeData(rangeKey) {
    var preset = typeof rangeKey === "number" ? getRangePresetFromSlider(rangeKey) : getRangePresetByKey(rangeKey);
    currentRange = preset.key;
    updateRangeControls(currentRange);
    setPillState("loading", preset.label);
    clearQuakeSelection();

    if (activeRequestController) {
        activeRequestController.abort();
    }
    activeRequestController = new AbortController();
    var seq = ++requestSeq;
    var endTime = new Date();
    var startTime = new Date(endTime.getTime() - (preset.hours * 60 * 60 * 1000));

    fetchEarthquakePages(startTime, endTime, seq, activeRequestController)
        .then(function (loadedFeatures) {
            if (seq !== requestSeq) {
                return;
            }

            var features = loadedFeatures.map(normalizeEarthquakeFeature).filter(Boolean);
            if (features.length !== loadedFeatures.length) {
                console.warn("Skipped " + (loadedFeatures.length - features.length) + " malformed USGS earthquake record(s).");
            }

            markRegionalChampions(features);

            selectedQuakeId = null;
            currentGeojson = { type: "FeatureCollection", features: features };
            lastSuccessfulRange = preset.key;
            hasSuccessfulFeed = true;
            updateSummary(currentGeojson);
            setPillState("live", preset.label);

            if (mapLoaded && globeMap.getSource("earthquakes")) {
                refreshEarthquakeSource();
                syncChampionPingMotion();
            }
        })
        .catch(function (error) {
            if (seq !== requestSeq || error.name === "AbortError") {
                return;
            }

            console.error("Failed to load earthquake data:", error);
            if (hasSuccessfulFeed) {
                currentRange = lastSuccessfulRange;
                updateRangeControls(currentRange);
                setPillState("stale", getRangePresetByKey(lastSuccessfulRange).label + " data");
            } else {
                setPillState("error", preset.label);
            }
        })
        .finally(function () {
            if (seq === requestSeq) {
                activeRequestController = null;
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

window.earthquakeApp = window.earthquakeApp || {};
window.earthquakeApp.test = {
    buildPopupContent: buildPopupContent,
    buildRangeUrl: buildRangeUrl,
    createChampionSelectionRingImage: createChampionSelectionRingImage,
    createEpicenterImage: createEpicenterImage,
    classifyGeography: classifyGeography,
    extractNamedFaults: extractNamedFaults,
    extractPlateNames: extractPlateNames,
    extractTectonicMetadata: extractTectonicMetadata,
    formatRelativeTime: formatRelativeTime,
    formatMagnitudeLabel: formatMagnitudeLabel,
    getEventDetail: getEventDetail,
    getChampionPingFrame: getChampionPingFrame,
    getChampionPingMotionMode: getChampionPingMotionMode,
    getChampionGroup: getChampionGroup,
    getCountryAt: getCountryAt,
    getDepthRangeKey: getDepthRangeKey,
    getDepthColorExpression: getDepthColorExpression,
    getMagnitudeShapeKey: getMagnitudeShapeKey,
    getNumericMagnitude: getNumericMagnitude,
    getOffshoreArea: getOffshoreArea,
    getQuakeIdentity: getQuakeIdentity,
    getRangePresetByKey: getRangePresetByKey,
    getZoomEasterEgg: getZoomEasterEgg,
    handleReducedMotionChange: handleReducedMotionChange,
    hasVisiblePingCandidates: hasVisiblePingCandidates,
    markRegionalChampions: markRegionalChampions,
    normalizeEarthquakeFeature: normalizeEarthquakeFeature,
    setActiveQuakePopup: setActiveQuakePopup,
    setMapPanelExpanded: setMapPanelExpanded,
    transitionChampionPingMotion: transitionChampionPingMotion,
    updateSummary: updateSummary
};

document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("map-id")) {
        return;
    }

    createMap();
    buildMapPanels();
    if (reducedMotionQuery.addEventListener) {
        reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    } else {
        reducedMotionQuery.addListener(handleReducedMotionChange);
    }
    document.addEventListener("visibilitychange", syncChampionPingMotion);
    var select = document.getElementById("range-select");
    if (select) {
        rangePresets.forEach(function (preset) {
            var option = document.createElement("option");
            option.value = preset.key;
            option.textContent = preset.label;
            select.appendChild(option);
        });
        select.addEventListener("change", function (event) {
            loadEarthquakeData(event.target.value);
        });
    }
    document.querySelectorAll(".range-preset").forEach(function (button) {
        button.addEventListener("click", function () {
            loadEarthquakeData(button.dataset.range);
        });
    });
    updateRangeControls(currentRange);

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
