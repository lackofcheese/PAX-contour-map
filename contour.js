var markers;

var stepAngle;
var maxSideAngle;

var positions, halfAngles, tangents, normals, binormals, coordVecs;
var midpoints;
var centralAngle;

var contourPolys;

function addArc(points, index, start, end) {
    var arcAngle = end - start;
    var numSteps = Math.ceil(Math.abs(arcAngle * Math.sin(centralAngle)) / maxSideAngle);
    for (var i = 0; i <= numSteps; i++) {
        var angle = (end * i + start * (numSteps-i)) / numSteps;
        points.push(VectorToLatLng(calcPos(index, angle)));
    }
}

function markPos(pos) {
    var marker = new google.maps.Marker({
        position: VectorToLatLng(pos),
        map: map,
    });
}

function calcPos(index, angle) {
    var center = midpoints[index];
    var v0 = coordVecs[index][0];
    var v1 = coordVecs[index][1];
    var offset = v0.multiply(Math.cos(angle)).add(v1.multiply(Math.sin(angle)));
    return center.add(offset.multiply(Math.sin(centralAngle)));
}

function isInside(pos, index) {
    return (positions[index].dot(pos.subtract(midpoints[index])) >= 0);
}

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

function createMarker(position, title) {
    var index = markers.length;
    var marker = new google.maps.Marker({
        position: position,
        map: map,
        title: title,
        draggable: true
    });
    google.maps.event.addListener(marker, 'dragstart', function() {
        stepAngle = Math.PI / 20;
        maxSideAngle = Math.PI / 20;
    });
    google.maps.event.addListener(marker, 'dragend', function() {
        stepAngle = STEP / EARTH_RADIUS;
        maxSideAngle = RESOLUTION / EARTH_RADIUS;
        redraw();
    });
    google.maps.event.addListener(marker, 'position_changed', redraw);
    google.maps.event.addListener(marker, 'rightclick', function() {
        markers.splice(markers.indexOf(marker), 1);
        marker.setMap(null);
        redraw();
    });
    markers.push(marker);
}


function initialize() {
    colorMap = new ColorMap(COLORS);
    stepAngle = STEP / EARTH_RADIUS;
    maxSideAngle = RESOLUTION / EARTH_RADIUS;
    // The actual Google Maps map object.
    map = new google.maps.Map(
        document.getElementById("map_canvas"),
        MAP_OPTIONS
    );
    markers = [];
    for (var i = 0; i < LOCATIONS.length; i++) {
        createMarker(LOCATIONS[i][1], LOCATIONS[i][0]);
    }
    google.maps.event.addListener(map, 'click', function(event) {
        var label = prompt("Enter a name for this PAX!","PAX");
        if (label == null) {
            return;
        }
        createMarker(event.latLng, label);
        clearContours();
        drawContours();
    });
    contourPolys = [];
    drawContours();
}

function redraw() {
    clearContours();
    drawContours();
}

function clearContours() {
    for (var i = 0; i < contourPolys.length; i++) {
        contourPolys[i].setMap(null);
    }
    contourPolys.length = 0;
}

