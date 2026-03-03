// 加载图片为 HTMLImageElement，方便后续读取像素数据
export const loadImageElement = (url) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = (event) => reject(new Error(`Failed to load image: ${url} ${String(event)}`))
  image.src = url
})

// 从一张大图中按 frame 切区域，构建 alpha 掩码
// 返回结构：{ width, height, alpha: Uint8Array }
export const buildAlphaMaskFromImage = (image, frame) => {
  const width = Math.floor(frame.width)
  const height = Math.floor(frame.height)
  if (width <= 0 || height <= 0) return null

  // 通过离屏 canvas 提取指定区域像素
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

  // 只保留 alpha 通道，降低碰撞计算内存占用
  const pixels = context.getImageData(0, 0, width, height).data
  const alpha = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i += 1) {
    alpha[i] = pixels[i * 4 + 3]
  }

  return { width, height, alpha }
}
