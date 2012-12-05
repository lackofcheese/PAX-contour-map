// Coordinate manipulations
function findPerpendicularVectors(vector) {
    var v1, v2;
    if (vector.e(1) == 0 && vector.e(2) == 0) {
        v1 = $V([1, 0, 0]);
        v2 = $V([0, 1, 0]);
    } else {
        v1 = $V([-vector.e(2), vector.e(1), 0]);
        v1 = v1.toUnitVector();
        v2 = vector.cross(v1);
    }
    return [v1, v2];
}

function VectorToLatLng(myVector) {
    var elevation = Math.asin(myVector.e(3));
    var azimuth = Math.atan2(myVector.e(2), myVector.e(1));
    return new google.maps.LatLng(
        elevation * 180 / Math.PI,
        azimuth * 180 / Math.PI
    ); 
}

function LatLngToVector(myLatLng) {
    var elevation = Math.PI * myLatLng.lat() / 180;
    var azimuth = Math.PI * myLatLng.lng() / 180;
    var temp = Math.cos(elevation);
    return $V([
        temp * Math.cos(azimuth),
        temp * Math.sin(azimuth),
        Math.sin(elevation),
    ]);
}

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
    var i = Math.min(this.colors.length-2, Math.floor(index));
    var a = Math.min(1, Math.max(0, index - i));
    return colorToString(
        interpolateColors(this.colors[i], this.colors[i+1], a));
};

function normalizeAngle(angle) {
    return angle - 2*Math.PI*Math.floor(angle/(2*Math.PI));
}


// Global variables.
var colorMap; // The color map for drawing.
var map; // The map object.

function initialize() {
    colorMap = new ColorMap(COLORS);
    // The actual Google Maps map object.
    map = new google.maps.Map(
        document.getElementById("map_canvas"),
        MAP_OPTIONS
    );
    for (var i = 0; i < LOCATIONS.length; i++) {
        var marker = new google.maps.Marker({
            position: LOCATIONS[i][1],
            map: map,
            title: LOCATIONS[i][0]
        });
    }
    drawContours();
}

