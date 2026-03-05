import * as PIXI from 'pixi.js'

// 星空背景系统：负责生成星点、布局与匀速滚动
export const createStarfieldSystem = (app, worldLayer, viewport) => {
  const getViewportWidth = () => viewport?.width ?? app.renderer.width
  const getViewportHeight = () => viewport?.height ?? app.renderer.height

  // 统一维护所有星点粒子
  const particles = []

  const container = new PIXI.Container()
  container.zIndex = -100
  worldLayer.addChild(container)

  // 渐变底板（用于压暗背景，让星点更清晰）
  const glow = new PIXI.Graphics()
  container.addChild(glow)

  // 生成星点纹理，避免每个星点都用 Graphics 实时绘制
  const createStarTexture = (radius, color, alpha) => {
    const shape = new PIXI.Graphics()
    shape.circle(radius, radius, radius).fill({ color, alpha })
    const texture = app.renderer.generateTexture(shape)
    shape.destroy()
    return texture
  }

  // 三层星点纹理（远/中/近）
  const farStarTexture = createStarTexture(1, 0x9fb2c7, 0.7)
  const midStarTexture = createStarTexture(1.4, 0xc9def7, 0.82)
  const nearStarTexture = createStarTexture(2, 0xf2f7ff, 0.95)

  // 添加某一层星点
  const addLayer = (count, texture, speed, twinkle = false) => {
    for (let i = 0; i < count; i += 1) {
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.x = Math.random() * getViewportWidth()
      sprite.y = Math.random() * getViewportHeight()
      sprite.alpha = 0.4 + Math.random() * 0.6
      container.addChild(sprite)

      particles.push({
        sprite,
        speed,
        twinkle,
        phase: Math.random() * Math.PI * 2,
        baseAlpha: sprite.alpha,
      })
    }
  }

  // 用户要求：大小星星速度保持一致
  const uniformSpeed = 48
  addLayer(90, farStarTexture, uniformSpeed, false)
  addLayer(56, midStarTexture, uniformSpeed, true)
  addLayer(28, nearStarTexture, uniformSpeed, true)

  // 分辨率变化时重绘背景并修正越界星点
  const layout = () => {
    const width = getViewportWidth()
    const height = getViewportHeight()

    glow.clear()
    glow.rect(0, 0, width, height).fill({ color: 0x0b1521, alpha: 1 })

    for (const particle of particles) {
      if (particle.sprite.x > width) particle.sprite.x = Math.random() * width
      if (particle.sprite.y > height) particle.sprite.y = Math.random() * height
    }
  }

  // 每帧更新：纵向卷轴滚动 + 闪烁
  const update = (deltaSeconds) => {
    const width = getViewportWidth()
    const height = getViewportHeight()

    for (const particle of particles) {
      const star = particle.sprite
      star.y += particle.speed * deltaSeconds
      if (particle.twinkle) {
        particle.phase += deltaSeconds * 2.8
        star.alpha = Math.max(0.2, Math.min(1, particle.baseAlpha + Math.sin(particle.phase) * 0.22))
      }
      if (star.y > height + 6) {
        star.y = -6
        star.x = Math.random() * width
      }
    }
  }

  return { layout, update }
}
