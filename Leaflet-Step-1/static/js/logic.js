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
    streets: { id: "streets-v11", label: "Street Map" },
    satellite: { id: "satellite-streets-v11", label: "Satellite" },
    outdoors: { id: "outdoors-v11", label: "Terrain" }
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
let platesVisible = true;
let minMagnitude = 0;
let searchQuery = "";
let isTimelapsePlaying = false;
let timelapseTimer = null;
let timelapseProgress = 0;
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

const usStateMap = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
    "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
    "DC": "District of Columbia", "PR": "Puerto Rico", "VI": "Virgin Islands", "GU": "Guam", "MP": "Northern Mariana Islands", "AS": "American Samoa"
};

const canadianProvinceMap = {
    "BC": "British Columbia", "AB": "Alberta", "SK": "Saskatchewan", "MB": "Manitoba",
    "ON": "Ontario", "QC": "Quebec", "NB": "New Brunswick", "NS": "Nova Scotia",
    "PE": "Prince Edward Island", "NL": "Newfoundland and Labrador", "YT": "Yukon",
    "NT": "Northwest Territories", "NU": "Nunavut"
};

const countryAliases = {
    "US": ["usa", "united states", "america", "united states of america", "u.s.", "u.s.a."],
    "GB": ["uk", "united kingdom", "great britain", "britain", "england", "scotland", "wales"],
    "NZ": ["new zealand", "nz"],
    "PG": ["papua new guinea", "png"],
    "TR": ["turkey", "turkiye", "türkiye"],
    "DO": ["dominican republic", "dr"],
    "CD": ["dr congo", "congo", "drc"],
    "AE": ["uae", "united arab emirates"],
    "RU": ["russia", "russian federation"],
    "IR": ["iran", "islamic republic of iran"],
    "SY": ["syria", "syrian arab republic"],
    "KR": ["south korea", "korea", "rok"],
    "KP": ["north korea", "dprk"],
    "PH": ["philippines", "philippine"],
    "TW": ["taiwan", "roc"],
    "ID": ["indonesia", "indonesian"],
    "MX": ["mexico", "mexican"],
    "JP": ["japan", "japanese"],
    "CL": ["chile", "chilean"],
    "PE": ["peru", "peruvian"],
    "IS": ["iceland", "icelandic"],
    "GR": ["greece", "greek"],
    "IT": ["italy", "italian"]
};

function resolveLocationTokens(place, countryName, countryCode, lon, lat) {
    var rawPlace = String(place || "").trim();
    var foundState = null;
    var foundStateCode = null;
    var resolvedCountry = countryName || null;
    var resolvedCountryCode = countryCode || null;
    var aliases = new Set();

    // Check US states in place (e.g. ", CA", ", California", "of Cobb, CA")
    for (var code in usStateMap) {
        var stateName = usStateMap[code];
        var stateRegex = new RegExp("(?:,\\s*|\\b)" + code + "\\b", "i");
        var nameRegex = new RegExp("\\b" + stateName + "\\b", "i");
        if (stateRegex.test(rawPlace) || nameRegex.test(rawPlace)) {
            foundState = stateName;
            foundStateCode = code;
            if (!resolvedCountry) {
                resolvedCountry = "United States";
                resolvedCountryCode = "US";
            }
            break;
        }
    }

    // Check Canadian provinces in place (e.g. ", BC", ", British Columbia")
    if (!foundState) {
        for (var pCode in canadianProvinceMap) {
            var provName = canadianProvinceMap[pCode];
            var provRegex = new RegExp("(?:,\\s*|\\b)" + pCode + "\\b", "i");
            var pNameRegex = new RegExp("\\b" + provName + "\\b", "i");
            if (provRegex.test(rawPlace) || pNameRegex.test(rawPlace)) {
                foundState = provName;
                foundStateCode = pCode;
                if (!resolvedCountry) {
                    resolvedCountry = "Canada";
                    resolvedCountryCode = "CA";
                }
                break;
            }
        }
    }

    // If still no country, check place string endings like ", Japan", ", Chile", ", Mexico", ", Indonesia"
    if (!resolvedCountry) {
        for (var cCode in countryAliases) {
            var list = countryAliases[cCode];
            for (var i = 0; i < list.length; i++) {
                var alias = list[i];
                var aRegex = new RegExp("(?:,\\s*|\\b)" + alias.replace(/\./g, "\\.") + "(?:\\b|$)", "i");
                if (aRegex.test(rawPlace)) {
                    resolvedCountryCode = cCode;
                    resolvedCountry = list[1] ? (list[1].charAt(0).toUpperCase() + list[1].slice(1)) : alias;
                    break;
                }
            }
            if (resolvedCountry) break;
        }
    }

    // Add country aliases
    if (resolvedCountryCode && countryAliases[resolvedCountryCode.toUpperCase()]) {
        countryAliases[resolvedCountryCode.toUpperCase()].forEach(function (a) {
            aliases.add(a.toLowerCase());
        });
    }

    if (foundState) {
        aliases.add(foundState.toLowerCase());
        aliases.add(foundStateCode.toLowerCase());
    }

    if (resolvedCountry) {
        aliases.add(resolvedCountry.toLowerCase());
    }

    var offshore = getOffshoreArea(lon, lat);
    if (offshore) {
        aliases.add(offshore.toLowerCase());
    }

    return {
        state: foundState,
        stateCode: foundStateCode,
        country: resolvedCountry,
        countryCode: resolvedCountryCode,
        aliases: Array.from(aliases)
    };
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

    var location = resolveLocationTokens(properties.place, properties.country, properties.countryCode, lon, lat);
    properties.state = location.state;
    properties.stateCode = location.stateCode;
    if (!properties.country && location.country) {
        properties.country = location.country;
        properties.countryCode = location.countryCode;
    }
    properties.locationAliases = location.aliases;

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
        if (!feature.properties.country && classification.country) {
            feature.properties.country = classification.country;
            feature.properties.countryCode = classification.countryCode;
        }

        var loc = resolveLocationTokens(feature.properties.place, feature.properties.country, feature.properties.countryCode, coords[0], coords[1]);
        if (loc.state) {
            feature.properties.state = loc.state;
            feature.properties.stateCode = loc.stateCode;
        }
        if (!feature.properties.country && loc.country) {
            feature.properties.country = loc.country;
            feature.properties.countryCode = loc.countryCode;
        }
        feature.properties.displayRegion = feature.properties.country
            ? (feature.properties.state ? feature.properties.state + ", " + feature.properties.country : feature.properties.country)
            : classification.displayRegion;
        feature.properties.championGroup = classification.championGroup;
        feature.properties.isChampion = false;

        var depth = Number(feature.properties.depth);
        var depthCat = depth <= 30 ? "shallow" : (depth > 70 ? "deep" : "intermediate");
        var terms = [
            feature.properties.place || "",
            feature.properties.state || "",
            feature.properties.stateCode || "",
            feature.properties.country || "",
            feature.properties.countryCode || "",
            feature.properties.displayRegion || "",
            feature.properties.championGroup || "",
            feature.properties.type || "",
            depthCat,
            "m" + (feature.properties.mag !== null ? feature.properties.mag : ""),
            "mag " + (feature.properties.mag !== null ? feature.properties.mag : "")
        ].concat(loc.aliases);
        feature.properties.searchIndex = terms.join(" ").toLowerCase();

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

function parseSearchQuery(query) {
    if (!query || !String(query).trim()) {
        return { raw: "", minMag: null, depthCategory: null, terms: [] };
    }
    var raw = String(query).trim().toLowerCase();
    var minMag = null;
    var depthCategory = null;

    // Detect magnitude queries: "5+", "m5", "m5.2", "mag 4.5", "magnitude 6", ">=4.5", ">4.5", "m4+"
    var explicitMagPattern = /\b(?:m|mag|magnitude)\s*([0-9]+(?:\.[0-9]+)?)\+?(?:\b|(?=[\s,]|$))|\b([0-9]+(?:\.[0-9]+)?)\+(?:\b|(?=[\s,]|$))|(?:>=|>)\s*([0-9]+(?:\.[0-9]+)?)/i;
    var explicitMatch = raw.match(explicitMagPattern);
    if (explicitMatch) {
        var magVal = Number(explicitMatch[1] || explicitMatch[2] || explicitMatch[3]);
        if (Number.isFinite(magVal)) {
            minMag = magVal;
            raw = raw.replace(explicitMagPattern, " ").trim();
        }
    }

    // Detect depth categories: "shallow", "deep", "intermediate"
    if (/\bshallow\b/i.test(raw)) {
        depthCategory = "shallow";
        raw = raw.replace(/\bshallow\b/i, " ").trim();
    } else if (/\bdeep\b/i.test(raw)) {
        depthCategory = "deep";
        raw = raw.replace(/\bdeep\b/i, " ").trim();
    } else if (/\bintermediate\b/i.test(raw)) {
        depthCategory = "intermediate";
        raw = raw.replace(/\bintermediate\b/i, " ").trim();
    }

    var terms = raw.split(/[\s,]+/).map(function (t) { return t.trim(); }).filter(Boolean);
    return {
        raw: String(query).trim(),
        minMag: minMag,
        depthCategory: depthCategory,
        terms: terms
    };
}

function matchesSearchQuery(feature, query) {
    if (!query || !String(query).trim()) {
        return true;
    }
    var parsed = typeof query === "object" && query.terms !== undefined ? query : parseSearchQuery(query);
    if (!parsed.terms.length && parsed.minMag === null && !parsed.depthCategory) {
        return true;
    }
    var props = feature && feature.properties;
    if (!props) {
        return false;
    }

    // Check magnitude threshold from query
    if (parsed.minMag !== null) {
        var mag = getNumericMagnitude(props.mag);
        if (mag === null || mag < parsed.minMag) {
            return false;
        }
    }

    // Check depth category from query
    if (parsed.depthCategory) {
        var depth = Number(props.depth);
        if (!Number.isFinite(depth)) return false;
        if (parsed.depthCategory === "shallow" && depth > 30) return false;
        if (parsed.depthCategory === "deep" && depth <= 70) return false;
        if (parsed.depthCategory === "intermediate" && (depth <= 30 || depth > 70)) return false;
    }

    if (!parsed.terms.length) {
        return true;
    }

    var index = props.searchIndex || [
        props.place || "",
        props.state || "",
        props.stateCode || "",
        props.country || "",
        props.countryCode || "",
        props.displayRegion || "",
        props.championGroup || "",
        props.type || ""
    ].join(" ").toLowerCase();

    // Every term in the query must match
    for (var i = 0; i < parsed.terms.length; i++) {
        var term = parsed.terms[i];
        if (term.length === 2) {
            // For 2-letter codes (e.g. ca, ak, us, jp), match state/country code or word boundary
            var wordRegex = new RegExp("(?:\\b|[^a-z0-9])" + term + "(?:\\b|[^a-z0-9])", "i");
            var stateCode = (props.stateCode || "").toLowerCase();
            var countryCode = (props.countryCode || "").toLowerCase();
            if (stateCode !== term && countryCode !== term && !wordRegex.test(index)) {
                return false;
            }
        } else {
            if (!index.includes(term)) {
                return false;
            }
        }
    }

    return true;
}

function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = String(text || "");
    return div.innerHTML;
}

