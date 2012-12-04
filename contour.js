// Map locations.
var locations = [
    ["PAX East", new google.maps.LatLng(42.345715,-71.046047)],
    ["PAX Prime", new google.maps.LatLng(47.611716,-122.332823)],
    ["PAX Australia", new google.maps.LatLng(-37.781493,144.912618)],
];

var distances = []

// Contour map settings.
var earthRadius = 6371009; // Earth's radius (m)
var maxSideDistance = 10 * 1000; // Maximum side length (m).
var maxSideAngle = maxSideDistance / earthRadius; // Max. side angle.
var minPoints = 20; // Minimum number of points per polygon.
var step = 500 * 1000; // Max distance between contours (m).
var stepAngle = step / earthRadius; // Step distance (central angle)
var numSteps = Math.floor(Math.PI / stepAngle);

// Color functionality.
function interpolateColors(color1, color2, a) {
    return [
        Math.floor(a * color2[0] + (1-a) * color1[0]),
        Math.floor(a * color2[1] + (1-a) * color1[1]),
        Math.floor(a * color2[2] + (1-a) * color1[2]),
    ];
}

function colorToString(color) {
    return "rgb(" + color[0] + ", " + color[1] + ", " + color[2] + ")";
}

function ColorMap(colors) {
    this.colors = colors;
    this.multiplier = colors.length - 1;
}

ColorMap.prototype.getColor = function(value) {
    var index = this.multiplier * value;
    var i = Math.floor(index);
    if (i > this.colors.length - 2) {
        i = this.colors.length - 2
    }
    var a = index - i;
    if (a < 0) {
        a = 0;
    } else if (a > 1) {
        a = 1;
    }
    return colorToString(
        interpolateColors(this.colors[i], this.colors[i+1], a));
};

var defaultColorMap = new ColorMap([
    [0,0,255],
    [0,255,255],
    [255,255,0],
    [255,127,0],
    [255,0,0],
]);


function initialize() {
    var mapOptions = {
        center: locations[0][1],
        zoom: 3,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    var map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);
    for (var i = 0; i < locations.length; i++) {
        var marker = new google.maps.Marker({
            position: locations[i][1],
            map: map,
            title: locations[i][0]
        });
    }

    var center = mapOptions.center;
    var elevation = Math.PI * center.lat() / 180;
    var azimuth = Math.PI * center.lng() / 180;
    var temp = Math.cos(elevation);
    var centerVector = $V([
        temp * Math.cos(azimuth),
        temp * Math.sin(azimuth),
        Math.sin(elevation),
    ]);

    for (var i = 1; i <= numSteps; i++) {
        var centralAngle = i * stepAngle; // distance for the current contour.
        var vector = centerVector;
        if (centralAngle > Math.PI / 2) {
            centralAngle = Math.PI - centralAngle;
            vector = centerVector.multiply(-1);
        }
        var v1, v2;
        if (vector.e(1) == 0 && vector.e(2) == 0) {
            v1 = $V([1, 0, 0]);
            v2 = $V([0, 1, 0]);
        } else {
            v1 = $V([-vector.e(2), vector.e(1), 0]);
            v1 = v1.multiply(1 / v1.modulus());
            v2 = vector.cross(v1);
        }
        vector = vector.multiply(Math.cos(centralAngle));

        var circumferenceAngle = 2 * Math.PI * Math.sin(centralAngle);
        var numPoints = Math.ceil(circumferenceAngle / maxSideAngle);
        if (numPoints < minPoints) {
            numPoints = minPoints;
        }

        var path = new Array();
        for (var j = 0; j < numPoints; j++) {
            var angle = 2 * Math.PI * j / numPoints;
            var offset = v1.multiply(Math.sin(angle)).add(v2.multiply(Math.cos(angle)));
            var newVector = vector.add(offset.multiply(Math.sin(centralAngle)));
            var elevation = Math.asin(newVector.e(3));
            var azimuth = Math.atan2(newVector.e(2), newVector.e(1));
            path[j] = new google.maps.LatLng(
                elevation * 180 / Math.PI,
                azimuth * 180 / Math.PI
            );
        }
        path[numPoints] = path[0];
        var contour = new google.maps.Polygon({
            paths: path,
            map: map,
            strokeColor: defaultColorMap.getColor((i-1)/(numSteps-1)),
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#FF0000",
            fillOpacity: 0
        });
    }
}
