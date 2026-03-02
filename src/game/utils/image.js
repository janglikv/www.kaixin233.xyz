export const loadImageElement = (url) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = (event) => reject(new Error(`Failed to load image: ${url} ${String(event)}`))
  image.src = url
})

export const buildAlphaMaskFromImage = (image, frame) => {
  const width = Math.floor(frame.width)
  const height = Math.floor(frame.height)
  if (width <= 0 || height <= 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  context.clearRect(0, 0, width, height)
  context.drawImage(
    image,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    0,
    0,
    width,
    height,
  )

  const pixels = context.getImageData(0, 0, width, height).data
  const alpha = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i += 1) {
    alpha[i] = pixels[i * 4 + 3]
  }

  return { width, height, alpha }
}