function fitFeaturesBounds(features) {
    if (!features || !features.length || !globeMap || !mapLoaded) {
        return;
    }
    setAutoRotate(false);
    if (features.length === 1) {
        flyToQuake(features[0]);
        return;
    }

    var minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    features.forEach(function (f) {
        if (!f || !f.geometry || !Array.isArray(f.geometry.coordinates)) return;
        var lon = Number(f.geometry.coordinates[0]);
        var lat = Number(f.geometry.coordinates[1]);
        if (Number.isFinite(lon) && Number.isFinite(lat)) {
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        }
    });

    if (!Number.isFinite(minLon)) return;

    if (maxLon - minLon > 260) {
        globeMap.flyTo({ center: [0, 20], zoom: 1.8, duration: 1800, essential: false });
        return;
    }

    globeMap.fitBounds([[minLon, minLat], [maxLon, maxLat]], {
        padding: { top: 70, bottom: 70, left: 70, right: 70 },
        maxZoom: 7.5,
        duration: 1800,
        essential: false
    });
}

function renderSearchSuggestions(query, matches) {
    var searchBox = document.querySelector(".search-box");
    if (!searchBox) return;

    var container = document.getElementById("search-suggestions");
    if (!container) {
        container = document.createElement("div");
        container.id = "search-suggestions";
        container.className = "search-suggestions";
        container.setAttribute("role", "listbox");
        container.setAttribute("aria-label", "Search earthquake suggestions");
        searchBox.appendChild(container);
    }

    var term = String(query || "").trim();
    if (!term) {
        container.hidden = true;
        container.innerHTML = "";
        return;
    }

    container.hidden = false;
    container.innerHTML = "";

    var header = document.createElement("div");
    header.className = "search-suggestions-header";
    var countText = document.createElement("span");
    countText.className = "search-suggestions-count";
    countText.textContent = matches.length === 1 ? "1 earthquake match" : matches.length + " earthquake matches";
    header.appendChild(countText);

    if (matches.length > 1) {
        var zoomAllBtn = document.createElement("button");
        zoomAllBtn.type = "button";
        zoomAllBtn.className = "search-suggestions-zoomall";
        zoomAllBtn.textContent = "Fit map to all";
        zoomAllBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            fitFeaturesBounds(matches);
            container.hidden = true;
        });
        header.appendChild(zoomAllBtn);
    }
    container.appendChild(header);

    if (!matches.length) {
        var noResults = document.createElement("div");
        noResults.className = "search-no-results";
        var msg = document.createElement("p");
        var rangeLabel = getRangePresetByKey(currentRange).label;
        msg.innerHTML = "No earthquakes matching <strong>" + escapeHtml(term) + "</strong> in the <strong>" + rangeLabel + "</strong> feed.";
        noResults.appendChild(msg);

        var quickActions = document.createElement("div");
        quickActions.className = "search-quick-actions";

        if (currentRange !== "7d") {
            var btn7d = document.createElement("button");
            btn7d.type = "button";
            btn7d.className = "search-range-quickbtn";
            btn7d.textContent = "Search 7-Day Feed";
            btn7d.addEventListener("click", function () {
                loadEarthquakeData("7d");
            });
            quickActions.appendChild(btn7d);
        }
        if (currentRange !== "30d") {
            var btn30d = document.createElement("button");
            btn30d.type = "button";
            btn30d.className = "search-range-quickbtn";
            btn30d.textContent = "Search 30-Day Feed";
            btn30d.addEventListener("click", function () {
                loadEarthquakeData("30d");
            });
            quickActions.appendChild(btn30d);
        }
        if (minMagnitude > 0) {
            var btnResetMag = document.createElement("button");
            btnResetMag.type = "button";
            btnResetMag.className = "search-range-quickbtn";
            btnResetMag.textContent = "Clear Mag Filter (All)";
            btnResetMag.addEventListener("click", function () {
                var allChip = document.querySelector('.mag-filter-chip[data-mag="0"]');
                if (allChip) allChip.click();
            });
            quickActions.appendChild(btnResetMag);
        }
        noResults.appendChild(quickActions);
        container.appendChild(noResults);
        return;
    }

    var list = document.createElement("div");
    list.className = "search-suggestions-list";
    var maxItems = 6;
    var slice = matches.slice(0, maxItems);

    slice.forEach(function (feature) {
        var props = feature.properties;
        var item = document.createElement("button");
        item.type = "button";
        item.className = "search-suggestion-item";
        item.setAttribute("role", "option");

        var magBadge = document.createElement("span");
        magBadge.className = "search-item-mag";
        var depthKey = props.depthKey || getDepthRangeKey(props.depth);
        var def = depthRangeDefinitions.find(function (d) { return d.key === depthKey; }) || depthRangeDefinitions[0];
        magBadge.style.backgroundColor = def.color;
        magBadge.textContent = (props.magnitudeLabel || formatMagnitudeLabel(props.mag)) + " M";
        item.appendChild(magBadge);

        var textCol = document.createElement("div");
        textCol.className = "search-item-text";

        var title = document.createElement("div");
        title.className = "search-item-title";
        title.textContent = props.place || "Unknown location";
        textCol.appendChild(title);

        var meta = document.createElement("div");
        meta.className = "search-item-meta";
        var timeStr = formatEventTime(props.time);
        meta.textContent = (props.depth || "0") + " km depth · " + timeStr;
        textCol.appendChild(meta);

        item.appendChild(textCol);

        item.addEventListener("click", function () {
            flyToQuake(feature);
            container.hidden = true;
        });

        list.appendChild(item);
    });

    container.appendChild(list);

    if (matches.length > maxItems) {
        var footer = document.createElement("div");
        footer.className = "search-suggestions-footer";
        footer.textContent = "+ " + (matches.length - maxItems) + " more earthquakes on the map";
        container.appendChild(footer);
    }
}

function matchesMagnitudeFilter(magnitude, minMag) {
    var min = Number(minMag) || 0;
    if (min <= 0) {
        return true;
    }
    var val = getNumericMagnitude(magnitude);
    return val !== null && val >= min;
}

function getFilteredFeatures(features, options) {
    var depthSet = options && options.activeDepthRanges ? options.activeDepthRanges : activeDepthRanges;
    var minMag = options && options.minMagnitude !== undefined ? options.minMagnitude : minMagnitude;
    var query = options && options.searchQuery !== undefined ? options.searchQuery : searchQuery;
    var timeMax = options && options.timelapseTimeMax !== undefined ? options.timelapseTimeMax : null;

    var list = Array.isArray(features) ? features : (currentGeojson.features || []);
    return list.filter(function (feature) {
        if (!feature || !feature.properties) {
            return false;
        }
        var props = feature.properties;
        if (!depthSet.has(props.depthKey)) {
            return false;
        }
        if (!matchesMagnitudeFilter(props.mag, minMag)) {
            return false;
        }
        if (!matchesSearchQuery(feature, query)) {
            return false;
        }
        if (timeMax !== null && props.time > timeMax) {
            return false;
        }
        return true;
    });
}

