var renderToCanvas = function (width, height, renderFunction) {
    var buffer = document.createElement('canvas');
        buffer.width = width;
        buffer.height = height;
        renderFunction(buffer.getContext('2d'));

    return buffer;
};

var mapPoint = function(lat, lng, scale) {
    if(!scale){
        scale = 500;
    }
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (180 - lng) * Math.PI / 180;
    var x = scale * Math.sin(phi) * Math.cos(theta);
    var y = scale * Math.cos(phi);
    var z = scale * Math.sin(phi) * Math.sin(theta);
    return {x: x, y: y, z:z};
}

/* from http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb */

function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