function drawContours() {
    // Extra coordinate variables.
    var positions = [];
    var halfAngles = [];
    var tangents = [];
    var normals = [];
    var binormals = [];
    var coordVecs = [];
    for (var i = 0; i < LOCATIONS.length; i++) {
        positions[i] = LatLngToVector(LOCATIONS[i][1]);
    }
    for (var i = 0; i < LOCATIONS.length; i++) {
        halfAngles[i] = [];
        tangents[i] = [];
        normals[i] = [];
        binormals[i] = [];
        for (var j = 0; j < i; j++) {
            halfAngles[i][j] = halfAngles[j][i] = positions[i].angleFrom(positions[j]) / 2;
            var normal = positions[i].add(positions[j]).toUnitVector();
            var tangent = positions[i].subtract(positions[j]).toUnitVector();
            var binormal = tangent.cross(normal);
            normals[i][j] = normals[j][i] = normal;
            tangents[i][j] = tangents[j][i] = tangent;
            binormals[i][j] = binormals[j][i] = binormal;
        }
    }
    if (LOCATIONS.length == 1) {
        coordVecs[0] = findPerpendicularVectors(positions[0]);
    } else {
        for (var i = 0; i < LOCATIONS.length; i++) {
            var v1 = binormals[i][(i+1)%LOCATIONS.length];
            var v2 = positions[i].cross(v1);
            coordVecs[i] = [v1, v2];
        }
    }

    // Start drawing the contours.
    var finished = false;
    var allPaths = [];
    for (var step = 0; step < NUM_CONTOURS; step++) {
        allPaths[step] = [];
        var centralAngle = (step + 1) * STEP_ANGLE; // distance for the current contour.

        // Find the intersections between the individual circles.
        var intersections = [];
        var intersectionAngles = [];
        for (var i = 0; i < positions.length; i++) {
            intersections[i] = [];
            intersectionAngles[i] = [];
        }
        for (var i = 0; i < positions.length; i++) {
            intersections[i][i] = null;
            for (var j = 0; j < i; j++) {
                if (centralAngle <= halfAngles[i][j]) {
                    intersections[i][j] = intersections[j][i] = null;
                } else if (centralAngle >= Math.PI - halfAngles[i][j]) {
                    intersections[i][j] = intersections[j][i] = null;
                    finished = true;
                    break;
                } else {
                    var angularDelta = Math.acos(Math.cos(centralAngle) / Math.cos(halfAngles[i][j]));
                    var a = normals[i][j].multiply(Math.cos(angularDelta));
                    var b = binormals[i][j].multiply(Math.sin(angularDelta));
                    var vecs = [a.add(b), a.subtract(b)];
                    intersections[i][j] = intersections[j][i] = vecs;
                    intersectionAngles[i][j] = [];
                    intersectionAngles[j][i] = [];
                    var i0 = i;
                    var j0 = j;
                    for (var k = 0; k < 2; k++) {
                        for (var m = 0; m < 2; m++) {
                            var x = vecs[m].dot(coordVecs[i0][0]);
                            var y = vecs[m].dot(coordVecs[i0][1]);
                            intersectionAngles[i0][j0][m] = Math.atan2(y, x);
                        }
                        i0 = j;
                        j0 = i;
                    }
                }
            }
            if (finished) {
                break;
            }
        }
        if (finished) {
            break;
        }

        var mappings = {}
        for (var i = 0; i < positions.length; i++) {
            var arcSet = new ArcSet(); 
            for (var j = 0; j < positions.length; j++) {
                if (intersections[i][j] == null) {
                    continue;
                }
                var angles = intersectionAngles[i][j];
                var a = 0; 
                var b = 1;
                if (angles[a] > angles[b]) {
                    a = 1-a;
                    b = 1-b;
                }
                if ((angles[b] - angles[a]) > Math.PI) {
                    a = 1-a;
                    b = 1-b;
                }
                arcSet.combine(angles[a], j, angles[b], j);
            }
            if (centralAngle < Math.PI / 2) {
                arcSet = arcSet.getInverse();
            }
            for (var arcNo = 0; arcNo < arcSet.arcs.length; arcNo++) {
                var arc = arcSet.arcs[arcNo];
                start = arc[0];
                prevArc = arc[1];
                end = arc[2];
                nextArc = arc[3]
                mappings[[i, prevArc]] = [start, end, nextArc]; 
            }
        }
        
        var keys = Object.keys(mappings);
        for (var pathNo = 0; keys.length > 0; pathNo++, keys = Object.keys(mappings)) {
            allPaths[step][pathNo] = [];
            var key = keys[0];
            var nextNum = eval('[' + key + ']')[0];
            for (var pathPos = 0; nextNum != null && key in mappings;) {
                var currentNum = nextNum;
                var pathParams = mappings[key];
                var start = pathParams[0];
                var end = pathParams[1];
                nextNum = pathParams[2];
                delete mappings[key];
                var key = [nextNum, currentNum];

                var centerVector = positions[currentNum].multiply(Math.cos(centralAngle));
                var v0 = coordVecs[currentNum][0];
                var v1 = coordVecs[currentNum][1];
                var arcAngle = end - start;
                if (arcAngle < 0) {
                    arcAngle += 2 * Math.PI;
                }
                var numSteps = Math.ceil(arcAngle * Math.sin(centralAngle) / MAX_SIDE_ANGLE);
                for (var i = 0; i <= numSteps; i++) {
                    var angle = (end * i + start * (numSteps-i)) / numSteps;
                    var offset = v0.multiply(Math.cos(angle)).add(v1.multiply(Math.sin(angle)));
                    allPaths[step][pathNo][pathPos] = VectorToLatLng(centerVector.add(offset.multiply(Math.sin(centralAngle))));
                    pathPos++;
                }
            }
        }
    }
    for (i = 0; i < step; i++) {
        var contour = new google.maps.Polygon({
            paths: allPaths[i],
            map: map,
            strokeColor: colorMap.getColor(i / (step - 1)),
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillOpacity: 0
        });
    }
}