function getVisibleGeojson() {
    var timeMax = null;
    if (isTimelapsePlaying) {
        var sorted = currentGeojson.features.slice().sort(function (a, b) { return a.properties.time - b.properties.time; });
        if (sorted.length) {
            var minT = sorted[0].properties.time;
            var maxT = sorted[sorted.length - 1].properties.time;
            timeMax = minT + ((maxT - minT) * (timelapseProgress / 100));
        }
    }

    return {
        type: "FeatureCollection",
        features: getFilteredFeatures(currentGeojson.features, { timelapseTimeMax: timeMax })
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
        var step = compactViewportQuery.matches ? 0.18 : 0.09;
        center.lng += step;
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

// =========================================================================
// --- HMS Aetheria · Victorian Retro-Fantasy Dirigible Orbital Module ---
// =========================================================================

var airshipVisible = true;
var isFollowingAirship = false;
var airshipAnimFrameId = null;
var airshipLastTime = 0;
var airshipProgress = 0.0;
var airshipActivePopup = null;
var airshipAudioCtx = null;

var airshipWaypoints = [
    { name: "Tokyo & Izu-Ogasawara Trench", lon: 139.75, lat: 35.68, note: "Barometric pressure steady at 30.1 inHg. Seismic sensors calibrated." },
    { name: "Kuril-Kamchatka Subduction Arc", lon: 156.0, lat: 50.5, note: "Dense volcanic mist sighted over Kamchatka caldera vents." },
    { name: "Aleutian Trench (Bering Sea)", lon: -175.0, lat: 52.5, note: "Riding strong westerly etheric trade winds across the northern arc." },
    { name: "Cascadia Subduction Zone (Pacific NW)", lon: -123.3, lat: 48.5, note: "Logging megathrust harmonic vibrations along the Juan de Fuca plate." },
    { name: "San Andreas Fault (California)", lon: -120.5, lat: 36.0, note: "Overflying the Great Rift; searchlights scanning fault scarps below." },
    { name: "Middle America Trench (Oaxaca)", lon: -96.5, lat: 15.5, note: "Steam turbines humming at 48 knots in warm tropical crosswinds." },
    { name: "Galapagos & Cocos Ridge", lon: -90.5, lat: 0.5, note: "Equatorial crossing; astrolabe and magnetic compass synchronised." },
    { name: "Peru-Chile Trench (Nazca Subduction)", lon: -71.5, lat: -22.0, note: "Deep megathrust seismological survey in progress." },
    { name: "Scotia Sea & Drake Passage", lon: -55.0, lat: -56.0, note: "Icebergs glistening under searchlight in the Southern Ocean." },
    { name: "Mid-Atlantic Ridge (Equatorial Rift)", lon: -28.0, lat: -2.0, note: "Hydrothermal plume readings registered on the acoustic resonator." },
    { name: "Azores Hotspot (North Atlantic)", lon: -26.0, lat: 38.5, note: "Fair winds and clear skies; afternoon tea served on the bridge." },
    { name: "London (Royal Geographic Society)", lon: -0.1, lat: 51.5, note: "Transmitting telegraphic seismic dispatches to the Admiralty." },
    { name: "Swiss Alps (Alpine Orogeny)", lon: 8.5, lat: 46.5, note: "Glacial massifs gleaming beneath our mahogany keel." },
    { name: "Hellenic Arc (Santorini & Aegean)", lon: 23.5, lat: 36.0, note: "Volcanic fumaroles of Santorini illuminated off the starboard bow." },
    { name: "Red Sea & East African Rift", lon: 38.0, lat: 20.0, note: "Continental spreading rift clearly demarcated across the desert." },
    { name: "Himalayan Frontal Thrust (Everest)", lon: 87.0, lat: 28.0, note: "Cruising above the roof of the world; continental collision zone." },
    { name: "Sunda Trench & Krakatoa", lon: 105.0, lat: -6.0, note: "Active volcanic acoustics picked up by our ventral phonograph." },
    { name: "Mariana Trench (Challenger Deep)", lon: 142.5, lat: 11.5, note: "Scanning the deepest abyss on Earth; buoyancy locked at 3,850 m." },
    { name: "Kermadec-Tonga Trench", lon: 177.0, lat: -30.0, note: "Pacific ring of fire active; deep-focus quake tremors logged." },
    { name: "Hawaii Hotspot (Kilauea)", lon: -155.5, lat: 19.5, note: "Lava fountains of Kilauea illuminating the night clouds." }
];

function createAirshipImage() {
    var width = 240;
    var height = 120;
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    var scale = 2;
    ctx.scale(scale, scale);

    var cx = 60;
    var cy = 30;

    // Searchlight beam glow forward-downward
    var beamGrad = ctx.createRadialGradient(cx + 42, cy + 8, 2, cx + 55, cy + 18, 25);
    beamGrad.addColorStop(0, "rgba(254, 240, 138, 0.45)");
    beamGrad.addColorStop(0.4, "rgba(250, 204, 21, 0.15)");
    beamGrad.addColorStop(1, "rgba(250, 204, 21, 0)");
    ctx.beginPath();
    ctx.moveTo(cx + 36, cy + 7);
    ctx.lineTo(cx + 58, cy + 16);
    ctx.lineTo(cx + 50, cy + 24);
    ctx.closePath();
    ctx.fillStyle = beamGrad;
    ctx.fill();

    // 1. Gas Envelope Outer Glow / Atmospheric Shimmer
    var haloGrad = ctx.createRadialGradient(cx, cy - 2, 10, cx, cy - 2, 42);
    haloGrad.addColorStop(0, "rgba(251, 191, 36, 0.3)");
    haloGrad.addColorStop(0.7, "rgba(245, 158, 11, 0.08)");
    haloGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
    ctx.beginPath();
    ctx.ellipse(cx, cy - 3, 44, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = haloGrad;
    ctx.fill();

    // 2. Tail Empennage Fins
    ctx.beginPath();
    ctx.moveTo(cx - 32, cy - 6);
    ctx.lineTo(cx - 48, cy - 18);
    ctx.lineTo(cx - 39, cy - 18);
    ctx.lineTo(cx - 24, cy - 8);
    ctx.closePath();
    ctx.fillStyle = "#b45309";
    ctx.fill();
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 32, cy);
    ctx.lineTo(cx - 48, cy + 12);
    ctx.lineTo(cx - 39, cy + 12);
    ctx.lineTo(cx - 24, cy + 2);
    ctx.closePath();
    ctx.fillStyle = "#78350f";
    ctx.fill();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Stern Navigation Lights (Ruby & Emerald)
    ctx.beginPath();
    ctx.arc(cx - 48, cy - 18, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 48, cy + 12, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "#10b981";
    ctx.fill();

    // 3. Main Golden Gas Envelope (Zeppelin Balloon)
    var hullGrad = ctx.createLinearGradient(cx - 40, cy - 18, cx + 40, cy + 12);
    hullGrad.addColorStop(0, "#78350f");
    hullGrad.addColorStop(0.2, "#b45309");
    hullGrad.addColorStop(0.45, "#fde68a");
    hullGrad.addColorStop(0.7, "#d97706");
    hullGrad.addColorStop(0.9, "#92400e");
    hullGrad.addColorStop(1, "#f59e0b");

    ctx.beginPath();
    ctx.moveTo(cx + 38, cy - 3);
    ctx.bezierCurveTo(cx + 35, cy - 16, cx + 10, cy - 17, cx - 12, cy - 15);
    ctx.bezierCurveTo(cx - 28, cy - 14, cx - 38, cy - 8, cx - 42, cy - 3);
    ctx.bezierCurveTo(cx - 38, cy + 2, cx - 28, cy + 8, cx - 12, cy + 9);
    ctx.bezierCurveTo(cx + 10, cy + 11, cx + 35, cy + 10, cx + 38, cy - 3);
    ctx.closePath();
    ctx.fillStyle = hullGrad;
    ctx.fill();
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Longitudinal Ribs & Girders
    ctx.strokeStyle = "rgba(120, 53, 15, 0.4)";
    ctx.lineWidth = 0.9;
    [-9, -4, 1, 6].forEach(function (offsetY) {
        ctx.beginPath();
        ctx.moveTo(cx - 40, cy - 3);
        ctx.bezierCurveTo(cx - 20, cy + offsetY * 1.2, cx + 15, cy + offsetY * 1.2, cx + 37, cy - 3);
        ctx.stroke();
    });

    // Scalloped Drapery Swags on Gasbag (from Image 4)
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 0.9;
    [-24, -10, 4, 18].forEach(function (sx) {
        ctx.beginPath();
        ctx.moveTo(cx + sx, cy - 1);
        ctx.quadraticCurveTo(cx + sx + 7, cy + 6, cx + sx + 14, cy - 1);
        ctx.stroke();
    });

    // Forward Pinnacle Spear
    ctx.beginPath();
    ctx.moveTo(cx + 38, cy - 3);
    ctx.lineTo(cx + 50, cy - 3);
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Top Mast & Swallowtail Pennant Flag ("THE AEONS VOYAGER")
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 16);
    ctx.lineTo(cx + 6, cy - 24);
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 24);
    ctx.lineTo(cx - 8, cy - 27);
    ctx.lineTo(cx - 3, cy - 24);
    ctx.lineTo(cx - 8, cy - 21);
    ctx.closePath();
    ctx.fillStyle = "#b45309";
    ctx.fill();
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // 4. Underslung Sailing Galleon Hull
    var galleonGrad = ctx.createLinearGradient(cx - 24, cy + 12, cx + 26, cy + 20);
    galleonGrad.addColorStop(0, "#451a03");
    galleonGrad.addColorStop(0.5, "#78350f");
    galleonGrad.addColorStop(1, "#b45309");

    ctx.beginPath();
    ctx.moveTo(cx - 24, cy + 12); // Sterncastle deck
    ctx.lineTo(cx - 24, cy + 18); // Stern keel
    ctx.quadraticCurveTo(cx - 6, cy + 24, cx + 18, cy + 22); // Keel bottom
    ctx.quadraticCurveTo(cx + 30, cy + 20, cx + 34, cy + 13); // High curved bow
    ctx.lineTo(cx + 30, cy + 12); // Bow deck
    ctx.quadraticCurveTo(cx + 4, cy + 8, cx - 24, cy + 12); // Sheer deck curve
    ctx.closePath();
    ctx.fillStyle = galleonGrad;
    ctx.fill();
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Aft Sterncastle Cabin Windows
    [-18, -12].forEach(function (wx) {
        ctx.beginPath();
        ctx.rect(cx + wx, cy + 10, 3.5, 3.5);
        ctx.fillStyle = "#fef08a";
        ctx.fill();
        ctx.strokeStyle = "#78350f";
        ctx.lineWidth = 0.5;
        ctx.stroke();
    });

    // Bowsprit Spar reaching forward from Prow
    ctx.beginPath();
    ctx.moveTo(cx + 32, cy + 14);
    ctx.lineTo(cx + 48, cy + 6);
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Rigging Cables connecting Galleon to Gasbag
    ctx.strokeStyle = "rgba(254, 240, 138, 0.7)";
    ctx.lineWidth = 0.7;
    [-20, -8, 4, 16, 26].forEach(function (sx) {
        ctx.beginPath();
        ctx.moveTo(cx + sx, cy + 11);
        ctx.lineTo(cx + sx * 0.9, cy + 7);
        ctx.stroke();
    });

    // 5. THE SIGNATURE HANGING GLOWING LANTERN
    // Suspension Chain
    ctx.beginPath();
    ctx.moveTo(cx + 48, cy + 6);
    ctx.lineTo(cx + 48, cy + 12);
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Lantern Body
    ctx.beginPath();
    ctx.rect(cx + 44, cy + 12, 8, 10);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Inner Glowing Flame
    ctx.beginPath();
    ctx.arc(cx + 48, cy + 17, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Radiant Golden Light Halo around Lantern & Forward Beam
    var lanternHalo = ctx.createRadialGradient(cx + 48, cy + 17, 2, cx + 48, cy + 17, 20);
    lanternHalo.addColorStop(0, "rgba(254, 240, 138, 0.85)");
    lanternHalo.addColorStop(0.4, "rgba(245, 158, 11, 0.45)");
    lanternHalo.addColorStop(1, "rgba(245, 158, 11, 0)");
    ctx.beginPath();
    ctx.arc(cx + 48, cy + 17, 20, 0, Math.PI * 2);
    ctx.fillStyle = lanternHalo;
    ctx.fill();

    // Forward Searchlight Cone from Lantern
    var beamGrad = ctx.createRadialGradient(cx + 48, cy + 17, 4, cx + 80, cy + 30, 40);
    beamGrad.addColorStop(0, "rgba(254, 240, 138, 0.65)");
    beamGrad.addColorStop(0.3, "rgba(251, 191, 36, 0.35)");
    beamGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.beginPath();
    ctx.moveTo(cx + 48, cy + 17);
    ctx.lineTo(cx + 90, cy + 10);
    ctx.lineTo(cx + 80, cy + 45);
    ctx.closePath();
    ctx.fillStyle = beamGrad;
    ctx.fill();

    // 6. Propellers & Engines
    // Stern Pusher Propeller
    ctx.beginPath();
    ctx.ellipse(cx - 26, cy + 15, 1.5, 6, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(254, 240, 138, 0.85)";
    ctx.fill();

    // Outrigger Turbines & Steam
    ctx.beginPath();
    ctx.ellipse(cx - 2, cy + 7, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#292524";
    ctx.fill();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Steam Drift
    var steamGrad = ctx.createRadialGradient(cx - 6, cy + 3, 0.5, cx - 14, cy + 2, 6);
    steamGrad.addColorStop(0, "rgba(255, 255, 255, 0.6)");
    steamGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.25)");
    steamGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.arc(cx - 8, cy + 3, 2.5, 0, Math.PI * 2);
    ctx.arc(cx - 13, cy + 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = steamGrad;
    ctx.fill();

    return ctx.getImageData(0, 0, width, height);
}

var SATELLITE_ORBIT = {
    inclinationDeg: 51.6, // Low Earth Orbit standard inclination
    nodeLonDeg: -60.0,    // Ascending node longitude offset
    periodSec: 120,       // 2 minutes for 1 full orbital revolution around the planet
    altitude: "420 km (Low Earth Orbit · 3,850 m Equivalent)",
    speed: "7.66 km/s (27,600 km/h · 48 knots Cruise)",
    orbitType: "Low Earth Orbit (LEO Satellite)",
    inclination: "51.6° LEO"
};

function calculateOrbitCoordinates(progress) {
    var u = ((progress % 1.0) + 1.0) % 1.0;
    var theta = u * Math.PI * 2;
    var incRad = (SATELLITE_ORBIT.inclinationDeg * Math.PI) / 180;

    // Exact spherical satellite orbital trigonometry
    var latRad = Math.asin(Math.sin(incRad) * Math.sin(theta));
    var lat = (latRad * 180) / Math.PI;

    var dLonRad = Math.atan2(Math.cos(incRad) * Math.sin(theta), Math.cos(theta));
    var rawLon = SATELLITE_ORBIT.nodeLonDeg + (dLonRad * 180) / Math.PI;
    var lon = ((rawLon + 540) % 360) - 180;

    return { lon: lon, lat: lat, u: u };
}

function findNearestOverflight(lon, lat) {
    if (!airshipWaypoints || !airshipWaypoints.length) {
        return { name: "Global Orbital Track", note: "Scanning tectonic subduction zones from satellite orbit." };
    }
    var bestWp = airshipWaypoints[0];
    var bestDist = Infinity;
    for (var i = 0; i < airshipWaypoints.length; i++) {
        var wp = airshipWaypoints[i];
        var dLat = (wp.lat - lat) * (Math.PI / 180);
        var dLon = (((wp.lon - lon + 540) % 360) - 180) * (Math.PI / 180);
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat * Math.PI / 180) * Math.cos(wp.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var dist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (dist < bestDist) {
            bestDist = dist;
            bestWp = wp;
        }
    }
    return bestWp;
}

function buildAirshipOrbitGeoJSON() {
    var features = [];
    var steps = 360;
    var coords = [];

    for (var s = 0; s <= steps; s++) {
        var u = s / steps;
        var pt = calculateOrbitCoordinates(u);
        coords.push([pt.lon, pt.lat]);
    }

    // Segment across antimeridian for clean rendering
    var segments = [[]];
    for (var i = 0; i < coords.length; i++) {
        var p = coords[i];
        var currSeg = segments[segments.length - 1];
        if (currSeg.length > 0) {
            var prevP = currSeg[currSeg.length - 1];
            if (Math.abs(p[0] - prevP[0]) > 180) {
                segments.push([p]);
                continue;
            }
        }
        currSeg.push(p);
    }

    segments.forEach(function (seg, idx) {
        if (seg.length > 1) {
            features.push({
                type: "Feature",
                properties: { id: "orbit-seg-" + idx },
                geometry: { type: "LineString", coordinates: seg }
            });
        }
    });

    return { type: "FeatureCollection", features: features };
}

function getAirshipPosition(progress) {
    var pt = calculateOrbitCoordinates(progress);

    // Compute instantaneous velocity / heading vector along orbit
    var ptNext = calculateOrbitCoordinates(progress + 0.001);
    var deltaLon = ((ptNext.lon - pt.lon + 540) % 360) - 180;
    var dy = (ptNext.lat - pt.lat) * (Math.PI / 180);
    var dx = deltaLon * (Math.PI / 180) * Math.cos(pt.lat * Math.PI / 180);
    var bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;

    // Icon points East (90 deg) in canvas, so iconHeading = (bearing - 90 + 360) % 360
    var iconHeading = (bearing - 90 + 360) % 360;
    var headingCompass = formatCompassHeading(bearing);

    var landmark = findNearestOverflight(pt.lon, pt.lat);

    return {
        lon: Number(pt.lon.toFixed(4)),
        lat: Number(pt.lat.toFixed(4)),
        bearing: Number(bearing.toFixed(1)),
        iconHeading: Number(iconHeading.toFixed(1)),
        headingCompass: headingCompass,
        currentWaypoint: landmark.name,
        nextWaypoint: "Global Satellite Orbit (51.6° Inclination)",
        note: landmark.note,
        altitude: SATELLITE_ORBIT.altitude,
        speed: SATELLITE_ORBIT.speed,
        orbitType: SATELLITE_ORBIT.orbitType,
        inclination: SATELLITE_ORBIT.inclination
    };
}

function formatCompassHeading(deg) {
    var points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    var idx = Math.round(deg / 22.5) % 16;
    return String(Math.round(deg)).padStart(3, "0") + "° " + points[idx];
}

function getAirshipGeoJSON(state) {
    return {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [state.lon, state.lat]
                },
                properties: {
                    name: "HMS Aetheria",
                    registry: "No. 1894-A",
                    class: "Royal Seismological Survey Dirigible",
                    altitude: state.altitude,
                    speed: state.speed,
                    heading: state.headingCompass,
                    iconHeading: state.iconHeading,
                    currentWaypoint: state.currentWaypoint,
                    nextWaypoint: state.nextWaypoint,
                    note: state.note,
                    lon: state.lon,
                    lat: state.lat
                }
            }
        ]
    };
}

function initAirshipModule() {
    if (!globeMap || !globeMap.getSource("airship")) return;

    function stepFlight(timestamp) {
        if (!airshipLastTime) airshipLastTime = timestamp;
        var elapsed = timestamp - airshipLastTime;
        airshipLastTime = timestamp;

        // Satellite orbital cruise: 1 full orbit around the planet in 120 seconds (2 minutes)
        if (airshipVisible) {
            airshipProgress = (airshipProgress + (elapsed / 120000)) % 1.0;
            var pos = getAirshipPosition(airshipProgress);
            var src = globeMap.getSource("airship");
            if (src) {
                src.setData(getAirshipGeoJSON(pos));
            }

            // Update topbar airship badge if present
            var badge = document.getElementById("airship-status-pill");
            if (badge) {
                badge.textContent = "🛰️ HMS Aetheria";
            }
            var flyBtn = document.getElementById("fly-to-airship");
            if (flyBtn) {
                flyBtn.title = "HMS Aetheria · Satellite Orbit over " + pos.currentWaypoint + " (Alt: " + pos.altitude + " · " + pos.speed + ")";
            }

            // Update camera if follow mode is active
            if (isFollowingAirship && globeMap) {
                globeMap.easeTo({
                    center: [pos.lon, pos.lat],
                    duration: 100,
                    easing: function (x) { return x; }
                });
            }
        }

        airshipAnimFrameId = requestAnimationFrame(stepFlight);
    }

    if (airshipAnimFrameId) cancelAnimationFrame(airshipAnimFrameId);
    airshipAnimFrameId = requestAnimationFrame(stepFlight);
}

function setAirshipVisibility(visible) {
    airshipVisible = Boolean(visible);
    if (!globeMap) return;
    var visStr = airshipVisible ? "visible" : "none";
    ["airship-orbit-path", "airship-searchlight", "airship-symbol"].forEach(function (layerId) {
        if (globeMap.getLayer(layerId)) {
            globeMap.setLayoutProperty(layerId, "visibility", visStr);
        }
    });
    if (!airshipVisible && isFollowingAirship) {
        toggleFollowAirship(false);
    }
}

function toggleFollowAirship(forcedState) {
    if (typeof forcedState === "boolean") {
        isFollowingAirship = forcedState;
    } else {
        isFollowingAirship = !isFollowingAirship;
    }
    var followBtn = document.getElementById("airship-follow-btn");
    if (followBtn) {
        followBtn.classList.toggle("is-active", isFollowingAirship);
        followBtn.textContent = isFollowingAirship ? "🔭 Lock Camera (Active)" : "🔭 Follow Airship";
    }
    if (isFollowingAirship) {
        var pos = getAirshipPosition(airshipProgress);
        if (globeMap) {
            globeMap.flyTo({ center: [pos.lon, pos.lat], zoom: 4.5, speed: 1.2 });
        }
    }
}

function soundSteamWhistle() {
    try {
        if (!airshipAudioCtx) {
            var AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) airshipAudioCtx = new AudioContext();
        }
        if (airshipAudioCtx && airshipAudioCtx.state === "suspended") {
            airshipAudioCtx.resume();
        }
        if (!airshipAudioCtx) return;

        var now = airshipAudioCtx.currentTime;
        // Harmonic whistle chords: D5 (587 Hz), F#5 (740 Hz), A5 (880 Hz)
        var freqs = [587.3, 739.9, 880.0];
        var masterGain = airshipAudioCtx.createGain();
        masterGain.gain.setValueAtTime(0.001, now);
        masterGain.gain.exponentialRampToValueAtTime(0.18, now + 0.15);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        masterGain.connect(airshipAudioCtx.destination);

        freqs.forEach(function (f) {
            var osc = airshipAudioCtx.createOscillator();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(f, now);
            osc.frequency.linearRampToValueAtTime(f * 1.02, now + 0.5);
            var oscGain = airshipAudioCtx.createGain();
            oscGain.gain.value = 0.33;
            osc.connect(oscGain);
            oscGain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 1.25);
        });

        // Trigger visual steam puff animation on popup
        var puffEl = document.getElementById("airship-whistle-puff");
        if (puffEl) {
            puffEl.classList.remove("puff-active");
            void puffEl.offsetWidth; // Reflow
            puffEl.classList.add("puff-active");
        }
    } catch (e) {
        console.log("Audio whistle playback omitted:", e);
    }
}

