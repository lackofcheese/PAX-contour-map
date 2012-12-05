function Intersection(i, j, position) {
    this.i = i;
    this.j = j;
    this.position = position;
    this.marked = false;
}

Intersection.prototype.getOther = function(index) {
    if (index == this.i) {
        return this.j;
    } else {
        return this.i;
    }
}

Intersection.prototype.setAngle = function(index, angle) {
    if (index == this.i) {
        this.ai = angle;
    } else {
        this.aj = angle;
    }
}

Intersection.prototype.getAngle = function(index) {
    if (index == this.i) {
        return this.ai;
    } else {
        return this.aj;
    }
}

Intersection.prototype.setIndex = function(index, localIndex) {
    if (index == this.i) {
        this.ii = localIndex;
    } else {
        this.jj = localIndex;
    }
}

Intersection.prototype.getIndex = function(index) {
    if (index == this.i) {
        return this.ii;
    } else {
        return this.jj;
    }
}

Intersection.prototype.setMarked = function(value) {
    this.marked = value;
}

Intersection.prototype.isMarked = function() {
    return this.marked;
}
    
