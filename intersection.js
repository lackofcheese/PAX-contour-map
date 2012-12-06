/** Remembers a new intersection between circles #i and #j,
 * at the given position. 
 */
function Intersection(i, j, position) {
    this.i = i;
    this.j = j;
    this.position = position;
    this.marked = false;
}

/** Retrieves the other circle index for this intersection. */
Intersection.prototype.getOther = function(index) {
    if (index == this.i) {
        return this.j;
    } else {
        return this.i;
    }
}

/** Sets the local angle for the given index. */
Intersection.prototype.setAngle = function(index, angle) {
    if (index == this.i) {
        this.ai = angle;
    } else {
        this.aj = angle;
    }
}

/** Gets the local angle for the given index. */
Intersection.prototype.getAngle = function(index) {
    if (index == this.i) {
        return this.ai;
    } else {
        return this.aj;
    }
}

/** Sets the local index for the given index. */
Intersection.prototype.setIndex = function(index, localIndex) {
    if (index == this.i) {
        this.ii = localIndex;
    } else {
        this.jj = localIndex;
    }
}

/** Gets the local index for the given index. */
Intersection.prototype.getIndex = function(index) {
    if (index == this.i) {
        return this.ii;
    } else {
        return this.jj;
    }
}

/** Sets the marked status of this intersection. */
Intersection.prototype.setMarked = function(value) {
    this.marked = value;
}

/** Returns true if this intersection is marked, and false
 * otherwise.
 */
Intersection.prototype.isMarked = function() {
    return this.marked;
}
    