function build3DAirshipMesh(THREE) {
    if (!THREE) return null;
    var ship = new THREE.Group();

    // Materials
    var goldEnvelopeMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.24,
        metalness: 0.88,
        emissive: 0x451a03,
        emissiveIntensity: 0.25
    });

    var brightBrassMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        roughness: 0.15,
        metalness: 0.96
    });

    var bronzeMat = new THREE.MeshStandardMaterial({
        color: 0x92400e,
        roughness: 0.35,
        metalness: 0.85
    });

    var woodHullMat = new THREE.MeshStandardMaterial({
        color: 0x451a03,
        roughness: 0.5,
        metalness: 0.25,
        emissive: 0x1c0c04,
        emissiveIntensity: 0.1
    });

    var woodDeckMat = new THREE.MeshStandardMaterial({
        color: 0x78350f,
        roughness: 0.6,
        metalness: 0.2
    });

    var windowGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    var lanternGlassMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.6,
        transparent: true,
        opacity: 0.88
    });

    // 1. TOP ZEPPELIN GASBAG (Balloon Envelope)
    var hullGeo = new THREE.SphereGeometry(2.1, 64, 40);
    var posAttr = hullGeo.attributes.position;
    for (var i = 0; i < posAttr.count; i++) {
        var x = posAttr.getX(i);
        var y = posAttr.getY(i);
        var z = posAttr.getZ(i);

        x = x * 2.5;
        if (x < 0) {
            var taper = 1.0 + (x / 6.8) * 0.45;
            y *= Math.max(0.18, taper);
            z *= Math.max(0.18, taper);
        } else {
            var noseTaper = 1.0 - (x / 6.2) * 0.15;
            y *= Math.max(0.28, noseTaper);
            z *= Math.max(0.28, noseTaper);
        }
        posAttr.setXYZ(i, x, y, z);
    }
    hullGeo.computeVertexNormals();

    var hullMesh = new THREE.Mesh(hullGeo, goldEnvelopeMat);
    hullMesh.position.y = 1.4;
    ship.add(hullMesh);

    // Forward Pinnacle Spear & Cap
    var noseCapGeo = new THREE.SphereGeometry(0.55, 20, 20);
    var noseCap = new THREE.Mesh(noseCapGeo, brightBrassMat);
    noseCap.position.set(5.1, 1.4, 0);
    noseCap.scale.set(1.1, 0.8, 0.8);
    ship.add(noseCap);

    var spearGeo = new THREE.ConeGeometry(0.32, 2.4, 16);
    var spearMesh = new THREE.Mesh(spearGeo, brightBrassMat);
    spearMesh.rotation.z = -Math.PI / 2;
    spearMesh.position.set(6.3, 1.4, 0);
    ship.add(spearMesh);

    // Circumferential Girders
    [-3.8, -2.4, -1.0, 0.4, 1.8, 3.2, 4.3].forEach(function (xPos) {
        var factor = Math.cos((xPos / 6.0) * (Math.PI / 2.2));
        var r = 2.12 * Math.max(0.25, factor);
        var ringGeo = new THREE.TorusGeometry(r, 0.035, 10, 36);
        var ringMesh = new THREE.Mesh(ringGeo, brightBrassMat);
        ringMesh.position.set(xPos, 1.4, 0);
        ringMesh.rotation.y = Math.PI / 2;
        ship.add(ringMesh);
    });

    // Longitudinal Rib Tubes
    for (var r = 0; r < 8; r++) {
        var angle = (r * Math.PI * 2) / 8;
        var curvePoints = [];
        for (var step = -4.6; step <= 5.0; step += 0.5) {
            var factor = Math.cos((step / 6.0) * (Math.PI / 2.2));
            var rad = 2.13 * Math.max(0.22, factor);
            curvePoints.push(new THREE.Vector3(step, 1.4 + Math.sin(angle) * rad, Math.cos(angle) * rad));
        }
        var curve = new THREE.CatmullRomCurve3(curvePoints);
        var tubeGeo = new THREE.TubeGeometry(curve, 28, 0.022, 6, false);
        var ribMesh = new THREE.Mesh(tubeGeo, brightBrassMat);
        ship.add(ribMesh);
    }

    // Decorative Scalloped Drapery Swags (from Image 4)
    [-1, 1].forEach(function (side) {
        for (var s = -3.2; s <= 2.6; s += 1.4) {
            var swagPoints = [
                new THREE.Vector3(s, 1.4, side * 2.1),
                new THREE.Vector3(s + 0.7, 0.7, side * 2.15),
                new THREE.Vector3(s + 1.4, 1.4, side * 2.1)
            ];
            var swagCurve = new THREE.CatmullRomCurve3(swagPoints);
            var swagGeo = new THREE.TubeGeometry(swagCurve, 12, 0.02, 6, false);
            var swagMesh = new THREE.Mesh(swagGeo, brightBrassMat);
            ship.add(swagMesh);
        }
    });

    // Top Observation Cupola & Swallowtail Pennant Flag
    var cupolaGeo = new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    var cupolaMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.85 });
    var cupolaMesh = new THREE.Mesh(cupolaGeo, cupolaMat);
    cupolaMesh.position.set(0.4, 3.45, 0);
    ship.add(cupolaMesh);

    var mastGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8);
    var mastMesh = new THREE.Mesh(mastGeo, brightBrassMat);
    mastMesh.position.set(0.4, 4.2, 0);
    ship.add(mastMesh);

    // Swallowtail Pennant Flag ("THE AEONS VOYAGER")
    var flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(-1.8, 0.38);
    flagShape.lineTo(-1.2, 0);
    flagShape.lineTo(-1.8, -0.38);
    flagShape.lineTo(0, 0);
    var flagGeo = new THREE.ShapeGeometry(flagShape);
    var flagMat = new THREE.MeshStandardMaterial({ color: 0xb45309, side: THREE.DoubleSide, roughness: 0.4 });
    var flagMesh = new THREE.Mesh(flagGeo, flagMat);
    flagMesh.position.set(0.4, 4.6, 0);
    ship.add(flagMesh);

    // Gasbag Empennage Tail Fins (Cross)
    [-1, 1].forEach(function (dir) {
        var finShape = new THREE.Shape();
        finShape.moveTo(-2.2, 0);
        finShape.lineTo(-4.8, dir * 1.8);
        finShape.lineTo(-3.8, dir * 1.8);
        finShape.lineTo(-1.2, 0);
        finShape.closePath();
        var finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, steps: 1 });
        var finMesh = new THREE.Mesh(finGeo, bronzeMat);
        finMesh.position.set(0, 1.4, -0.03);
        ship.add(finMesh);

        var lightGeo = new THREE.SphereGeometry(0.12, 12, 12);
        var lightMat = new THREE.MeshBasicMaterial({ color: dir > 0 ? 0xef4444 : 0x10b981 });
        var lightMesh = new THREE.Mesh(lightGeo, lightMat);
        lightMesh.position.set(-4.6, 1.4 + dir * 1.8, 0);
        ship.add(lightMesh);
    });

    [-1, 1].forEach(function (dir) {
        var hFinShape = new THREE.Shape();
        hFinShape.moveTo(-2.2, 0);
        hFinShape.lineTo(-4.8, dir * 1.8);
        hFinShape.lineTo(-3.8, dir * 1.8);
        hFinShape.lineTo(-1.2, 0);
        hFinShape.closePath();
        var hFinGeo = new THREE.ExtrudeGeometry(hFinShape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, steps: 1 });
        var hFinMesh = new THREE.Mesh(hFinGeo, bronzeMat);
        hFinMesh.rotation.x = Math.PI / 2;
        hFinMesh.position.set(0, 1.43, 0);
        ship.add(hFinMesh);
    });

    // 2. UNDERSLUNG SAILING GALLEON SHIP HULL
    var galleonGroup = new THREE.Group();
    galleonGroup.position.set(0.3, -1.8, 0);

    // Sculpted Clipper/Galleon Ship Hull Profile
    var hullShape = new THREE.Shape();
    hullShape.moveTo(-2.6, 0.45);  // Stern deck
    hullShape.lineTo(-2.6, -0.6); // Stern keel
    hullShape.quadraticCurveTo(-0.8, -1.2, 1.6, -0.9); // Keel bottom
    hullShape.quadraticCurveTo(3.0, -0.3, 3.6, 0.75);  // Sweeping Bow Prow
    hullShape.lineTo(3.2, 0.65);   // Bow deck
    hullShape.quadraticCurveTo(0.5, 0.05, -2.6, 0.45); // Sheer deck curve
    hullShape.closePath();

    var extrudeGalleon = {
        steps: 2,
        depth: 1.3,
        bevelEnabled: true,
        bevelThickness: 0.28,
        bevelSize: 0.22,
        bevelSegments: 4
    };
    var galleonGeo = new THREE.ExtrudeGeometry(hullShape, extrudeGalleon);
    var galleonMesh = new THREE.Mesh(galleonGeo, woodHullMat);
    galleonMesh.position.z = -0.65;
    galleonGroup.add(galleonMesh);

    // Wooden Deck
    var deckGeo = new THREE.BoxGeometry(5.4, 0.08, 1.4);
    var deckMesh = new THREE.Mesh(deckGeo, woodDeckMat);
    deckMesh.position.set(0.3, 0.25, 0);
    galleonGroup.add(deckMesh);

    // Gilded Sheer Line Trim & Railings
    var railGeo = new THREE.BoxGeometry(6.2, 0.08, 1.55);
    var railMesh = new THREE.Mesh(railGeo, brightBrassMat);
    railMesh.position.set(0.4, 0.42, 0);
    galleonGroup.add(railMesh);

    // Aft Captain's Sterncastle Cabin
    var castleGeo = new THREE.BoxGeometry(1.5, 1.0, 1.3);
    var castleMesh = new THREE.Mesh(castleGeo, woodHullMat);
    castleMesh.position.set(-1.8, 0.85, 0);
    galleonGroup.add(castleMesh);

    var castleTrimGeo = new THREE.BoxGeometry(1.55, 0.08, 1.35);
    var castleTrim = new THREE.Mesh(castleTrimGeo, brightBrassMat);
    castleTrim.position.set(-1.8, 1.38, 0);
    galleonGroup.add(castleTrim);

    var castleRoofGeo = new THREE.ConeGeometry(0.85, 0.55, 4);
    var castleRoof = new THREE.Mesh(castleRoofGeo, brightBrassMat);
    castleRoof.position.set(-1.8, 1.68, 0);
    castleRoof.rotation.y = Math.PI / 4;
    galleonGroup.add(castleRoof);

    // Aft Cabin Stained Glass Windows
    [-1, 1].forEach(function (side) {
        [-0.35, 0.25].forEach(function (wx) {
            var win = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.06), windowGlowMat);
            win.position.set(-1.8 + wx, 0.85, side * 0.68);
            galleonGroup.add(win);
        });
    });
    // Stern Gallery Windows
    [-0.35, 0, 0.35].forEach(function (wz) {
        var sternWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.22), windowGlowMat);
        sternWin.position.set(-2.58, 0.85, wz);
        galleonGroup.add(sternWin);
    });

    // Long Protruding Bowsprit Spar
    var bowspritGeo = new THREE.CylinderGeometry(0.035, 0.08, 3.4, 10);
    var bowspritMesh = new THREE.Mesh(bowspritGeo, brightBrassMat);
    bowspritMesh.rotation.z = -Math.PI / 3.4;
    bowspritMesh.position.set(4.8, 1.6, 0);
    galleonGroup.add(bowspritMesh);

    // Celestial Stabilizer Wings (Swept Filigree Fins from Image 3)
    [-1, 1].forEach(function (side) {
        var wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.quadraticCurveTo(1.2, 0.6, 2.6, 1.9);
        wingShape.quadraticCurveTo(2.1, 1.1, 2.4, 0.4);
        wingShape.quadraticCurveTo(1.2, -0.2, 0, -0.4);
        wingShape.closePath();

        var wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 });
        var wingMesh = new THREE.Mesh(wingGeo, brightBrassMat);
        wingMesh.position.set(0.1, -0.1, side * 0.8);
        wingMesh.rotation.y = side * 0.35;
        wingMesh.rotation.x = side * 0.4;
        galleonGroup.add(wingMesh);
    });

    // Ship Anchor on Chain
    var anchorGeo = new THREE.TorusGeometry(0.24, 0.04, 8, 16, Math.PI);
    var anchorMesh = new THREE.Mesh(anchorGeo, bronzeMat);
    anchorMesh.rotation.z = Math.PI;
    anchorMesh.position.set(3.0, -0.5, 0.8);
    galleonGroup.add(anchorMesh);

    // Main Ship Mast reaching up to Gasbag
    var shipMastGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8);
    var shipMast = new THREE.Mesh(shipMastGeo, brightBrassMat);
    shipMast.position.set(0.5, 1.5, 0);
    galleonGroup.add(shipMast);

    // Rigging Shrouds & Suspension Cables
    var cableMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 0.95 });
    [-2.1, -0.8, 0.5, 1.8, 2.8].forEach(function (cx) {
        [-1, 1].forEach(function (side) {
            var cablePoints = [
                new THREE.Vector3(cx, 0.45, side * 0.7),
                new THREE.Vector3(cx * 0.92, 3.1, side * 1.85)
            ];
            var cableCurve = new THREE.CatmullRomCurve3(cablePoints);
            var cGeo = new THREE.TubeGeometry(cableCurve, 4, 0.016, 4, false);
            var cMesh = new THREE.Mesh(cGeo, cableMat);
            galleonGroup.add(cMesh);
        });
    });

    ship.add(galleonGroup);

    // 3. THE SIGNATURE LARGE HANGING GLOWING LANTERN
    var lanternGroup = new THREE.Group();
    lanternGroup.position.set(6.2, -0.3, 0); // Suspended from tip of bowsprit

    // Suspension Chain
    var chainPoints = [
        new THREE.Vector3(0, 0.9, 0),
        new THREE.Vector3(0, 0, 0)
    ];
    var chainCurve = new THREE.CatmullRomCurve3(chainPoints);
    var chainMesh = new THREE.Mesh(new THREE.TubeGeometry(chainCurve, 4, 0.022, 4, false), brightBrassMat);
    lanternGroup.add(chainMesh);

    // Lantern Ornate Brass Cap
    var lCap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.45, 0.28, 8), brightBrassMat);
    lCap.position.y = -0.12;
    lanternGroup.add(lCap);

    // Lantern Glass Body (Octagonal faceted)
    var lBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.35, 0.75, 8), lanternGlassMat);
    lBody.position.y = -0.6;
    lanternGroup.add(lBody);

    // 8 Brass Corner Pillars
    for (var p = 0; p < 8; p++) {
        var pa = (p * Math.PI * 2) / 8;
        var pillarGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.76, 4);
        var pillarMesh = new THREE.Mesh(pillarGeo, brightBrassMat);
        pillarMesh.position.set(Math.cos(pa) * 0.38, -0.6, Math.sin(pa) * 0.38);
        lanternGroup.add(pillarMesh);
    }

    // Inner Glowing Core
    var flameMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    flameMesh.position.y = -0.6;
    lanternGroup.add(flameMesh);

    // Lantern Base & Finial Pendant
    var lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.12, 0.28, 8), brightBrassMat);
    lBase.position.y = -1.05;
    lanternGroup.add(lBase);

    var finialGeo = new THREE.SphereGeometry(0.08, 8, 8);
    var finialMesh = new THREE.Mesh(finialGeo, brightBrassMat);
    finialMesh.position.y = -1.25;
    lanternGroup.add(finialMesh);

    // Point Light casting warm radiance
    var lanternLight = new THREE.PointLight(0xf59e0b, 2.8, 20, 1.2);
    lanternLight.position.set(0, -0.6, 0);
    lanternGroup.add(lanternLight);

    // Volumetric Forward Warm Aura Cone
    var coneGeo = new THREE.ConeGeometry(3.2, 9.5, 24, 1, true);
    var coneMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    var coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.set(0.5, -4.8, 0);
    coneMesh.rotation.z = -Math.PI / 3.4;
    lanternGroup.add(coneMesh);

    ship.add(lanternGroup);

    // 4. PROPELLERS & STEAM ENGINES
    var propMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.15, metalness: 0.98 });
    var props = [];
    var exhaustParticles = [];

    // Stern 4-Blade Pusher Propeller (Behind Galleon Rudder)
    var sternPropGroup = new THREE.Group();
    sternPropGroup.position.set(-2.6, -2.1, 0);

    var sternHub = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), propMat);
    sternPropGroup.add(sternHub);

    for (var b = 0; b < 4; b++) {
        var bladeGeo = new THREE.BoxGeometry(0.04, 1.15, 0.22);
        var bladeMesh = new THREE.Mesh(bladeGeo, propMat);
        var a = (b * Math.PI * 2) / 4;
        bladeMesh.rotation.x = a;
        bladeMesh.rotation.y = 0.3;
        bladeMesh.position.y = Math.sin(a) * 0.56;
        bladeMesh.position.z = Math.cos(a) * 0.56;
        sternPropGroup.add(bladeMesh);
    }
    ship.add(sternPropGroup);
    props.push(sternPropGroup);

    // Outrigger Turbines
    [-1, 1].forEach(function (side) {
        var nacelleGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.85, 14);
        var nacelle = new THREE.Mesh(nacelleGeo, bronzeMat);
        nacelle.rotation.z = Math.PI / 2;
        nacelle.position.set(-0.2, -0.4, side * 2.2);
        ship.add(nacelle);

        var bracketGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8);
        var bracket = new THREE.Mesh(bracketGeo, brightBrassMat);
        bracket.rotation.x = side * (Math.PI / 3.4);
        bracket.position.set(-0.2, -0.85, side * 1.4);
        ship.add(bracket);

        var propGroup = new THREE.Group();
        propGroup.position.set(-0.7, -0.4, side * 2.2);

        var hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), propMat);
        propGroup.add(hub);

        for (var b = 0; b < 3; b++) {
            var bladeGeo = new THREE.BoxGeometry(0.03, 0.65, 0.12);
            var bladeMesh = new THREE.Mesh(bladeGeo, propMat);
            var ba = (b * Math.PI * 2) / 3;
            bladeMesh.rotation.x = ba;
            bladeMesh.rotation.y = 0.25;
            bladeMesh.position.y = Math.sin(ba) * 0.32;
            bladeMesh.position.z = Math.cos(ba) * 0.32;
            propGroup.add(bladeMesh);
        }
        ship.add(propGroup);
        props.push(propGroup);

        // Steam Exhaust
        var steamGeo = new THREE.SphereGeometry(0.14, 8, 8);
        var steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
        for (var s = 0; s < 4; s++) {
            var steamP = new THREE.Mesh(steamGeo, steamMat);
            steamP.position.set(-0.9 - s * 0.35, -0.3 + Math.random() * 0.15, side * 2.2);
            steamP.scale.setScalar(1.0 + s * 0.5);
            ship.add(steamP);
            exhaustParticles.push({ mesh: steamP, baseOffset: s, side: side });
        }
    });

    return { group: ship, props: props, exhaustParticles: exhaustParticles, coneMesh: coneMesh, lanternGroup: lanternGroup };
}

