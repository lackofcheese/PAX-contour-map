// ========================= GLOBAL VARIABLES ================================
var baseURL; // The base URL of the map.
var colorMap; // The color map for drawing.
var map; // The Google Maps map object.
var markers; // The markers currently on the map.
var droppedMarker = null; // The marker that is being dropped.

var centralAngle // The current angular distance for the contour.
var stepAngle; // The angle to step by between contours.
var maxSideAngle; // The angular resolution for drawing.

// Various 3D vector parameters used in calculations.
var positions; // 3D position vectors for the markers.
var midpoints; // Circle center (i.e. inside the Earth) for a given marker.
var coordVecs // Two unit vectors forming co-ordinates on the tangent plane.

var contourPolys = []; // The list of polygons currently displayed.

/** Adds an arc from start->end around marker #index.*/
function addArc(points, index, start, end) {
    var arcAngle = end - start;
    var radius = Math.sin(centralAngle);
    var numSteps = Math.ceil(Math.abs(arcAngle * radius) / maxSideAngle);
    for (var i = 0; i <= numSteps; i++) {
        var angle = (end * i + start * (numSteps-i)) / numSteps;
        points.push(vectorToLatLng(calcPos(index, angle)));
    }
}

/** Calculates a 3D vector for the point given by angle around marker #index. */
function calcPos(index, angle) {
    var center = midpoints[index];
    var v0 = coordVecs[index][0];
    var v1 = coordVecs[index][1];
    var offset = v0.multiply(Math.cos(angle)).add(v1.multiply(Math.sin(angle)));
    return center.add(offset.multiply(Math.sin(centralAngle)));
}

/** Returns whether the given 3D vector position is inside locale #index */
function isInside(pos, index) {
    return (positions[index].dot(pos.subtract(midpoints[index])) >= 0);
}

/** Creates a new marker at the given position with the given title */
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
        droppedMarker = marker;
    });
    google.maps.event.addListener(marker, 'animation_changed', function() {
        if (marker.getAnimation() != null || droppedMarker != marker) {
            return;
        }
        redraw();
        updateURL();
        droppedMarker = null;
    });
    google.maps.event.addListener(marker, 'position_changed', redraw);
    google.maps.event.addListener(marker, 'rightclick', function() {
        markers.splice(markers.indexOf(marker), 1);
        marker.setMap(null);
        redraw();
        updateURL();
    });
    markers.push(marker);
}

/** Updates the URL with the markers currently being displayed */
function updateURL() {
    var newURL = baseURL;
    var first = true;
    for (var i = 0; i < markers.length; i++) {
        if (first) {
            newURL += "?";
            first = false;
        } else {
            newURL += "&";
        }
        newURL += "n" + i + "=" + markers[i].getTitle();
        newURL += "&p" + i + "=" + markers[i].getPosition().toUrlValue();
    }
    window.history.pushState({}, "PAX Contour plot", newURL);
}

/** Starts up the map, and draws the contour plot for the first time. */
function initialize() {
    // Basic initializations.
    colorMap = new ColorMap(COLORS);
    stepAngle = STEP / EARTH_RADIUS;
    maxSideAngle = RESOLUTION / EARTH_RADIUS;
    map = new google.maps.Map(
        document.getElementById("map_canvas"),
        MAP_OPTIONS
    );
    google.maps.event.addListener(map, 'click', function(event) {
        var label = prompt("Enter a name for this marker!","PAX");
        if (label == null) {
            return;
        }
        createMarker(event.latLng, label);
        redraw();
        updateURL();
    });

    // Parse the URL to get starting locations
    var locations;
    var splitURL = window.location.href.split('?');
    var startIndex;
    if (splitURL[0] == "http://htmlpreview.github.com/") {
        baseURL = splitURL[0] + "?" + splitURL[1];
        startIndex = 2;
    } else {
        baseURL = splitURL[0];
        startIndex = 1;
    }
    var query = splitURL.slice(startIndex).join('?');
    locations = (query == '') ? DEFAULT_LOCATIONS : getLocations(query);

    // Create a marker at each location. 
    markers = [];
    for (var i = 0; i < locations.length; i++) {
        createMarker(locations[i][1], locations[i][0]);
    }

    // Draw the map.
    drawContours();
    updateURL();
}

/** Redraws the contours, using the current marker positions. */
function redraw() {
    clearContours();
    drawContours();
}

/** Clears the contours from the screen. */
function clearContours() {
    for (var i = 0; i < contourPolys.length; i++) {
        contourPolys[i].setMap(null);
    }
    contourPolys.length = 0;
}

