import * as PIXI from 'pixi.js'

export const createStarfieldSystem = (app, worldLayer) => {
  const particles = []

  const container = new PIXI.Container()
  container.zIndex = -100
  worldLayer.addChild(container)

  const glow = new PIXI.Graphics()
  container.addChild(glow)

  const createStarTexture = (radius, color, alpha) => {
    const shape = new PIXI.Graphics()
    shape.circle(radius, radius, radius).fill({ color, alpha })
    const texture = app.renderer.generateTexture(shape)
    shape.destroy()
    return texture
  }

  const farStarTexture = createStarTexture(1, 0x9fb2c7, 0.7)
  const midStarTexture = createStarTexture(1.4, 0xc9def7, 0.82)
  const nearStarTexture = createStarTexture(2, 0xf2f7ff, 0.95)

  const addLayer = (count, texture, speed, twinkle = false) => {
    for (let i = 0; i < count; i += 1) {
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.x = Math.random() * app.renderer.width
      sprite.y = Math.random() * app.renderer.height
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

  const uniformSpeed = 48
  addLayer(90, farStarTexture, uniformSpeed, false)
  addLayer(56, midStarTexture, uniformSpeed, true)
  addLayer(28, nearStarTexture, uniformSpeed, true)

  const layout = () => {
    const width = app.renderer.width
    const height = app.renderer.height

    glow.clear()
    glow.rect(0, 0, width, height).fill({ color: 0x0b1521, alpha: 1 })

    for (const particle of particles) {
      if (particle.sprite.x > width) particle.sprite.x = Math.random() * width
      if (particle.sprite.y > height) particle.sprite.y = Math.random() * height
    }
  }

  const update = (deltaSeconds) => {
    const width = app.renderer.width
    const height = app.renderer.height

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
