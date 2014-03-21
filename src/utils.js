var renderToCanvas = function (width, height, renderFunction) {
    var buffer = document.createElement('canvas');
        buffer.width = width;
        buffer.height = height;
        renderFunction(buffer.getContext('2d'));

    return buffer;
};