function init3DAirshipInspector(container) {
    if (!window.THREE || !container) return null;
    var canvas = container.querySelector("canvas");
    if (!canvas) return null;

    var width = container.clientWidth || 300;
    var height = container.clientHeight || 155;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(5.5, 3.2, 14.5);
    camera.lookAt(0, -0.5, 0);

    // Lights
    var ambient = new THREE.AmbientLight(0xffedd5, 0.9);
    scene.add(ambient);

    var sun = new THREE.DirectionalLight(0xfffbeb, 2.0);
    sun.position.set(15, 25, 20);
    scene.add(sun);

    var rim = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rim.position.set(-20, -10, -15);
    scene.add(rim);

    var airship3D = build3DAirshipMesh(THREE);
    if (!airship3D) return null;

    airship3D.group.position.set(0, 0, 0);
    airship3D.group.rotation.y = -0.35;
    scene.add(airship3D.group);

    // Drag-to-rotate interaction
    var isDragging = false;
    var prevMouseX = 0;
    var prevMouseY = 0;
    var rotVelocityX = 0;
    var rotVelocityY = 0;

    function onPointerDown(e) {
        isDragging = true;
        prevMouseX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        prevMouseY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    }

    function onPointerMove(e) {
        if (!isDragging) return;
        var clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        var clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        var dx = clientX - prevMouseX;
        var dy = clientY - prevMouseY;
        prevMouseX = clientX;
        prevMouseY = clientY;

        airship3D.group.rotation.y += dx * 0.012;
        airship3D.group.rotation.x = Math.max(-0.6, Math.min(0.6, airship3D.group.rotation.x + dy * 0.01));
    }

    function onPointerUp() {
        isDragging = false;
    }

    container.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    container.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp);

    var animId = null;
    var clock = new THREE.Clock();

    function renderLoop() {
        animId = requestAnimationFrame(renderLoop);
        var dt = clock.getDelta();
        var t = clock.getElapsedTime();

        // Spin 3D propellers
        airship3D.props.forEach(function (p) {
            p.rotation.x += dt * 38.0;
        });

        // Steam particle drift
        airship3D.exhaustParticles.forEach(function (ep, idx) {
            ep.mesh.position.x = -1.0 - ((t * 2.5 + idx * 0.5) % 2.5);
            var fade = 1.0 - (Math.abs(ep.mesh.position.x + 1.0) / 2.5);
            ep.mesh.scale.setScalar(0.8 + (1.0 - fade) * 1.6);
            ep.mesh.material.opacity = Math.max(0, fade * 0.5);
        });

        // Gentle automatic cruise bobbing if not dragging
        if (!isDragging) {
            airship3D.group.rotation.y += dt * 0.15;
            airship3D.group.position.y = Math.sin(t * 1.5) * 0.25;
            airship3D.group.rotation.z = Math.sin(t * 0.8) * 0.05;
        }

        renderer.render(scene, camera);
    }
    renderLoop();

    return {
        destroy: function () {
            if (animId) cancelAnimationFrame(animId);
            container.removeEventListener("mousedown", onPointerDown);
            window.removeEventListener("mousemove", onPointerMove);
            window.removeEventListener("mouseup", onPointerUp);
            container.removeEventListener("touchstart", onPointerDown);
            window.removeEventListener("touchmove", onPointerMove);
            window.removeEventListener("touchend", onPointerUp);
            renderer.dispose();
        }
    };
}

