class utils {
  renderToCanvas(width, height, renderFunction) {
    const buffer = document.createElement('canvas')
    buffer.width = width
    buffer.height = height
    renderFunction(buffer.getContext('2d'))

    return buffer
  }

  mapPoint(lat, lng, scale = 500) {
    const phi = ((90 - lat) * Math.PI) / 180
    const theta = ((180 - lng) * Math.PI) / 180
    const x = scale * Math.sin(phi) * Math.cos(theta)
    const y = scale * Math.cos(phi)
    const z = scale * Math.sin(phi) * Math.sin(theta)
    return { x, y, z }
  }

  /* from http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb */
  hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
    hex = hex.replace(shorthandRegex, function (m, r, g, b) {
      return r + r + g + g + b + b
    })

    const test = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    const result = test
      ? {
          r: parseInt(test[1], 16),
          g: parseInt(test[2], 16),
          b: parseInt(test[3], 16)
        }
      : null

    return result
  }

  createLabel(text, size, color, font, underlineColor) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    context.font = size + 'pt ' + font
    canvas.width = context.measureText(text).width
    canvas.height = size + 10

    // better if canvases have even heights
    if (canvas.width % 2) canvas.width++
    if (canvas.height % 2) canvas.height++
    if (underlineColor) canvas.height += 30

    context.font = size + 'pt ' + font
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.strokeStyle = 'black'
    context.miterLimit = 2
    context.lineJoin = 'circle'
    context.lineWidth = 6
    context.lineWidth = 2
    context.fillStyle = color

    context.strokeText(text, canvas.width / 2, canvas.height / 2)
    context.fillText(text, canvas.width / 2, canvas.height / 2)

    if (underlineColor) {
      context.strokeStyle = underlineColor
      context.lineWidth = 4
      context.beginPath()
      context.moveTo(0, canvas.height - 10)
      context.lineTo(canvas.width - 1, canvas.height - 10)
      context.stroke()
    }

    return canvas
  }
}

module.exports = new utils()
