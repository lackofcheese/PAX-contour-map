function ArcSet() {
    this.arcs = [];
    this.full = false;
}

ArcSet.prototype.addArc = function(start, prevArc, end, nextArc) {
    this.arcs[this.arcs.length] = [start, prevArc, end, nextArc];
    this.arcs.sort();
};

ArcSet.prototype.getIndex = function(angle) {
    if (this.arcs.length == 0) {
        return 0;
    }

    if (angle >= this.arcs[0][0] + 2*Math.PI) {
        return 1;
    }
    for (var i = 0; i < this.arcs.length; i++) {
        if (angle <= this.arcs[i][0]) {
            return i * 2;
        } else if (angle <= this.arcs[i][2]) {
            return i * 2 + 1;
        }
    }
    return 0;
};

ArcSet.prototype.getInverse = function() {
    var inverse = new ArcSet();
    if (this.full) {
        return inverse;
    } else if (this.arcs.length == 0) {
        inverse.arcs = [[0, null, 2*Math.PI, null]];
        inverse.full = true;
        return inverse;
    }
    var firstIndex = 0;
    var lastIndex = this.arcs.length - 2;
    if (this.arcs[0][0] > 0) {
        firstIndex -= 1;
    } else {
        lastIndex += 1
    }

    for (var i = firstIndex; i <= lastIndex; i++) {
        var i0 = (i + this.arcs.length) % (this.arcs.length);
        var i1 = (i + 1 + this.arcs.length) % (this.arcs.length);
        var start = this.arcs[i0][2];
        var prevArc = this.arcs[i0][3];
        var end = this.arcs[i1][0];
        var nextArc = this.arcs[i1][1];
        if (i1 == 0 && start > end) {
            if (end < 0) {
                end += 2 * Math.PI;
            } else {
                start -= 2 * Math.PI;
            }
        }
        inverse.arcs[inverse.arcs.length] = [start, prevArc, end, nextArc];
    }
    return inverse;
};

ArcSet.prototype.combine = function(start, prevArc, end, nextArc) {
    var start = normalizeAngle(start);
    var end = normalizeAngle(end);
    var startIndex = this.getIndex(start);
    var endIndex = this.getIndex(end);
    var startRem = startIndex % 2;
    var endRem = endIndex % 2;
    var joinStart = (startIndex-startRem)/2;
    var joinEnd = (endIndex-endRem)/2;
    if (endRem == 0) {
        joinEnd -= 1;
        if (joinEnd < 0) {joinEnd += this.arcs.length;}
    }
    if (startIndex == endIndex) {
        var zero;
        if (this.arcs.length == 0) {
            zero = 0;
        } else if (startRem == 1) {
            zero = this.arcs[joinStart][0];
        } else {
            zero = this.arcs[joinEnd][0];
        }
        if (start > end) {start -= 2 * Math.PI;}
        a1 = normalizeAngle(start - zero);
        a2 = normalizeAngle(end - zero);

        if (startRem == 1) {
            if (a1 > a2) {
                this.arcs = [[0, null, 2*Math.PI, null]];
                this.full = true;
            } 
        } else {
            if (a1 > a2) {
                this.arcs = [];
            }
            this.addArc(start, prevArc, end, nextArc);
        }
        return;
    }

    if (startRem == 1) {
        start = this.arcs[joinStart][0];
        prevArc = this.arcs[joinStart][1];
    }
    if (endRem == 1) {
        end = this.arcs[joinEnd][2];
        nextArc = this.arcs[joinEnd][3];
    }

    if (start > end) {
        start -= 2 * Math.PI;
    }

    if (joinStart > joinEnd) {
        this.arcs.splice(joinStart, this.arcs.length-joinStart);
        joinStart = 0;
    }
    this.arcs.splice(
        joinStart,
        joinEnd-joinStart+1,
        [start,prevArc,end,nextArc]
    );
};

ArcSet.prototype.toString = function() {
    if (this.full) {
        return "FULL"
    }
    var str = '[';
        for (var i = 0; i < this.arcs.length; i++) {
            str += '[' + this.arcs[i] + '];';
        }
        str += ']';
        return str;
};