function showAirshipPopup(lngLat) {
    if (!globeMap) return;
    var pos = getAirshipPosition(airshipProgress);

    var popupContent = document.createElement("div");
    popupContent.className = "airship-popup";

    var header = document.createElement("div");
    header.className = "airship-popup-header";
    header.innerHTML = `
        <div class="airship-title-wrap">
            <span class="airship-insignia">🛰️</span>
            <div>
                <h3>HMS Aetheria</h3>
                <p class="airship-subtitle">Royal Celestial Orbiting Vessel · LEO Satellite Expedition</p>
            </div>
        </div>
        <div id="airship-whistle-puff" class="airship-steam-puff" title="Steam Vent">💨</div>
    `;
    popupContent.appendChild(header);

    // 3D Realtime Airship Inspector Viewport
    var viewport3D = document.createElement("div");
    viewport3D.className = "airship-3d-viewport";
    viewport3D.innerHTML = `
        <canvas id="airship-popup-3d-canvas"></canvas>
        <div class="airship-3d-badge">⚙️ 3D Model Inspector · Drag to Rotate</div>
    `;
    popupContent.appendChild(viewport3D);

    var grid = document.createElement("div");
    grid.className = "airship-gauge-grid";
    grid.innerHTML = `
        <div class="airship-gauge">
            <span class="gauge-label">Orbital Alt</span>
            <strong class="gauge-val">420 km</strong>
            <span class="gauge-sub">LEO Satellite Orbit</span>
        </div>
        <div class="airship-gauge">
            <span class="gauge-label">Velocity</span>
            <strong class="gauge-val">7.66 km/s</strong>
            <span class="gauge-sub">27,600 km/h</span>
        </div>
        <div class="airship-gauge">
            <span class="gauge-label">Track Heading</span>
            <strong class="gauge-val">${pos.headingCompass}</strong>
            <span class="gauge-sub">51.6° Inclination</span>
        </div>
        <div class="airship-gauge">
            <span class="gauge-label">Sub-Satellite Pt</span>
            <strong class="gauge-val">${pos.lat > 0 ? pos.lat + "°N" : Math.abs(pos.lat) + "°S"}, ${pos.lon > 0 ? pos.lon + "°E" : Math.abs(pos.lon) + "°W"}</strong>
            <span class="gauge-sub">Orbital Fix</span>
        </div>
    `;
    popupContent.appendChild(grid);

    var dispatch = document.createElement("div");
    dispatch.className = "airship-dispatch-card";
    dispatch.innerHTML = `
        <p class="dispatch-title"><strong>Current Overflight:</strong> ${pos.currentWaypoint}</p>
        <p class="dispatch-note">“${pos.note}”</p>
    `;
    popupContent.appendChild(dispatch);

    var actions = document.createElement("div");
    actions.className = "airship-actions";

    var followBtn = document.createElement("button");
    followBtn.id = "airship-follow-btn";
    followBtn.type = "button";
    followBtn.className = "airship-btn airship-btn-follow" + (isFollowingAirship ? " is-active" : "");
    followBtn.textContent = isFollowingAirship ? "🛰️ Track Orbit (Active)" : "🛰️ Track Orbit";
    followBtn.addEventListener("click", function () {
        toggleFollowAirship();
    });
    actions.appendChild(followBtn);

    var whistleBtn = document.createElement("button");
    whistleBtn.type = "button";
    whistleBtn.className = "airship-btn airship-btn-whistle";
    whistleBtn.textContent = "💨 Steam Whistle";
    whistleBtn.addEventListener("click", soundSteamWhistle);
    actions.appendChild(whistleBtn);

    popupContent.appendChild(actions);

    if (airshipActivePopup) {
        airshipActivePopup.remove();
    }

    airshipActivePopup = new maplibregl.Popup({ maxWidth: "340px", offset: 12, className: "airship-maplibre-popup" })
        .setLngLat(lngLat || [pos.lon, pos.lat])
        .setDOMContent(popupContent)
        .addTo(globeMap);

    var inspectorInstance = null;
    setTimeout(function () {
        inspectorInstance = init3DAirshipInspector(viewport3D);
    }, 50);

    airshipActivePopup.on("close", function () {
        if (inspectorInstance && inspectorInstance.destroy) {
            inspectorInstance.destroy();
        }
        airshipActivePopup = null;
    });
}

