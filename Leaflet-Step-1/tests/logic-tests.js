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

    test("uses spheres for regular markers at every magnitude", function () {
        assertEqual(helpers.getMagnitudeShapeKey(-0.4), "sphere", "negative magnitude");
        assertEqual(helpers.getMagnitudeShapeKey(2), "sphere", "small magnitude");
        assertEqual(helpers.getMagnitudeShapeKey(5), "sphere", "medium magnitude");
        assertEqual(helpers.getMagnitudeShapeKey(8), "sphere", "large magnitude");
        assertEqual(helpers.getMagnitudeShapeKey("invalid"), "sphere", "invalid magnitude fallback");
    });

    test("formats embedded marker magnitudes", function () {
        assertEqual(helpers.formatMagnitudeLabel(5), "5.0", "whole magnitude");
        assertEqual(helpers.formatMagnitudeLabel(2.46), "2.5", "rounded magnitude");
        assertEqual(helpers.formatMagnitudeLabel(-0.4), "-0.4", "negative magnitude");
        assertEqual(helpers.formatMagnitudeLabel(-0.04), "0.0", "rounded negative zero");
        assertEqual(helpers.formatMagnitudeLabel(null), "—", "missing magnitude fallback");
        assertEqual(helpers.formatMagnitudeLabel("invalid"), "—", "invalid magnitude fallback");
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

    test("calculates earthquake summary values", function () {
        var now = Date.now();
        helpers.updateSummary({ features: [
            { properties: { mag: 2.5, time: now - 120000 }, geometry: { coordinates: [0, 0, 8] } },
            { properties: { mag: 6.1, time: now - 60000 }, geometry: { coordinates: [1, 1, 450] } }
        ] });
        assertEqual(document.getElementById("total-events").textContent, "2", "event count");
        assertEqual(document.getElementById("strongest-magnitude").textContent, "6.1 M", "strongest magnitude");
        assertEqual(document.getElementById("deepest-depth").textContent, "450 km", "deepest event");
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
