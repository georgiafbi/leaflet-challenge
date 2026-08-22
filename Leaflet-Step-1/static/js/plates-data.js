(function () {
    "use strict";

    // PB2002 Global Tectonic Plate Boundaries GeoJSON (simplified for responsive 3D globe rendering)
    window.tectonicPlatesGeoJSON = {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: { name: "Mid-Atlantic Ridge", type: "Divergent", plates: "North American - Eurasian / South American - African" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [0.0, 87.0], [-10.0, 80.0], [-18.0, 72.0], [-20.0, 65.0], [-29.0, 56.0], [-35.0, 48.0],
                        [-43.0, 36.0], [-45.0, 27.0], [-41.0, 16.0], [-33.0, 8.0], [-24.0, 1.0], [-15.0, -2.0],
                        [-13.0, -8.0], [-14.0, -15.0], [-13.0, -26.0], [-16.0, -38.0], [-18.0, -48.0], [-15.0, -54.0],
                        [-5.0, -55.0], [5.0, -54.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Pacific Ring of Fire - West & North (Aleutian to Kuril to Japan)", type: "Convergent", plates: "Pacific - North American / Okhotsk / Eurasian" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [-148.0, 59.0], [-160.0, 55.0], [-170.0, 53.0], [-180.0, 51.5], [170.0, 52.0],
                        [160.0, 53.5], [150.0, 46.0], [144.0, 41.0], [141.0, 35.0], [138.0, 31.0], [132.0, 27.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Mariana & Izu-Bonin Trench", type: "Convergent", plates: "Pacific - Philippine Sea" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [141.0, 35.0], [142.0, 28.0], [144.0, 20.0], [146.0, 14.0], [144.0, 11.0], [138.0, 9.0], [130.0, 5.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Ryukyu & Philippine Trench", type: "Convergent", plates: "Philippine Sea - Eurasian" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [131.0, 33.0], [128.0, 27.0], [124.0, 24.0], [122.0, 20.0], [126.0, 14.0], [127.0, 7.0], [126.0, 2.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Java / Sunda Trench", type: "Convergent", plates: "Indo-Australian - Eurasian" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [93.0, 15.0], [94.0, 8.0], [97.0, 2.0], [101.0, -3.0], [105.0, -7.0], [112.0, -9.0],
                        [120.0, -10.0], [128.0, -9.0], [133.0, -6.0], [135.0, -3.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Tonga - Kermadec - New Zealand Trench", type: "Convergent / Transform", plates: "Pacific - Indo-Australian" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [150.0, -4.0], [156.0, -7.0], [163.0, -11.0], [168.0, -15.0], [172.0, -15.0],
                        [-175.0, -16.0], [-173.0, -21.0], [-175.0, -30.0], [-178.0, -37.0], [178.0, -40.0],
                        [172.0, -44.0], [166.0, -46.0], [160.0, -50.0], [150.0, -56.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Cascadia Subduction & San Andreas Fault Zone", type: "Transform / Convergent", plates: "Juan de Fuca - Pacific - North American" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [-128.0, 51.0], [-127.0, 48.0], [-125.0, 43.0], [-124.5, 40.3], [-123.0, 38.0],
                        [-121.5, 36.0], [-119.5, 34.5], [-116.0, 32.5], [-114.0, 30.0], [-110.0, 24.0], [-106.0, 19.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Middle America Trench", type: "Convergent", plates: "Cocos - North American / Caribbean" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [-106.0, 19.0], [-102.0, 16.5], [-97.0, 14.5], [-91.0, 13.0], [-86.0, 10.5], [-83.0, 7.5]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Peru-Chile Trench (Nazca Subduction)", type: "Convergent", plates: "Nazca - South American" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [-81.0, 3.0], [-81.5, -4.0], [-79.0, -10.0], [-75.0, -16.0], [-71.5, -21.0],
                        [-71.5, -30.0], [-74.0, -38.0], [-75.5, -46.0], [-75.0, -52.0], [-68.0, -56.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "East Pacific Rise", type: "Divergent", plates: "Pacific - Nazca / Cocos" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [-106.0, 19.0], [-104.0, 10.0], [-102.0, 3.0], [-104.0, -5.0], [-109.0, -14.0],
                        [-112.0, -24.0], [-112.0, -36.0], [-114.0, -45.0], [-120.0, -53.0], [-140.0, -60.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Himalayan Frontal Thrust & Alpine Belt", type: "Collision / Convergent", plates: "Indian - Eurasian / African - Eurasian" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [-10.0, 36.0], [0.0, 37.0], [12.0, 42.0], [19.0, 39.0], [28.0, 38.0], [36.0, 38.0],
                        [44.0, 39.0], [52.0, 35.0], [60.0, 30.0], [68.0, 28.0], [74.0, 34.0], [80.0, 31.0],
                        [88.0, 28.0], [94.0, 26.0], [97.0, 22.0], [95.0, 16.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "East African Rift System", type: "Divergent", plates: "Nubian - Somali (African)" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [43.0, 12.0], [40.0, 8.0], [37.0, 3.0], [36.0, -3.0], [34.0, -9.0], [34.0, -16.0], [35.0, -20.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Red Sea & Dead Sea Transform", type: "Divergent / Transform", plates: "Arabian - African" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [43.0, 12.0], [40.0, 16.0], [36.0, 23.0], [34.0, 28.0], [35.5, 31.5], [36.5, 36.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Southeast & Southwest Indian Ridge", type: "Divergent", plates: "Antarctic - Indo-Australian / African" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [30.0, -54.0], [45.0, -45.0], [65.0, -30.0], [75.0, -35.0], [90.0, -45.0],
                        [115.0, -50.0], [140.0, -55.0], [160.0, -60.0]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Caribbean Plate Boundary", type: "Transform / Convergent", plates: "Caribbean - North / South American" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [-88.0, 16.0], [-82.0, 18.0], [-75.0, 19.5], [-68.0, 19.0], [-62.0, 17.5],
                        [-60.5, 13.0], [-62.0, 10.5], [-68.0, 11.0], [-74.0, 11.5], [-78.0, 9.5], [-83.0, 8.5]
                    ]
                }
            },
            {
                type: "Feature",
                properties: { name: "Scotia Plate Boundary", type: "Transform / Convergent", plates: "Scotia - South American / Antarctic" },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [-67.0, -56.0], [-55.0, -54.0], [-40.0, -54.0], [-27.0, -57.0], [-26.0, -60.0],
                        [-38.0, -61.0], [-50.0, -62.0], [-60.0, -63.0], [-65.0, -60.0]
                    ]
                }
            }
        ]
    };
}());