function flyToAirship() {
    if (!globeMap) return;
    setAirshipVisibility(true);
    var airshipInput = document.getElementById("airship-visibility");
    if (airshipInput) airshipInput.checked = true;
    var pos = getAirshipPosition(airshipProgress);
    globeMap.flyTo({
        center: [pos.lon, pos.lat],
        zoom: 4.8,
        speed: 1.4,
        essential: true
    });
    showAirshipPopup([pos.lon, pos.lat]);
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

function setTectonicPlatesVisibility(visible) {
    platesVisible = Boolean(visible);
    if (globeMap) {
        ["plate-boundaries-glow", "plate-boundaries-line"].forEach(function (layerId) {
            if (globeMap.getLayer(layerId)) {
                globeMap.setLayoutProperty(layerId, "visibility", platesVisible ? "visible" : "none");
            }
        });
    }
    var input = document.getElementById("plates-visibility");
    if (input) {
        input.checked = platesVisible;
    }
}

function resetMapFilters() {
    activeDepthRanges = new Set(depthRangeDefinitions.map(function (range) {
        return range.key;
    }));
    quakesVisible = true;
    platesVisible = true;
    minMagnitude = 0;
    searchQuery = "";

    var searchInput = document.getElementById("quake-search");
    if (searchInput) {
        searchInput.value = "";
    }
    var clearSearchBtn = document.getElementById("clear-search");
    if (clearSearchBtn) {
        clearSearchBtn.hidden = true;
    }
    document.querySelectorAll(".mag-filter-chip").forEach(function (chip) {
        var isActive = chip.dataset.mag === "0";
        chip.classList.toggle("is-active", isActive);
        chip.setAttribute("aria-pressed", String(isActive));
    });
    var quakeInput = document.getElementById("quake-visibility");
    if (quakeInput) {
        quakeInput.checked = true;
    }
    var platesInput = document.getElementById("plates-visibility");
    if (platesInput) {
        platesInput.checked = true;
    }
    setTectonicPlatesVisibility(true);
    document.querySelectorAll(".legend-toggle").forEach(function (button) {
        button.classList.remove("is-off");
        button.setAttribute("aria-pressed", "true");
        var state = button.querySelector(".legend-state");
        if (state) {
            state.textContent = "On";
        }
    });
    applyDepthFilters();
    renderFeedDrawer();
}

function setMapPanelExpanded(panel, button, content, expanded) {
    panel.classList.toggle("is-expanded", expanded);
    button.setAttribute("aria-expanded", String(expanded));
    content.hidden = !expanded;
}

function toggleFeedDrawer(show) {
    var drawer = document.getElementById("feed-drawer");
    var button = document.getElementById("toggle-feed-drawer");
    if (!drawer) return;
    var isCurrentlyHidden = drawer.hasAttribute("hidden") || drawer.hidden;
    var willOpen = show !== undefined ? Boolean(show) : isCurrentlyHidden;
    if (willOpen) {
        drawer.removeAttribute("hidden");
        drawer.hidden = false;
    } else {
        drawer.setAttribute("hidden", "");
        drawer.hidden = true;
    }
    if (button) {
        button.classList.toggle("is-active", willOpen);
        button.setAttribute("aria-expanded", String(willOpen));
    }
    if (willOpen) {
        renderFeedDrawer();
    }
}

function renderFeedDrawer() {
    var listEl = document.getElementById("feed-drawer-list");
    var countEl = document.getElementById("feed-drawer-count");
    if (!listEl) return;

    var visibleQuakes = getVisibleGeojson().features.slice().sort(function (a, b) {
        var magB = getNumericMagnitude(b.properties.mag);
        var magA = getNumericMagnitude(a.properties.mag);
        if (magB !== magA) {
            return (magB !== null ? magB : -99) < (magA !== null ? magA : -99) ? 1 : -1;
        }
        return b.properties.time - a.properties.time;
    });

    if (countEl) {
        countEl.textContent = visibleQuakes.length + " matching";
    }

    listEl.innerHTML = "";
    if (!visibleQuakes.length) {
        var emptyP = document.createElement("p");
        emptyP.className = "feed-drawer-empty";
        emptyP.textContent = "No earthquakes match current filters.";
        listEl.appendChild(emptyP);
        return;
    }

    var topQuakes = visibleQuakes.slice(0, 50);
    topQuakes.forEach(function (quake) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "feed-drawer-item";
        item.setAttribute("aria-label", (quake.properties.place || "Earthquake") + ", Magnitude " + formatMagnitudeLabel(quake.properties.mag));

        var magBadge = document.createElement("span");
        magBadge.className = "feed-drawer-mag";
        var depthRange = depthRangeDefinitions.find(function (r) { return r.key === quake.properties.depthKey; }) || depthRangeDefinitions[0];
        magBadge.style.backgroundColor = depthRange.color;
        magBadge.textContent = formatMagnitudeLabel(quake.properties.mag);

        var info = document.createElement("div");
        info.className = "feed-drawer-info";

        var place = document.createElement("span");
        place.className = "feed-drawer-place";
        place.textContent = quake.properties.place || "Unknown location";

        var meta = document.createElement("span");
        meta.className = "feed-drawer-meta";
        meta.textContent = formatRelativeTime(quake.properties.time) + " · " + quake.properties.depth + " km";

        info.appendChild(place);
        info.appendChild(meta);
        item.appendChild(magBadge);
        item.appendChild(info);

        item.addEventListener("click", function () {
            flyToQuake(quake);
            if (compactViewportQuery.matches) {
                toggleFeedDrawer(false);
            }
        });

        listEl.appendChild(item);
    });
}

function updateTimelapseControls() {
    var playBtn = document.getElementById("timelapse-play-pause");
    var toggleBtn = document.getElementById("toggle-timelapse");
    var labelEl = document.getElementById("timelapse-btn-label");
    if (playBtn) {
        playBtn.textContent = isTimelapsePlaying ? "❚❚" : "▶";
    }
    if (toggleBtn) {
        toggleBtn.classList.toggle("is-active", isTimelapsePlaying);
        toggleBtn.setAttribute("aria-pressed", String(isTimelapsePlaying));
    }
    if (labelEl) {
        labelEl.textContent = isTimelapsePlaying ? "Pause Timelapse" : "Timelapse";
    }
}

function startTimelapse() {
    if (!currentGeojson.features.length) return;
    var bar = document.getElementById("timelapse-bar");
    if (bar) bar.hidden = false;
    isTimelapsePlaying = true;
    if (timelapseProgress >= 100) {
        timelapseProgress = 0;
    }
    updateTimelapseControls();

    var sorted = currentGeojson.features.slice().sort(function (a, b) { return a.properties.time - b.properties.time; });
    var minTime = sorted[0].properties.time;
    var maxTime = sorted[sorted.length - 1].properties.time;
    var totalDuration = Math.max(maxTime - minTime, 1);

    function step() {
        if (!isTimelapsePlaying) return;
        timelapseProgress += 0.8;
        if (timelapseProgress >= 100) {
            timelapseProgress = 100;
            pauseTimelapse();
        }
        var rangeInput = document.getElementById("timelapse-range");
        if (rangeInput) {
            rangeInput.value = timelapseProgress;
        }
        var currentCutoff = minTime + (totalDuration * (timelapseProgress / 100));
        var labelEl = document.getElementById("timelapse-time-label");
        if (labelEl) {
            labelEl.textContent = new Date(currentCutoff).toLocaleString() + " (" + Math.round(timelapseProgress) + "%)";
        }
        refreshEarthquakeSource();
        renderFeedDrawer();
        if (isTimelapsePlaying && timelapseProgress < 100) {
            timelapseTimer = window.setTimeout(step, 60);
        }
    }
    step();
}

function pauseTimelapse() {
    isTimelapsePlaying = false;
    window.clearTimeout(timelapseTimer);
    updateTimelapseControls();
    refreshEarthquakeSource();
}

