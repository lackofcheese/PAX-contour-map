//============================= URL PARSING ==================================
/** Decode part of a URL */
function decode(s) {
    s = s.replace(/\+/g, " ");
    return decodeURIComponent(s);
}

/** Retrive the locations from an encoded URL query string */
function getLocations(query) {
    var keyValueRegex = /([^&=]+)=?([^&]*)/g; // Query format.
    var nameOrPosKeyRegex = /[np]([0-9]+)/;
    var latLngRegex = /([-+]?[0-9]*\.?[0-9]+),([-+]?[0-9]*\.?[0-9]+)/ ;
    var locs = {}, match; // Temporary results storage.
    while (match = keyValueRegex.exec(query)) {
        var key = decode(match[1]);
        var value = decode(match[2]);
        var m2 = nameOrPosKeyRegex.exec(key);
        if (m2 == null) {
            continue;
        }
        var num = m2[1];
        if (!(num in locs)) {
            locs[num] = [null, null];
        }
        if (key[0] == 'n') {
            locs[num][0] = value;
        } else {
            var m3 = latLngRegex.exec(value);
            if (m3 == null) {
                continue;
            }
            locs[num][1] = new google.maps.LatLng(
                parseFloat(m3[1]),
                parseFloat(m3[2])
            );
        }
    }
    var locations = [];
    for (num in locs) {
        var name = locs[num][0];
        var pos = locs[num][1];
        if (name != null && pos != null) {
            locations.push([name, pos]);
        }
    }
    return locations;
}

//========================= COORDINATE MANIPULATION =========================
/** Create a new google maps marker at the given 3D vector position. */
function markPos(pos) {
    return new google.maps.Marker({
        position: vectorToLatLng(pos),
        map: map,
    });
}

/** Returns two other 3D vectors perpendicular to the given vector. */
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

/** Converts the given Vector to a google.maps.LatLng. */
function vectorToLatLng(myVector) {
    var elevation = Math.asin(myVector.e(3));
    var azimuth = Math.atan2(myVector.e(2), myVector.e(1));
    return new google.maps.LatLng(
        elevation * 180 / Math.PI,
        azimuth * 180 / Math.PI
    ); 
}

/** Converts the given google.maps.LatLng to a Vector. */
function latLngToVector(myLatLng) {
    var elevation = Math.PI * myLatLng.lat() / 180;
    var azimuth = Math.PI * myLatLng.lng() / 180;
    var temp = Math.cos(elevation);
    return $V([
        temp * Math.cos(azimuth),
        temp * Math.sin(azimuth),
        Math.sin(elevation),
    ]);
}
//========================= COLOR MANIPULATION ===============================
/** Returns the color that is a proportion of a from color 1 to color 2; e.g.
* 0.5 is halfway between, 0.75 is a ratio of 3:1 of color2:color1
*/
function interpolateColors(color1, color2, a) {
    return [
        Math.floor(a * color2[0] + (1-a) * color1[0]),
        Math.floor(a * color2[1] + (1-a) * color1[1]),
        Math.floor(a * color2[2] + (1-a) * color1[2]),
    ];
}

/** Returns a string representing the color, from given 3-element RGB array */
function colorToString(color) {
    return "rgb(" + color[0] + ", " + color[1] + ", " + color[2] + ")";
}

//========================= COLOR MAP PROTOTYPE ==============================
/** Makes a color map from an array of colors (as 3-element RGB arrays) */
function ColorMap(colors) {
    this.colors = colors;
    this.multiplier = colors.length - 1;
}

/** Returns the color associated with the given value (must be between 0
* and 1)
*/
ColorMap.prototype.getColor = function(value) {
    var index = this.multiplier * value;
    var i = Math.min(this.colors.length-2, Math.floor(index));
    var a = Math.min(1, Math.max(0, index - i));
    return colorToString(
        interpolateColors(this.colors[i], this.colors[i+1], a));
};