function drawContours() {
    // Extra coordinate variables.
    positions = [];
    halfAngles = [];
    tangents = [];
    normals = [];
    binormals = [];
    coordVecs = [];
    if (markers.length == 0) {
        return;
    }
    for (var i = 0; i < markers.length; i++) {
        positions[i] = LatLngToVector(markers[i].getPosition());
    }
    for (var i = 0; i < markers.length; i++) {
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
    if (markers.length == 1) {
        coordVecs[0] = findPerpendicularVectors(positions[0]);
    } else {
        for (var i = 0; i < markers.length; i++) {
            var v1 = binormals[i][(i+1)%markers.length];
            var v2 = positions[i].cross(v1);
            coordVecs[i] = [v1, v2];
        }
    }

    // Start drawing the contours.
    var finished = false;
    var allContours = [];
    for (var count = 0;; count++) {
        centralAngle = count * stepAngle; // distance for the current contour.
        if (centralAngle > Math.PI) {
            finished = true;
            break;
        }

        // Find the intersections between the individual circles.
        var intersectionsByIndex = [];
        var allIntersections = [];
        midpoints = [];
        for (var i = 0; i < markers.length; i++) {
            intersectionsByIndex[i] = [];
            midpoints[i] = positions[i].multiply(Math.cos(centralAngle));
        }
        for (var i = 0; i < markers.length; i++) {
            for (var j = 0; j < i; j++) {
                if (centralAngle <= halfAngles[i][j]) {
                    continue;
                } else if (centralAngle >= Math.PI - halfAngles[i][j]) {
                    finished = true;
                    break;
                } else {
                    var angularDelta = Math.acos(Math.cos(centralAngle) / Math.cos(halfAngles[i][j]));
                    var a = normals[i][j].multiply(Math.cos(angularDelta));
                    var b = binormals[i][j].multiply(Math.sin(angularDelta));
                    for (var pos = a.add(b), k = 0; k < 2; pos = a.subtract(b), k++) {
                        var inter = new Intersection(i, j, pos);
                        for (var index = i, m = 0; m < 2; index = j, m++) {
                            var x = pos.dot(coordVecs[index][0]);
                            var y = pos.dot(coordVecs[index][1]);
                            inter.setAngle(index, Math.atan2(y, x));
                        }
                        allIntersections.push(inter);
                        intersectionsByIndex[i].push(inter);
                        intersectionsByIndex[j].push(inter);
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
        for (var i = 0; i < markers.length; i++) {
            anglePairs = [];
            for (var j = 0; j < intersectionsByIndex[i].length; j++) {
                var inter = intersectionsByIndex[i][j];
                anglePairs.push([inter.getAngle(i), inter]);
            }
            anglePairs.sort(function(a,b) {
                return a[0] - b[0];
            });
            intersectionsByIndex[i] = anglePairs;
            for (var j = 0; j < anglePairs.length; j++) {
                anglePairs[j][1].setIndex(i, j);
            }
        }

        var currentContour = [];
        for (var i = 0; i < markers.length; i++) {
            if (intersectionsByIndex[i].length > 0) {
                continue;
            }
            var currentPath = [];
            addArc(currentPath, i, 0, 2 * Math.PI);
            currentContour.push(currentPath);
        }
        for (var num = 0; num < allIntersections.length; num++) {
            var inter = allIntersections[num];
            var inside = false;
            for (var index = 0; index < markers.length; index++) {
                if (index == inter.i || index == inter.j) {
                    continue;
                }
                if (isInside(inter.position, index)) {
                    inter.setMarked(true);
                    break;
                }
            }
            if (inter.isMarked()) {
                continue;
            }
            var currentPath = [];
            var index = inter.i;
            var otherIndex = inter.j;
            var localIndex = inter.ii;
            var angle = inter.ai;
            var prevDelta = 0;
            while (!inter.isMarked()) {
                var inters = intersectionsByIndex[index];
                var nextIndex;
                var nextAngle;
                for (var delta = -1; delta < 2; delta += 2) {
                    nextIndex = localIndex + delta;
                    if (nextIndex < 0) {
                        nextIndex = inters.length - 1;
                        nextAngle = inters[nextIndex][0] - 2 * Math.PI;
                    } else if (nextIndex == intersectionsByIndex[index].length) {
                        nextIndex = 0;
                        nextAngle = inters[nextIndex][0] + 2 * Math.PI;
                    } else {
                        nextAngle = inters[nextIndex][0];
                    }
                    var pos = calcPos(index, (angle + nextAngle) / 2);
                    if (!isInside(pos, otherIndex)) {
                        break;
                    }
                }
                addArc(currentPath, index, angle, nextAngle);
                inter.setMarked(true);
                inter = inters[nextIndex][1];
                otherIndex = index;
                index = inter.getOther(index);
                localIndex = inter.getIndex(index);
                angle = inter.getAngle(index);
            }
            currentContour.push(currentPath);
        }
        allContours.push(currentContour);
    }
    for (i = 0; i < count; i++) {
        contourPolys.push(new google.maps.Polygon({
            paths: allContours[i],
            map: map,
            strokeColor: colorMap.getColor(i / (count - 1)),
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillOpacity: 0,
            clickable: false,
        }));
    }
}
