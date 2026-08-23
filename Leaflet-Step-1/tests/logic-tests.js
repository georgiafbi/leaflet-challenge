(function () {
    "use strict";

    var helpers = window.earthquakeApp.test;
    var results = [];

    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    function assertEqual(actual, expected, message) {
        assert(actual === expected, message + " (expected " + expected + ", received " + actual + ")");
    }

    function test(name, callback) {
        try {
            callback();
            results.push({ name: name, passed: true });
        } catch (error) {
            results.push({ name: name, passed: false, message: error.message });
        }
    }

    test("classifies depth boundaries", function () {
        assertEqual(helpers.getDepthRangeKey(10), "0-10", "10 km boundary");
        assertEqual(helpers.getDepthRangeKey(10.1), "10-30", "value above 10 km");
        assertEqual(helpers.getDepthRangeKey(30), "10-30", "30 km boundary");
        assertEqual(helpers.getDepthRangeKey(90.1), "90+", "value above 90 km");
        assertEqual(helpers.getDepthRangeKey("invalid"), "0-10", "invalid depth fallback");
    });

    test("builds ping colors from the depth palette", function () {
        var fill = helpers.getDepthColorExpression(0);
        var stroke = helpers.getDepthColorExpression(0.62);
        assertEqual(fill[0], "match", "depth color expression type");
        assertEqual(fill[3], "#7ae582", "shallow ping fill");
        assertEqual(fill[13], "#8b0000", "deep ping fill");
        assert(stroke[3] !== fill[3], "ping stroke should lighten the depth color");
        assert(stroke[13] !== fill[13], "deep ping stroke should remain visible");
    });

    test("uses spheres for regular markers at every magnitude", function () {
        assertEqual(helpers.getMagnitudeShapeKey(-0.4), "sphere", "negative magnitude");
        assertEqual(helpers.getMagnitudeShapeKey(2), "sphere", "small magnitude");
        assertEqual(helpers.getMagnitudeShapeKey(5), "sphere", "medium magnitude");
        assertEqual(helpers.getMagnitudeShapeKey(8), "sphere", "large magnitude");
        assertEqual(helpers.getMagnitudeShapeKey("invalid"), "sphere", "invalid magnitude fallback");
    });

    test("creates centered ringed epicenter artwork for champions", function () {
        var image = helpers.createEpicenterImage("#4dabf7");
        var selection = helpers.createChampionSelectionRingImage();
        assertEqual(image.width, 104, "epicenter canvas width");
        assertEqual(image.height, 104, "epicenter canvas height");
        assert(image.data[((52 * image.width + 52) * 4) + 3] > 0, "epicenter core should occupy the canvas center");
        assertEqual(image.data[3], 0, "epicenter artwork should not clip into the top-left corner");
        assertEqual(selection.width, 128, "champion selection canvas width");
        assertEqual(selection.data[((64 * selection.width + 64) * 4) + 3], 0, "champion selection center should remain transparent");
        assert(selection.data[((6 * selection.width + 64) * 4) + 3] > 0, "champion selection ring should surround the epicenter");
    });

    test("expands and fades staggered champion ping waves", function () {
        var start = helpers.getChampionPingFrame(0, 0);
        var midway = helpers.getChampionPingFrame(1100, 0);
        var staggered = helpers.getChampionPingFrame(0, 0.5);
        var reset = helpers.getChampionPingFrame(2200, 0);
        assertEqual(start.phase, 0, "first wave starts at the epicenter");
        assert(midway.expansion > start.expansion, "ping radius should expand over time");
        assert(midway.opacity < start.opacity, "ping should fade as it expands");
        assertEqual(staggered.phase, midway.phase, "second wave should be half a cycle ahead");
        assertEqual(reset.phase, 0, "ping should restart after one cycle");
    });

    test("honors champion ping motion lifecycle conditions", function () {
        var active = { hasMap: true, hasLayerA: true, hasLayerB: true, quakesVisible: true, hasCandidates: true, documentHidden: false, reducedMotion: false };
        assertEqual(helpers.getChampionPingMotionMode(active), "animated", "visible champion pings should animate");
        assertEqual(helpers.getChampionPingMotionMode(Object.assign({}, active, { reducedMotion: true })), "static", "reduced motion should use stable rings");
        assertEqual(helpers.getChampionPingMotionMode(Object.assign({}, active, { documentHidden: true })), "off", "hidden tabs should stop pings");
        assertEqual(helpers.getChampionPingMotionMode(Object.assign({}, active, { quakesVisible: false })), "off", "hidden earthquakes should stop pings");
        assertEqual(helpers.getChampionPingMotionMode(Object.assign({}, active, { hasLayerA: false })), "off", "missing first ping layer should stop animation");
        assertEqual(helpers.getChampionPingMotionMode(Object.assign({}, active, { hasLayerB: false })), "off", "missing second ping layer should stop animation");
        assertEqual(helpers.getChampionPingMotionMode(Object.assign({}, active, { hasCandidates: false })), "off", "no visible ping candidates should stop animation");

        var reducedState = helpers.handleReducedMotionChange({ matches: true });
        assertEqual(reducedState.reducedMotion, true, "preference handler should detect reduced motion");
        assertEqual(reducedState.autoRotate, false, "enabling reduced motion should stop globe rotation");
        var restoredState = helpers.handleReducedMotionChange({ matches: false });
        assertEqual(restoredState.autoRotate, false, "disabling reduced motion should not restart rotation automatically");
    });

    test("detects ping candidates that survive depth filters", function () {
        var features = [
            { properties: { depthKey: "0-10", isChampion: true, isSummaryHighlight: false } },
            { properties: { depthKey: "90+", isChampion: false, isSummaryHighlight: true } },
            { properties: { depthKey: "10-30", isChampion: false, isSummaryHighlight: false } }
        ];
        assertEqual(helpers.hasVisiblePingCandidates(features, new Set(["0-10"])), true, "visible champion should activate pings");
        assertEqual(helpers.hasVisiblePingCandidates(features, new Set(["90+"])), true, "visible summary highlight should activate pings");
        assertEqual(helpers.hasVisiblePingCandidates(features, new Set(["10-30"])), false, "ordinary visible earthquakes should not keep ping animation running");
        assertEqual(helpers.hasVisiblePingCandidates(features, new Set()), false, "fully filtered candidates should stop pings");
        assertEqual(helpers.hasVisiblePingCandidates([], new Set(["0-10"])), false, "empty feeds should stop pings");
    });

    test("schedules exactly one champion ping frame through lifecycle changes", function () {
        var nextId = 0;
        var pending = new Set();
        var staticPaints = 0;
        function requestFrame() {
            var id = ++nextId;
            pending.add(id);
            return id;
        }
        function cancelFrame(id) {
            pending.delete(id);
        }
        function transition(animationId, mode) {
            return helpers.transitionChampionPingMotion({
                animationId: animationId,
                mode: mode,
                requestFrame: requestFrame,
                cancelFrame: cancelFrame,
                renderFrame: function () {},
                applyStaticFrames: function () { staticPaints += 1; }
            });
        }

        var animationId = transition(null, "animated");
        assertEqual(pending.size, 1, "animation should request one frame");
        animationId = transition(animationId, "animated");
        assertEqual(pending.size, 1, "repeated synchronization should replace rather than duplicate frames");
        animationId = transition(animationId, "static");
        assertEqual(pending.size, 0, "reduced motion should cancel animation");
        assertEqual(staticPaints, 1, "reduced motion should paint stable rings once");
        animationId = transition(animationId, "animated");
        assertEqual(pending.size, 1, "leaving reduced motion should restart the ping frame");
        animationId = transition(animationId, "off");
        assertEqual(pending.size, 0, "hidden tabs or earthquakes should cancel pending frames");
        animationId = transition(animationId, "animated");
        assertEqual(pending.size, 1, "restoring visibility should restart one frame");
        transition(animationId, "off");
        assertEqual(pending.size, 0, "final shutdown should leave no pending frame");
    });

    test("formats embedded marker magnitudes", function () {
        assertEqual(helpers.formatMagnitudeLabel(5), "5.0", "whole magnitude");
        assertEqual(helpers.formatMagnitudeLabel(2.46), "2.5", "rounded magnitude");
        assertEqual(helpers.formatMagnitudeLabel(-0.4), "-0.4", "negative magnitude");
        assertEqual(helpers.formatMagnitudeLabel(-0.04), "0.0", "rounded negative zero");
        assertEqual(helpers.formatMagnitudeLabel(null), "—", "missing magnitude fallback");
        assertEqual(helpers.formatMagnitudeLabel("invalid"), "—", "invalid magnitude fallback");
    });

    test("normalizes magnitudes without treating missing values as zero", function () {
        assertEqual(helpers.getNumericMagnitude(0), 0, "real zero magnitude");
        assertEqual(helpers.getNumericMagnitude(-0.5), -0.5, "negative magnitude");
        assertEqual(helpers.getNumericMagnitude("2.4"), 2.4, "numeric string magnitude");
        assertEqual(helpers.getNumericMagnitude(null), null, "missing magnitude");
        assertEqual(helpers.getNumericMagnitude("invalid"), null, "invalid magnitude");
    });

    test("normalizes valid USGS features and rejects malformed records", function () {
        var normalized = helpers.normalizeEarthquakeFeature({
            id: "test-event",
            type: "Feature",
            geometry: { type: "Point", coordinates: [139.7, 35.7, 12.34] },
            properties: { mag: "-0.4", time: "1767225600000", place: "Test event" }
        });
        assert(normalized, "valid feature should be retained");
        assertEqual(normalized.properties.mag, -0.4, "magnitude normalization");
        assertEqual(normalized.properties.depth, "12.3", "depth formatting");
        assertEqual(normalized.properties.eventId, "test-event", "event identity");
        assertEqual(normalized.properties.magnitudeLabel, "-0.4", "marker label");
        assertEqual(helpers.normalizeEarthquakeFeature({ properties: {} }), null, "missing geometry");
        assertEqual(helpers.normalizeEarthquakeFeature({ type: "Feature", geometry: { type: "Point", coordinates: [200, 0, 10] }, properties: { time: 1 } }), null, "invalid longitude");
        assertEqual(helpers.normalizeEarthquakeFeature({ type: "Feature", geometry: { type: "Point", coordinates: [0, 0, 10] }, properties: { time: "invalid" } }), null, "invalid timestamp");
        assertEqual(helpers.normalizeEarthquakeFeature({ type: "Feature", geometry: { type: "Point", coordinates: [null, 0, 10] }, properties: { time: 1 } }), null, "null longitude");
        assertEqual(helpers.normalizeEarthquakeFeature({ type: "Feature", geometry: { type: "Point", coordinates: [0, 0, 10] }, properties: { time: "" } }), null, "empty timestamp");
        assertEqual(helpers.normalizeEarthquakeFeature({ type: "NotAFeature", geometry: { type: "Point", coordinates: [0, 0, 10] }, properties: { time: 1 } }), null, "invalid GeoJSON type");
    });

    test("selects range presets and fallback", function () {
        assertEqual(helpers.getRangePresetByKey("7d").hours, 168, "7-day preset");
        assertEqual(helpers.getRangePresetByKey("30d").hours, 720, "30-day quick preset");
        assertEqual(helpers.getRangePresetByKey("missing").key, "24h", "unknown preset fallback");
    });

    test("reveals zoom jokes once at upward thresholds", function () {
        var seen = new Set();
        var first = helpers.getZoomEasterEgg(1.6, 3.5, seen);
        assertEqual(first.key, "closer", "first zoom threshold");
        seen.add(first.key);
        assertEqual(helpers.getZoomEasterEgg(3.5, 2, seen), null, "zooming out should not reveal a joke");
        assertEqual(helpers.getZoomEasterEgg(2, 3.5, seen), null, "a seen joke should not repeat");
        assertEqual(helpers.getZoomEasterEgg(3.5, 10, seen).key, "neighborhood", "a large jump should show the closest crossed threshold");
        assertEqual(helpers.getZoomEasterEgg(NaN, 10, seen), null, "invalid zoom should be ignored");
    });

    test("uses stable earthquake identities for selection", function () {
        assertEqual(helpers.getQuakeIdentity({ id: "us7000test", properties: {} }), "us7000test", "GeoJSON feature ID");
        assertEqual(helpers.getQuakeIdentity({ properties: { eventId: "event-42" } }), "event-42", "stored event ID");
        assertEqual(helpers.getQuakeIdentity({ properties: { code: "fallback-code" } }), "fallback-code", "USGS code fallback");
        assertEqual(helpers.getQuakeIdentity(null), null, "missing feature");
    });

    test("synchronizes collapsible map panel state", function () {
        var panel = document.createElement("div");
        var button = document.createElement("button");
        var content = document.createElement("div");
        helpers.setMapPanelExpanded(panel, button, content, true);
        assert(panel.classList.contains("is-expanded"), "expanded class should be applied");
        assertEqual(button.getAttribute("aria-expanded"), "true", "expanded accessibility state");
        assertEqual(content.hidden, false, "expanded content visibility");

        helpers.setMapPanelExpanded(panel, button, content, false);
        assert(!panel.classList.contains("is-expanded"), "expanded class should be removed");
        assertEqual(button.getAttribute("aria-expanded"), "false", "collapsed accessibility state");
        assertEqual(content.hidden, true, "collapsed content visibility");
    });

    test("keeps only one earthquake popup active", function () {
        function createPopupDouble() {
            return {
                removeCount: 0,
                closeHandler: null,
                remove: function () {
                    this.removeCount += 1;
                    if (this.closeHandler) this.closeHandler();
                },
                on: function (eventName, handler) {
                    if (eventName === "close") this.closeHandler = handler;
                }
            };
        }

        var first = createPopupDouble();
        var second = createPopupDouble();
        helpers.setActiveQuakePopup(first);
        helpers.setActiveQuakePopup(second);
        assertEqual(first.removeCount, 1, "opening another popup should remove the previous popup");
        assertEqual(second.removeCount, 0, "the new popup should remain open");

        first.closeHandler();
        helpers.setActiveQuakePopup(null);
        assertEqual(second.removeCount, 1, "a stale close event must not clear the newer popup");

        var manuallyClosed = createPopupDouble();
        helpers.setActiveQuakePopup(manuallyClosed);
        manuallyClosed.closeHandler();
        helpers.setActiveQuakePopup(null);
        assertEqual(manuallyClosed.removeCount, 0, "a manually closed popup should not be removed twice");
    });

    test("builds paginated USGS URLs", function () {
        var start = new Date("2026-01-01T00:00:00.000Z");
        var end = new Date("2026-01-02T00:00:00.000Z");
        var url = new URL(helpers.buildRangeUrl(start, end, 20001));
        assertEqual(url.searchParams.get("limit"), "20000", "page size");
        assertEqual(url.searchParams.get("offset"), "20001", "page offset");
        assertEqual(url.searchParams.get("starttime"), start.toISOString(), "start time");
        assertEqual(url.searchParams.get("endtime"), end.toISOString(), "end time");
    });

    test("renders external popup values as text", function () {
        var malicious = '<img src=x onerror="window.popupInjected=true">';
        var popup = helpers.buildPopupContent({
            place: malicious,
            mag: 4.2,
            depth: "12.0",
            displayRegion: "Test area",
            championGroup: "Test group",
            type: "<script>window.popupInjected=true</script>",
            time: Date.now(),
            isChampion: true
        });
        assert(popup.textContent.includes(malicious), "place text should be preserved");
        assertEqual(popup.querySelectorAll("img, script").length, 0, "markup must not become elements");
        assertEqual(popup.querySelectorAll(".popup-fact").length, 5, "compact fact count");
        assertEqual(popup.querySelectorAll(".popup-fact--wide").length, 1, "timestamp should span the popup");
        assert(window.popupInjected !== true, "popup payload must not execute");
    });

    test("extracts authoritative fault and plate context", function () {
        var detail = {
            properties: {
                products: {
                    "general-text": [{
                        preferredWeight: 1,
                        updateTime: 10,
                        contents: {
                            "": {
                                bytes: "<h2>Tectonic Summary</h2><p>The earthquake occurred near a triple-junction between the Anatolia, Arabia, and Africa plates.</p><p>The mechanism is consistent with rupture on either the East Anatolia fault zone or the Dead Sea transform fault zone relative to the Eurasia plate.</p>"
                            }
                        }
                    }]
                }
            }
        };
        var metadata = helpers.extractTectonicMetadata(detail);
        assertEqual(metadata.faults.join(" | "), "East Anatolia fault zone | Dead Sea transform fault zone", "named faults");
        assertEqual(metadata.plates.join(" | "), "Anatolia | Arabia | Africa | Eurasia", "plate names");
        assert(metadata.tectonicContext.includes("triple-junction"), "tectonic excerpt should retain plate context");
    });

    test("omits scientific context when USGS does not provide it", function () {
        var metadata = helpers.extractTectonicMetadata({ properties: { products: { origin: [] } } });
        assertEqual(Object.keys(metadata).length, 0, "missing summary should produce no inferred metadata");
    });

    test("renders scientific popup details as text", function () {
        var malicious = '<img src=x onerror="window.popupInjected=true">';
        var popup = helpers.buildPopupContent({
            place: "Test event",
            mag: 7.8,
            depth: "10.0",
            displayRegion: "Test area",
            type: "earthquake",
            time: Date.now(),
            faults: [malicious],
            plates: ["Anatolia", "Arabia"],
            tectonicContext: malicious
        });
        assertEqual(popup.querySelectorAll("img, script").length, 0, "scientific markup must not become elements");
        assertEqual(popup.querySelectorAll(".popup-fact").length, 8, "optional scientific fact count");
        assertEqual(popup.querySelectorAll(".popup-fact--wide").length, 4, "scientific rows should span the popup");
        assert(popup.textContent.includes(malicious), "scientific text should be preserved");
        assert(window.popupInjected !== true, "scientific payload must not execute");
    });

    test("classifies representative champion groups", function () {
        assertEqual(helpers.getChampionGroup(-74, 40), "North America", "North America");
        assertEqual(helpers.getChampionGroup(-75, -10), "South America", "South America");
        assertEqual(helpers.getChampionGroup(2, 46), "Europe", "Europe");
        assertEqual(helpers.getChampionGroup(37, -1), "Africa", "Africa");
        assertEqual(helpers.getChampionGroup(138, 36), "Asia", "Asia");
        assertEqual(helpers.getChampionGroup(151, -33), "Oceania", "Oceania");
    });

    test("uses country names on land", function () {
        var japan = helpers.classifyGeography(139.6917, 35.6895);
        assertEqual(japan.country, "Japan", "Tokyo country lookup");
        assertEqual(japan.countryCode, "JP", "Tokyo country code");
        assertEqual(japan.displayRegion, "Japan", "country display label");
        assertEqual(japan.championGroup, "Asia", "country champion group");
    });

    test("uses named areas for offshore coordinates", function () {
        var atlantic = helpers.classifyGeography(-30, 35);
        assertEqual(atlantic.country, null, "ocean point has no country");
        assertEqual(atlantic.displayRegion, "North Atlantic Ocean", "offshore display label");
        assertEqual(atlantic.championGroup, "North America", "offshore champion group remains broad");
        assertEqual(helpers.getOffshoreArea(20, 38), "Mediterranean Sea", "named sea fallback");
    });

    test("falls back safely when country lookup is unavailable", function () {
        var savedCountryCoder = window.countryCoder;
        try {
            window.countryCoder = null;
            var fallback = helpers.classifyGeography(139.6917, 35.6895);
            assertEqual(fallback.country, null, "country should be absent without the lookup");
            assertEqual(fallback.displayRegion, "Asia region", "broad fallback label");
            assertEqual(fallback.championGroup, "Asia", "champion grouping remains available");
        } finally {
            window.countryCoder = savedCountryCoder;
        }
    });

    test("marks one strongest quake per broad group", function () {
        var features = [
            { properties: { mag: 3 }, geometry: { coordinates: [139.7, 35.7, 10] } },
            { properties: { mag: 5 }, geometry: { coordinates: [100, 30, 10] } },
            { properties: { mag: 4 }, geometry: { coordinates: [-74, 40, 10] } }
        ];
        helpers.markRegionalChampions(features);
        assertEqual(features[0].properties.isChampion, false, "weaker Asian quake");
        assertEqual(features[1].properties.isChampion, true, "strongest Asian quake");
        assertEqual(features[2].properties.isChampion, true, "North American champion");
        assert(features[0].properties.displayRegion, "classification should add a display label");
    });

    test("does not promote unknown magnitudes over negative earthquakes", function () {
        var features = [
            { properties: { mag: null }, geometry: { coordinates: [100, 30, 10] } },
            { properties: { mag: -0.5 }, geometry: { coordinates: [101, 31, 10] } }
        ];
        helpers.markRegionalChampions(features);
        assertEqual(features[0].properties.isChampion, false, "unknown magnitude should not be champion");
        assertEqual(features[1].properties.isChampion, true, "known negative magnitude should be champion");
    });

    test("calculates earthquake summary values", function () {
        var now = Date.now();
        var features = [
            { properties: { mag: 2.5, time: now - 120000 }, geometry: { coordinates: [0, 0, 8] } },
            { properties: { mag: 6.1, time: now - 60000 }, geometry: { coordinates: [1, 1, 450] } }
        ];
        helpers.updateSummary({ features: features });
        assertEqual(document.getElementById("total-events").textContent, "2", "event count");
        assertEqual(document.getElementById("strongest-magnitude").textContent, "6.1 M", "strongest magnitude");
        assertEqual(document.getElementById("deepest-depth").textContent, "450 km", "deepest event");
        assert(document.getElementById("feed-announcement").textContent.includes("2 earthquakes loaded"), "summary should be announced");
        assertEqual(features[0].properties.isStrongest, false, "weaker event should not be strongest");
        assertEqual(features[0].properties.isDeepest, false, "shallower event should not be deepest");
        assertEqual(features[0].properties.isLatest, false, "older event should not be latest");
        assertEqual(features[1].properties.isStrongest, true, "strongest event should be flagged for pinging");
        assertEqual(features[1].properties.isDeepest, true, "deepest event should be flagged for pinging");
        assertEqual(features[1].properties.isLatest, true, "latest event should be flagged for pinging");
        assertEqual(features[1].properties.isSummaryHighlight, true, "one event with several roles should receive one ping feature");
    });

    test("excludes unknown magnitudes from strongest summary", function () {
        var now = Date.now();
        helpers.updateSummary({ features: [
            { properties: { mag: null, time: now }, geometry: { coordinates: [0, 0, 8] } },
            { properties: { mag: -0.6, time: now - 1 }, geometry: { coordinates: [1, 1, 9] } }
        ] });
        assertEqual(document.getElementById("strongest-magnitude").textContent, "-0.6 M", "known negative magnitude should win");
    });

    test("matches search queries by location, region, and type", function () {
        var event = {
            properties: {
                place: "70 km SSW of Tokyo, Japan",
                country: "Japan",
                countryCode: "JP",
                displayRegion: "Japan",
                championGroup: "Asia",
                type: "earthquake",
                mag: 5.2,
                depth: 25,
                searchIndex: "70 km ssw of tokyo, japan tokyo japan jp asia earthquake shallow m5.2 mag 5.2 japanese"
            }
        };
        assertEqual(helpers.matchesSearchQuery(event, ""), true, "empty query matches all");
        assertEqual(helpers.matchesSearchQuery(event, "tokyo"), true, "city match");
        assertEqual(helpers.matchesSearchQuery(event, "JAPAN"), true, "case-insensitive country match");
        assertEqual(helpers.matchesSearchQuery(event, "japanese"), true, "country alias match");
        assertEqual(helpers.matchesSearchQuery(event, "asia"), true, "champion group match");
        assertEqual(helpers.matchesSearchQuery(event, "california"), false, "non-matching query");
        assertEqual(helpers.matchesSearchQuery(event, "Japan 5+"), true, "multi-token magnitude match");
        assertEqual(helpers.matchesSearchQuery(event, "Japan 6+"), false, "magnitude above event mag fails");
        assertEqual(helpers.matchesSearchQuery(event, "Tokyo shallow"), true, "depth category query matches");
        assertEqual(helpers.matchesSearchQuery(event, "Tokyo deep"), false, "depth category query mismatch fails");
    });

    test("resolves state abbreviations and country aliases for robust searching", function () {
        var usEvent = helpers.normalizeEarthquakeFeature({
            type: "Feature",
            geometry: { type: "Point", coordinates: [-117.6, 35.7, 8.2] },
            properties: { place: "14 km ENE of Ridgecrest, CA", mag: 4.2, time: 1600000000000 }
        });
        assertEqual(usEvent.properties.state, "California", "resolved state name");
        assertEqual(usEvent.properties.stateCode, "CA", "resolved state code");
        assertEqual(usEvent.properties.country, "United States", "resolved country");
        assert(usEvent.properties.locationAliases.includes("usa"), "aliases include usa");
        assert(usEvent.properties.locationAliases.includes("california"), "aliases include california");

        helpers.markRegionalChampions([usEvent]);
        assertEqual(helpers.matchesSearchQuery(usEvent, "california"), true, "matches full state name");
        assertEqual(helpers.matchesSearchQuery(usEvent, "CA"), true, "matches state code");
        assertEqual(helpers.matchesSearchQuery(usEvent, "USA"), true, "matches country alias USA");
        assertEqual(helpers.matchesSearchQuery(usEvent, "United States"), true, "matches country name");
        assertEqual(helpers.matchesSearchQuery(usEvent, "Ridgecrest M4+"), true, "matches city and magnitude expression");
    });

    test("filters features by minimum magnitude threshold", function () {
        assertEqual(helpers.matchesMagnitudeFilter(5.2, 0), true, "all magnitudes pass min 0");
        assertEqual(helpers.matchesMagnitudeFilter(4.5, 4.5), true, "exact match threshold");
        assertEqual(helpers.matchesMagnitudeFilter(2.4, 2.5), false, "below threshold");
        assertEqual(helpers.matchesMagnitudeFilter(null, 4.5), false, "null magnitude fails positive threshold");
        assertEqual(helpers.matchesMagnitudeFilter(null, 0), true, "null magnitude passes when filter is All");
    });

    test("filters features across combined depth, magnitude, and search criteria", function () {
        var features = [
            { properties: { depthKey: "0-10", mag: 5.5, depth: 8, place: "Fukushima, Japan", country: "Japan", searchIndex: "fukushima japan jp shallow m5.5 mag 5.5", time: 100 } },
            { properties: { depthKey: "10-30", mag: 2.1, depth: 15, place: "Los Angeles, CA", state: "California", stateCode: "CA", country: "United States", searchIndex: "los angeles ca california usa united states shallow m2.1 mag 2.1", time: 200 } },
            { properties: { depthKey: "90+", mag: 6.8, depth: 120, place: "Santiago, Chile", country: "Chile", searchIndex: "santiago chile cl deep m6.8 mag 6.8", time: 300 } }
        ];
        var filtered = helpers.getFilteredFeatures(features, {
            activeDepthRanges: new Set(["0-10", "90+"]),
            minMagnitude: 5.0,
            searchQuery: "chile"
        });
        assertEqual(filtered.length, 1, "only Chile event should match all 3 criteria");
        assertEqual(filtered[0].properties.place, "Santiago, Chile", "correct matched feature");
    });

    test("verifies PB2002 tectonic plate boundaries GeoJSON dataset structure", function () {
        assert(window.tectonicPlatesGeoJSON, "plate boundaries dataset exists");
        assertEqual(window.tectonicPlatesGeoJSON.type, "FeatureCollection", "feature collection type");
        assert(window.tectonicPlatesGeoJSON.features.length >= 200, "comprehensive PB2002 plate boundaries present");
        var firstFeature = window.tectonicPlatesGeoJSON.features[0];
        assertEqual(firstFeature.type, "Feature", "feature type");
        assertEqual(firstFeature.geometry.type, "LineString", "linestring geometry");
        assert(Array.isArray(firstFeature.geometry.coordinates) && firstFeature.geometry.coordinates.length > 2, "coordinate array");
        assert(firstFeature.properties.name, "boundary name property exists");
        assert(firstFeature.properties.type, "boundary type property exists");
        assert(firstFeature.properties.plateA && firstFeature.properties.plateB, "plate pairings exist");
    });

    test("toggles feed drawer open and closed with synchronized accessibility attributes", function () {
        var drawer = document.getElementById("feed-drawer");
        if (!drawer) {
            drawer = document.createElement("aside");
            drawer.id = "feed-drawer";
            drawer.setAttribute("hidden", "");
            document.body.appendChild(drawer);
        }
        var button = document.getElementById("toggle-feed-drawer");
        if (!button) {
            button = document.createElement("button");
            button.id = "toggle-feed-drawer";
            document.body.appendChild(button);
        }

        helpers.toggleFeedDrawer(true);
        assertEqual(drawer.hidden, false, "drawer should be unhidden when opened");
        assertEqual(drawer.hasAttribute("hidden"), false, "hidden attribute removed");
        assertEqual(button.getAttribute("aria-expanded"), "true", "button aria-expanded true");

        helpers.toggleFeedDrawer(false);
        assertEqual(drawer.hidden, true, "drawer should be hidden when closed");
        assertEqual(drawer.hasAttribute("hidden"), true, "hidden attribute present");
        assertEqual(button.getAttribute("aria-expanded"), "false", "button aria-expanded false");
    });

    test("verifies Victorian airship orbital flight dynamics and waypoints", function () {
        assert(Array.isArray(helpers.airshipWaypoints) && helpers.airshipWaypoints.length >= 15, "has full global waypoint route");
        var pos0 = helpers.getAirshipPosition(0.0);
        assert(Number.isFinite(pos0.lon), "pos0 valid lon");
        assert(Number.isFinite(pos0.lat), "pos0 valid lat");
        assert(Number.isFinite(pos0.bearing), "pos0 valid bearing");
        assert(Number.isFinite(pos0.iconHeading), "pos0 valid iconHeading");
        assert(pos0.altitude && pos0.altitude.includes("3,850"), "pos0 altitude");
        assert(pos0.speed && pos0.speed.includes("48 knots"), "pos0 cruise speed");
        assert(pos0.currentWaypoint, "pos0 currentWaypoint exists");
        assert(pos0.note, "pos0 captain dispatch note exists");

        var posMid = helpers.getAirshipPosition(0.5);
        assert(Number.isFinite(posMid.lon) && Number.isFinite(posMid.lat), "posMid coordinates valid");

        var imgData = helpers.createAirshipImage();
        assert(imgData && imgData.width === 240 && imgData.height === 120, "airship canvas returns 240x120 high-DPI image");
    });

    test("verifies Three.js 3D Victorian dirigible model construction", function () {
        if (window.THREE) {
            var model = helpers.build3DAirshipMesh(window.THREE);
            assert(model && model.group, "3D airship group generated");
            assert(model.group.children.length >= 8, "has hull, nose cap, fins, ribs, gondola, and engines");
            assert(Array.isArray(model.props) && model.props.length >= 2, "has 3D propellers (stern and outriggers)");
            assert(Array.isArray(model.exhaustParticles) && model.exhaustParticles.length >= 4, "has steam exhaust particles");
            assert(model.lanternGroup, "has signature hanging glowing lantern");
        }
    });

    test("verifies distinct steam whistle audio profiles for all three airships", function () {
        var profiles = helpers.AIRSHIP_WHISTLE_PROFILES;
        assert(Array.isArray(profiles) && profiles.length === 3, "has 3 distinct whistle profiles");

        var aetheria = profiles[0];
        assertEqual(aetheria.name, "HMS Aetheria", "Aetheria profile name");
        assertEqual(aetheria.oscType, "sawtooth", "Aetheria sawtooth waveform");
        assert(Array.isArray(aetheria.frequencies) && aetheria.frequencies.length === 3, "Aetheria 3-chime chord");

        var equinox = profiles[1];
        assertEqual(equinox.name, "HMS Equinox", "Equinox profile name");
        assertEqual(equinox.oscType, "triangle", "Equinox triangle fluted waveform");
        assert(Array.isArray(equinox.frequencies) && equinox.frequencies.length === 4, "Equinox clarion chime chord");

        var australis = profiles[2];
        assertEqual(australis.name, "HMS Australis", "Australis profile name");
        assertEqual(australis.oscType, "sawtooth", "Australis sawtooth waveform");
        assert(Array.isArray(australis.frequencies) && australis.frequencies[0] < 200, "Australis deep sub-200Hz bass foghorn");
    });

    test("maps latitudes to correct airship orbital zones and triggers depth pings", function () {
        assertEqual(helpers.getAirshipVesselForLatitude(45.0), 0, "45°N mapped to HMS Aetheria (Northern)");
        assertEqual(helpers.getAirshipVesselForLatitude(15.0), 0, "15°N mapped to HMS Aetheria (Northern)");
        assertEqual(helpers.getAirshipVesselForLatitude(0.0), 1, "0° mapped to HMS Equinox (Equatorial)");
        assertEqual(helpers.getAirshipVesselForLatitude(-10.0), 1, "-10° mapped to HMS Equinox (Equatorial)");
        assertEqual(helpers.getAirshipVesselForLatitude(-25.0), 2, "-25° mapped to HMS Australis (Southern)");
        assertEqual(helpers.getAirshipVesselForLatitude(-75.0), 2, "-75° mapped to HMS Australis (Southern)");

        var testQuake = {
            properties: { eventId: "test-eq-1", depthKey: "70-90", time: Date.now() },
            geometry: { coordinates: [139.69, 35.68, 82.5] }
        };
        // Should execute cleanly without throwing
        helpers.triggerAirshipDetectionPing(0, testQuake, false);
        assert(typeof helpers.triggerAirshipDetectionPing === "function", "triggerAirshipDetectionPing is a helper function");
    });

    test("organizes the airship fleet into three squadrons of flagship plus escorts", function () {
        var fleet = helpers.SATELLITE_FLEET;
        assert(Array.isArray(fleet) && fleet.length === 9, "fleet has nine ships");

        // Flagships hold positions 0-2 and match their squadron theme index.
        [0, 1, 2].forEach(function (idx) {
            assertEqual(fleet[idx].vesselIdx, idx, "flagship " + idx + " leads its own squadron");
            assertEqual(helpers.getFleetThemeIndex(idx), idx, "flagship theme index matches position");
        });

        // Each squadron fields exactly three ships, escorts are smaller.
        [0, 1, 2].forEach(function (squadron) {
            var ships = fleet.filter(function (v) { return v.vesselIdx === squadron; });
            assertEqual(ships.length, 3, "squadron " + squadron + " has three ships");
        });
        fleet.forEach(function (vessel, idx) {
            if (idx > 2) {
                assert(vessel.scale < fleet[vessel.vesselIdx].scale, vessel.name + " escort is smaller than its flagship");
                assertEqual(helpers.getFleetThemeIndex(idx), vessel.vesselIdx, vessel.name + " resolves its squadron theme");
                // Escorts must patrol inside their squadron's detection zone even
                // at maximum latitude wander.
                var minLat = vessel.baseLat - vessel.latAmplitude;
                var maxLat = vessel.baseLat + vessel.latAmplitude;
                assertEqual(helpers.getAirshipVesselForLatitude(minLat), vessel.vesselIdx, vessel.name + " southern edge stays in zone");
                assertEqual(helpers.getAirshipVesselForLatitude(maxLat), vessel.vesselIdx, vessel.name + " northern edge stays in zone");
            }
        });

        // Every ship reports a valid moving position.
        fleet.forEach(function (vessel, idx) {
            var pos = helpers.getAirshipPosition(0.37, idx);
            assertEqual(pos.name, vessel.name, "position " + idx + " reports " + vessel.name);
            assert(Number.isFinite(pos.lon) && Number.isFinite(pos.lat), vessel.name + " has valid coordinates");
            assertEqual(pos.themeIdx, vessel.vesselIdx, vessel.name + " carries its squadron theme");
        });
    });

    test("toggles quick guide modal open and closed with accessibility attributes", function () {
        var backdrop = document.getElementById("guide-modal-backdrop");
        if (!backdrop) {
            backdrop = document.createElement("div");
            backdrop.id = "guide-modal-backdrop";
            backdrop.setAttribute("hidden", "");
            document.body.appendChild(backdrop);
        }
        var modal = document.getElementById("guide-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "guide-modal";
            modal.tabIndex = -1;
            backdrop.appendChild(modal);
        }
        var button = document.getElementById("open-guide-modal");
        if (!button) {
            button = document.createElement("button");
            button.id = "open-guide-modal";
            document.body.appendChild(button);
        }

        helpers.openGuideModal();
        assertEqual(backdrop.hidden, false, "guide backdrop unhidden when opened");
        assertEqual(backdrop.hasAttribute("hidden"), false, "guide hidden attribute removed");
        assertEqual(button.getAttribute("aria-expanded"), "true", "guide button aria-expanded true");

        helpers.closeGuideModal();
        assertEqual(backdrop.hidden, true, "guide backdrop hidden when closed");
        assertEqual(backdrop.hasAttribute("hidden"), true, "guide hidden attribute set");
        assertEqual(button.getAttribute("aria-expanded"), "false", "guide button aria-expanded false");
    });

    var failed = results.filter(function (result) { return !result.passed; });
    var list = document.getElementById("results");
    results.forEach(function (result) {
        var item = document.createElement("li");
        item.className = result.passed ? "pass" : "fail";
        item.textContent = (result.passed ? "PASS — " : "FAIL — ") + result.name + (result.message ? ": " + result.message : "");
        list.appendChild(item);
    });

    document.body.dataset.failed = String(failed.length);
    document.getElementById("summary").textContent = (results.length - failed.length) + "/" + results.length + " tests passed";
    document.title = failed.length ? "FAILED — Earthquake Monitor Tests" : "PASS — Earthquake Monitor Tests";

    if (failed.length) {
        console.error("Earthquake Monitor tests failed", failed);
    }
}());