function stopTimelapse() {
    pauseTimelapse();
    timelapseProgress = 100;
    var bar = document.getElementById("timelapse-bar");
    if (bar) bar.hidden = true;
    var rangeInput = document.getElementById("timelapse-range");
    if (rangeInput) rangeInput.value = 100;
    updateTimelapseControls();
    refreshEarthquakeSource();
    renderFeedDrawer();
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

    var platesToggle = document.createElement("label");
    platesToggle.className = "base-option";
    var platesInput = document.createElement("input");
    platesInput.type = "checkbox";
    platesInput.id = "plates-visibility";
    platesInput.checked = platesVisible;
    platesInput.addEventListener("change", function (event) {
        setTectonicPlatesVisibility(event.target.checked);
        if (compactViewportQuery.matches) {
            setMapPanelExpanded(basePanel, baseHeader, baseContent, false);
            baseHeader.focus();
        }
    });
    var platesText = document.createElement("span");
    platesText.textContent = "Tectonic Plates";
    platesToggle.appendChild(platesInput);
    platesToggle.appendChild(platesText);
    baseContent.appendChild(platesToggle);

    var airshipToggle = document.createElement("label");
    airshipToggle.className = "base-option";
    var airshipInput = document.createElement("input");
    airshipInput.type = "checkbox";
    airshipInput.id = "airship-visibility";
    airshipInput.checked = airshipVisible;
    airshipInput.addEventListener("change", function (event) {
        setAirshipVisibility(event.target.checked);
        if (compactViewportQuery.matches) {
            setMapPanelExpanded(basePanel, baseHeader, baseContent, false);
            baseHeader.focus();
        }
    });
    var airshipText = document.createElement("span");
    airshipText.textContent = "Aerial Survey (Airship)";
    airshipToggle.appendChild(airshipInput);
    airshipToggle.appendChild(airshipText);
    baseContent.appendChild(airshipToggle);

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

    var depthGroup = document.createElement("div");
    depthGroup.className = "legend-depth-group";

    var depthTitle = document.createElement("p");
    depthTitle.className = "legend-subtitle";
    depthTitle.textContent = "Depth";
    depthGroup.appendChild(depthTitle);

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

    depthGroup.appendChild(list);
    content.appendChild(depthGroup);

    var divider = document.createElement("div");
    divider.className = "legend-section-divider";
    divider.setAttribute("aria-hidden", "true");
    content.appendChild(divider);

    var extraNotes = document.createElement("div");
    extraNotes.className = "legend-extra";

    var magnitudeLegend = document.createElement("div");
    magnitudeLegend.className = "magnitude-legend";
    magnitudeLegend.title = "Sphere marker size represents earthquake magnitude; number indicates exact magnitude.";
    magnitudeLegend.innerHTML = '<span class="magnitude-shape is-sphere" aria-hidden="true"></span><span class="legend-badge-text">Mag Size</span>';
    extraNotes.appendChild(magnitudeLegend);

    var platesNote = document.createElement("div");
    platesNote.className = "legend-note";
    platesNote.title = "Tectonic plate boundaries from the Peter Bird (PB2002) global model.";
    platesNote.innerHTML = '<span class="plate-swatch" aria-hidden="true"></span><span class="legend-badge-text">Plates</span>';
    extraNotes.appendChild(platesNote);

    var championNote = document.createElement("div");
    championNote.className = "legend-note";
    championNote.title = "Regional Max: the single strongest earthquake across each broad world region.";
    championNote.appendChild(createChampionEpicenterBadge(depthRangeDefinitions[1].color));
    var champText = document.createElement("span");
    champText.className = "legend-badge-text";
    champText.textContent = "Regional Max";
    championNote.appendChild(champText);
    extraNotes.appendChild(championNote);

    var clusterNote = document.createElement("div");
    clusterNote.className = "legend-note";
    clusterNote.title = "Numbered circles group nearby events together; select to zoom in.";
    clusterNote.innerHTML = '<span class="cluster-legend-icon" aria-hidden="true">12</span><span class="legend-badge-text">Clusters</span>';
    extraNotes.appendChild(clusterNote);

    var resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "legend-reset";
    resetButton.title = "Reset all map filters to default";
    resetButton.innerHTML = '<span class="legend-reset-icon" aria-hidden="true">↺</span><span class="legend-badge-text">Reset</span>';
    resetButton.addEventListener("click", resetMapFilters);
    extraNotes.appendChild(resetButton);

    content.appendChild(extraNotes);

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

        if (window.tectonicPlatesGeoJSON) {
            globeMap.addSource("tectonic-plates", {
                type: "geojson",
                data: window.tectonicPlatesGeoJSON
            });

            globeMap.addLayer({
                id: "plate-boundaries-glow",
                type: "line",
                source: "tectonic-plates",
                layout: {
                    "line-cap": "round",
                    "line-join": "round",
                    "visibility": platesVisible ? "visible" : "none"
                },
                paint: {
                    "line-color": [
                        "match",
                        ["get", "type"],
                        "Convergent (Subduction / Trench)", "#f43f5e",
                        "Divergent (Spreading Ridge / Rift)", "#38bdf8",
                        "#f59e0b"
                    ],
                    "line-width": 5,
                    "line-opacity": 0.45,
                    "line-blur": 2
                }
            });

            globeMap.addLayer({
                id: "plate-boundaries-line",
                type: "line",
                source: "tectonic-plates",
                layout: {
                    "line-cap": "round",
                    "line-join": "round",
                    "visibility": platesVisible ? "visible" : "none"
                },
                paint: {
                    "line-color": [
                        "match",
                        ["get", "type"],
                        "Convergent (Subduction / Trench)", "#fb7185",
                        "Divergent (Spreading Ridge / Rift)", "#7dd3fc",
                        "#fbbf24"
                    ],
                    "line-width": 1.85,
                    "line-opacity": 0.9,
                    "line-dasharray": [3, 1.5]
                }
            });

            globeMap.on("click", "plate-boundaries-line", function (event) {
                var feature = event.features && event.features[0];
                if (!feature || !feature.properties) return;
                var props = feature.properties;
                var popupContent = document.createElement("div");
                popupContent.className = "quake-popup plate-popup";
                var title = document.createElement("h3");
                title.textContent = props.name || "Tectonic Plate Boundary";
                popupContent.appendChild(title);
                if (props.type) appendPopupRow(popupContent, "Boundary type", props.type);
                if (props.plateA && props.plateB) {
                    appendPopupRow(popupContent, "Plates", props.plateA + " / " + props.plateB, true);
                } else if (props.plates) {
                    appendPopupRow(popupContent, "Plates", props.plates, true);
                }
                if (props.source) appendPopupRow(popupContent, "Dataset model", props.source, true);

                new maplibregl.Popup({ maxWidth: "320px", offset: 8 })
                    .setLngLat(event.lngLat)
                    .setDOMContent(popupContent)
                    .addTo(globeMap);
            });

            globeMap.on("mouseenter", "plate-boundaries-line", function () {
                globeMap.getCanvas().style.cursor = "pointer";
            });
            globeMap.on("mouseleave", "plate-boundaries-line", function () {
                globeMap.getCanvas().style.cursor = "";
            });
        }

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

        globeMap.addImage("victorian-airship", createAirshipImage(), { pixelRatio: 2 });

        // Add Airship Orbit Path GeoJSON Source & Layer
        globeMap.addSource("airship-orbit", {
            type: "geojson",
            data: buildAirshipOrbitGeoJSON()
        });

        globeMap.addLayer({
            id: "airship-orbit-path",
            type: "line",
            source: "airship-orbit",
            layout: {
                "line-cap": "round",
                "line-join": "round",
                "visibility": airshipVisible ? "visible" : "none"
            },
            paint: {
                "line-color": "#fbbf24",
                "line-width": 1.75,
                "line-opacity": 0.4,
                "line-dasharray": [4, 4],
                "line-blur": 0.8
            }
        });

        // Add Airship Dynamic GeoJSON Source
        globeMap.addSource("airship", {
            type: "geojson",
            data: getAirshipGeoJSON(getAirshipPosition(airshipProgress))
        });

        // Searchlight scan footprint on ground
        globeMap.addLayer({
            id: "airship-searchlight",
            type: "circle",
            source: "airship",
            layout: {
                "visibility": airshipVisible ? "visible" : "none"
            },
            paint: {
                "circle-radius": [
                    "interpolate", ["linear"], ["zoom"],
                    1, 14,
                    5, 28,
                    9, 48
                ],
                "circle-color": "rgba(254, 240, 138, 0.22)",
                "circle-blur": 0.5,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "rgba(250, 204, 21, 0.65)"
            }
        });

        // Victorian Airship Symbol Layer
        globeMap.addLayer({
            id: "airship-symbol",
            type: "symbol",
            source: "airship",
            layout: {
                "icon-image": "victorian-airship",
                "icon-size": [
                    "interpolate", ["linear"], ["zoom"],
                    1, 0.62,
                    3, 0.76,
                    6, 1.05,
                    9, 1.35
                ],
                "icon-rotate": ["get", "iconHeading"],
                "icon-rotation-alignment": "map",
                "icon-pitch-alignment": "map",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "visibility": airshipVisible ? "visible" : "none"
            }
        });

        globeMap.on("click", "airship-symbol", function (event) {
            var feature = event.features && event.features[0];
            if (!feature) return;
            showAirshipPopup(event.lngLat);
        });

        globeMap.on("mouseenter", "airship-symbol", function () {
            globeMap.getCanvas().style.cursor = "pointer";
        });
        globeMap.on("mouseleave", "airship-symbol", function () {
            globeMap.getCanvas().style.cursor = "";
        });

        initAirshipModule();

        applyDepthFilters();
        mapLoaded = true;
        syncChampionPingMotion();

        if (currentGeojson.features.length) {
            refreshEarthquakeSource();
        }

        ["mousedown", "touchstart", "wheel", "dblclick"].forEach(function (eventName) {
            globeMap.on(eventName, function () {
                setAutoRotate(false);
                if (isFollowingAirship) {
                    toggleFollowAirship(false);
                }
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
            renderFeedDrawer();
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
    updateSummary: updateSummary,
    matchesSearchQuery: matchesSearchQuery,
    parseSearchQuery: parseSearchQuery,
    resolveLocationTokens: resolveLocationTokens,
    fitFeaturesBounds: fitFeaturesBounds,
    renderSearchSuggestions: renderSearchSuggestions,
    matchesMagnitudeFilter: matchesMagnitudeFilter,
    getFilteredFeatures: getFilteredFeatures,
    setTectonicPlatesVisibility: setTectonicPlatesVisibility,
    createAirshipImage: createAirshipImage,
    build3DAirshipMesh: build3DAirshipMesh,
    init3DAirshipInspector: init3DAirshipInspector,
    getAirshipPosition: getAirshipPosition,
    setAirshipVisibility: setAirshipVisibility,
    toggleFollowAirship: toggleFollowAirship,
    flyToAirship: flyToAirship,
    soundSteamWhistle: soundSteamWhistle,
    airshipWaypoints: airshipWaypoints,
    toggleFeedDrawer: toggleFeedDrawer,
    renderFeedDrawer: renderFeedDrawer,
    startTimelapse: startTimelapse,
    pauseTimelapse: pauseTimelapse,
    stopTimelapse: stopTimelapse
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

    // Airship fly-to button
    var flyAirshipBtn = document.getElementById("fly-to-airship");
    if (flyAirshipBtn) {
        flyAirshipBtn.addEventListener("click", function () {
            flyToAirship();
        });
    }

    // Search bar event wiring
    var searchInput = document.getElementById("quake-search");
    var clearSearchBtn = document.getElementById("clear-search");
    if (searchInput) {
        searchInput.addEventListener("input", function (event) {
            searchQuery = event.target.value;
            if (clearSearchBtn) {
                clearSearchBtn.hidden = !searchQuery;
            }
            refreshEarthquakeSource();
            renderFeedDrawer();
            var visible = getVisibleGeojson();
            updateSummary(visible);
            renderSearchSuggestions(searchQuery, visible.features);
        });

        searchInput.addEventListener("focus", function () {
            if (searchQuery) {
                var visible = getVisibleGeojson();
                renderSearchSuggestions(searchQuery, visible.features);
            }
        });

        searchInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                var matches = getVisibleGeojson().features;
                if (matches.length) {
                    fitFeaturesBounds(matches);
                    var container = document.getElementById("search-suggestions");
                    if (container) container.hidden = true;
                }
            } else if (event.key === "Escape") {
                searchQuery = "";
                searchInput.value = "";
                if (clearSearchBtn) clearSearchBtn.hidden = true;
                refreshEarthquakeSource();
                renderFeedDrawer();
                updateSummary(getVisibleGeojson());
                var container = document.getElementById("search-suggestions");
                if (container) container.hidden = true;
            }
        });
    }

    document.addEventListener("click", function (event) {
        var searchBox = document.querySelector(".search-box");
        if (searchBox && !searchBox.contains(event.target)) {
            var container = document.getElementById("search-suggestions");
            if (container) container.hidden = true;
        }
    });

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener("click", function () {
            searchQuery = "";
            if (searchInput) searchInput.value = "";
            clearSearchBtn.hidden = true;
            refreshEarthquakeSource();
            renderFeedDrawer();
            updateSummary(getVisibleGeojson());
            var container = document.getElementById("search-suggestions");
            if (container) container.hidden = true;
            resetGlobeView();
        });
    }

    // Magnitude filter chips
    document.querySelectorAll(".mag-filter-chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
            minMagnitude = Number(chip.dataset.mag) || 0;
            document.querySelectorAll(".mag-filter-chip").forEach(function (c) {
                var isActive = c === chip;
                c.classList.toggle("is-active", isActive);
                c.setAttribute("aria-pressed", String(isActive));
            });
            refreshEarthquakeSource();
            renderFeedDrawer();
            updateSummary(getVisibleGeojson());
        });
    });

    // Activity Feed drawer toggle buttons
    var toggleFeedBtn = document.getElementById("toggle-feed-drawer");
    if (toggleFeedBtn) {
        toggleFeedBtn.addEventListener("click", function () {
            toggleFeedDrawer();
        });
    }
    var closeFeedBtn = document.getElementById("close-feed-drawer");
    if (closeFeedBtn) {
        closeFeedBtn.addEventListener("click", function () {
            toggleFeedDrawer(false);
        });
    }

    // Timelapse controls
    var toggleTimelapseBtn = document.getElementById("toggle-timelapse");
    if (toggleTimelapseBtn) {
        toggleTimelapseBtn.addEventListener("click", function () {
            if (isTimelapsePlaying) {
                stopTimelapse();
            } else {
                startTimelapse();
            }
        });
    }
    var playPauseBtn = document.getElementById("timelapse-play-pause");
    if (playPauseBtn) {
        playPauseBtn.addEventListener("click", function () {
            if (isTimelapsePlaying) {
                pauseTimelapse();
            } else {
                startTimelapse();
            }
        });
    }
    var stopBtn = document.getElementById("timelapse-stop");
    if (stopBtn) {
        stopBtn.addEventListener("click", stopTimelapse);
    }
    var timelapseRange = document.getElementById("timelapse-range");
    if (timelapseRange) {
        timelapseRange.addEventListener("input", function (event) {
            timelapseProgress = Number(event.target.value) || 0;
            if (isTimelapsePlaying) pauseTimelapse();
            refreshEarthquakeSource();
            renderFeedDrawer();
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

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            var drawer = document.getElementById("feed-drawer");
            if (drawer && !drawer.hidden) {
                toggleFeedDrawer(false);
            }
        }
    });

    loadEarthquakeData(currentRange);
});