/** Draws the contours onto the screen, using current marker positions */
function drawContours() {
    if (markers.length == 0) {
        return;
    }
    // Initialize the coordinate variables.
    positions = []; midpoints = []; coordVecs = [];
    // Initialize 2D array variables for calculating intersections.
    var halfAngles = []; // Half of the angle between two markers.
    var tangents = []; // Tangent at the halfway point.
    var normals = []; // Normal vector at the halfway point.
    var binormals = []; // Binormal vector at the halfway point.
    for (var i = 0; i < markers.length; i++) {
        halfAngles[i] = [];
        tangents[i] = [];
        normals[i] = [];
        binormals[i] = [];
        positions[i] = latLngToVector(markers[i].getPosition());
    }

    // Calculate values for the intersections.
    for (var i = 0; i < markers.length; i++) {
        halfAngles[i] = [];
        tangents[i] = [];
        normals[i] = [];
        binormals[i] = [];
        for (var j = 0; j < i; j++) {
            var halfAngle = positions[i].angleFrom(positions[j]) / 2;
            var normal = positions[i].add(positions[j]).toUnitVector();
            var tangent = positions[i].subtract(positions[j]).toUnitVector();
            var binormal = tangent.cross(normal);
            halfAngles[i][j] = halfAngles[j][i] = halfAngle;
            normals[i][j] = normals[j][i] = normal;
            tangents[i][j] = tangents[j][i] = tangent;
            binormals[i][j] = binormals[j][i] = binormal;
        }
    }

    // Calculate local coordinate systems for each tangent plane.
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
    var finished = false; // True once the last contour has been drawn.
    var allContours = [];
    for (var count = 0;; count++) {
        centralAngle = count * stepAngle; // Current angular distance.
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
                    var deltaCosine = (
                        Math.cos(centralAngle) / Math.cos(halfAngles[i][j])
                    );
                    var angularDelta = Math.acos(deltaCosine);
                    var a = normals[i][j].multiply(deltaCosine);
                    var b = binormals[i][j].multiply(Math.sin(angularDelta));
                    for (
                        var pos = a.add(b), k = 0;
                        k < 2;
                        pos = a.subtract(b), k++
                    ) {
                        // Create a new Intersection.
                        var inter = new Intersection(i, j, pos);
                        for (var index = i, m = 0; m < 2; index = j, m++) {
                            // Calculate the local angular coordinate.
                            var x = pos.dot(coordVecs[index][0]);
                            var y = pos.dot(coordVecs[index][1]);
                            inter.setAngle(index, Math.atan2(y, x));
                        }
                        // Store the intersections.
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

        // Change intersectionsByIndex into a list of pairs, ordered by angle.
        for (var i = 0; i < markers.length; i++) {
            var anglePairs = [];
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

        var currentContour = []; // Here comes the drawing!
        // Plot any non-intersecting circles by themselves.
        for (var i = 0; i < markers.length; i++) {
            if (intersectionsByIndex[i].length > 0) {
                continue;
            }
            var currentPath = [];
            addArc(currentPath, i, 0, 2 * Math.PI);
            currentContour.push(currentPath);
        }

        // Plot the intersecting contours now.
        for (var num = 0; num < allIntersections.length; num++) {
            var inter = allIntersections[num];
            // First make sure it's a valid intersection.
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

            // Now plot a path through other intersections.
            var currentPath = [];
            for (var index = inter.i; !inter.isMarked(); ) {
                // Find which intersection should come next.
                var inters = intersectionsByIndex[index];
                var nextIndex, nextAngle;
                for (var delta = -1; delta < 2; delta += 2) {
                    nextIndex = inter.getIndex(index) + delta;
                    if (nextIndex < 0) {
                        nextIndex = inters.length - 1;
                        nextAngle = inters[nextIndex][0] - 2 * Math.PI;
                    } else if (nextIndex == inters.length) {
                        nextIndex = 0;
                        nextAngle = inters[nextIndex][0] + 2 * Math.PI;
                    } else {
                        nextAngle = inters[nextIndex][0];
                    }
                    var halfAngle = (inter.getAngle(index) + nextAngle) / 2;
                    var halfPos = calcPos(index, halfAngle);
                    if (!isInside(halfPos, inter.getOther(index))) {
                        break;
                    }
                }

                // Plot the arc and switch to that intersection.
                addArc(currentPath, index, inter.getAngle(index), nextAngle);
                inter.setMarked(true);
                inter = inters[nextIndex][1];
                index = inter.getOther(index);
            }
            currentContour.push(currentPath);
        }
        allContours.push(currentContour);
    }

    // Now actually display the contours on screen.
    for (i = 0; i < count; i++) {
        contourPolys.push(new google.maps.Polygon({
            paths: allContours[i],
            map: map,
            strokeColor: colorMap.getColor(i * stepAngle / Math.PI),
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillOpacity: 0,
            clickable: false,
        }));
    }
}
