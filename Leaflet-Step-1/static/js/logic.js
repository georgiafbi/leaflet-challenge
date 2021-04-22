const sevenDayUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";
const oneHourUrl="https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"
const mapCenter = [44.4280, -110.5885]; //yellowstone national park
const zoomLevel = 4.5;
const maxZoomLevel = 18;
negativeMag=[]
console.log(sevenDayUrl);

function createMap(earthquakes) {

    // Create the tile layer that will be the background of our map
    var satellitemap = L.tileLayer("https://api.mapbox.com/styles/v1/mapbox/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}", {
        attribution: "Map data &copy; <a href=\"https://www.openstreetmap.org/\">OpenStreetMap</a> contributors, <a href=\"https://creativecommons.org/licenses/by-sa/2.0/\">CC-BY-SA</a>, Imagery © <a href=\"https://www.mapbox.com/\">Mapbox</a>",
        maxZoom: 18,
        id: "satellite-streets-v11",
        accessToken: API_KEY
    });
    //Creating map object

    var layers= [satellitemap, earthquakes];
    var myMap = L.map("map-id", {
        center: mapCenter,
        zoom: zoomLevel,
        layers: layers
    });

    var baseMaps = createBaseLayers();
    console.log(myMap);
    // Create an overlayMaps object to hold the bikeStations layer
    var overlayMaps = {
        "7 Days of Earthquakes": earthquakes
    };
    console.log(overlayMaps);
    // Create a layer control, pass in the baseMaps and overlayMaps. Add the layer control to the map
    L.control.layers(baseMaps, overlayMaps, {
        collapsed: false
    }).addTo(myMap);
    console.log(negativeMag);


    var legend = L.control({ position: "bottomleft" });
  legend.onAdd = function () {
    var depths=['-10-10','10-30','30-50',"50-70","70-90","90+"]
    var div = L.DomUtil.create("div", "info legend");
    var colors = colorSelect("ALL");
    // // Add min & max
    var legendInfo = `<h3 style="color:white;">Earthquake Depth: </h3>`;
    legendInfo += '<ul style="background-color:white">';
    var i = 0;
    colors.forEach((color) =>{
        
      legendInfo += `<li style="list-style:square;color:${color};font-size:20px;background-color:white;"><h5 style="text-align:center;color:black">${depths[i]} km</h5></li>`;
      i++;
    });
    legendInfo += "</ul>";
    div.innerHTML = legendInfo;
    return div;
  };
  legend.addTo(myMap);
}


// Adding a tile layer (the background map image) to our map
// We use the addTo method to add objects to our map
// Create the tile layer that will be the background of our map
function createBaseLayers() {

    //TODO: Add four more base layers mapbox/light-v10 , mapbox/dark-v10
    //streets-v11 and satellite-streets-v11;
    var satellite_streetmap = L.tileLayer(
        "https://api.mapbox.com/styles/v1/mapbox/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
        {
            attribution:
                'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: maxZoomLevel,
            id: "satellite-streets-v11",
            accessToken: API_KEY,
        }
    );
    var darkmap = L.tileLayer("https://api.mapbox.com/styles/v1/mapbox/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}", {
        attribution: "Map data &copy; <a href=\"https://www.openstreetmap.org/\">OpenStreetMap</a> contributors, <a href=\"https://creativecommons.org/licenses/by-sa/2.0/\">CC-BY-SA</a>, Imagery © <a href=\"https://www.mapbox.com/\">Mapbox</a>",
        maxZoom: maxZoomLevel,
        id: "dark-v10",
        accessToken: API_KEY
    });

    var lightmap = L.tileLayer(
        "https://api.mapbox.com/styles/v1/mapbox/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
        {
            attribution:
                'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: maxZoomLevel,
            id: "light-v10",
            accessToken: API_KEY,
        }
    );
    var satellite = L.tileLayer(
        "https://api.mapbox.com/styles/v1/mapbox/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
        {
            attribution:
                'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: maxZoomLevel,
            id: "satellite-v9",
            accessToken: API_KEY,
        }
    );
    var baseMaps = {
        "Light Map": lightmap,
        "Dark Map": darkmap,
        "Street Map": satellite_streetmap,
        "Satellite Map": satellite
    };
    console.log(baseMaps);
    return baseMaps;
}
function createMarkers(data) {
    var quakes = data.features;
    // Initialize an array to earthquake circle markers
    var quakeMarkers = [];
    console.log(quakes);
    //loop through each reported quake event to create new circle markers

    quakes.forEach(quake => {
        var lat = quake.geometry.coordinates[1];
        var long = quake.geometry.coordinates[0];
        var mag = quake.properties.mag;
        var eventTime = new Date(quake.properties.time);
        var place = quake.properties.place;
        var type = quake.properties.type;
        var depth = quake.geometry.coordinates[2];
        var id = quake.id;
        var circleColor = colorSelect(depth);
        quakeMarkers.push(L.circle([lat, long], {
            color: "white",
            fillColor: circleColor,
            fillOpacity: 0.8,
            radius: mag * 15000
        }).bindPopup(`<h1>ID: ${id} </h1>
          <h1>Type: ${type}</h1>
          <h1>Magnitude: ${mag} <h1>
          <hr>
          <h2>Time: ${eventTime}</h2>
          <h2>Place: ${place}</h2>
          <h2>Depth: ${depth} km</h3>`))

    });
    console.log(quakeMarkers);
    createMap(L.layerGroup(quakeMarkers));

}

function colorSelect(num) {
    var colors = ["LawnGreen", "Blue","Yellow", "Fuchsia", "Orange", "DarkRed"];
    if (num ==="ALL"){
        return colors;
    }
    if (num <=10){
        index=0;
    }
    else if (num<=30){
        index=1;
    }
    else if( num <=50){
        index=2;
    }
    else if( num <=70){
        index=3;
    }
    else if (num <=90){
        index=4;
    }
    else {
        index=5;
    }

    if (num<0){
        negativeMag.push(num);
        console.log(num);
    }
    return colors[index];

}


// Perform an API call to the USGS site to get earthquake information. Call createMarkers when complete
d3.json(sevenDayUrl).then(createMarkers);
