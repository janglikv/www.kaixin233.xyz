import * as PIXI from 'pixi.js'

// 爆炸特效系统：
// 1) 火花/碎片粒子
// 2) 爆闪
// 3) 空间扭曲涟漪（位移贴图）
// 4) 轻微屏幕震动
export const createExplosionSystem = (app, worldLayer, options = {}) => {
  const targetLayer = options.targetLayer ?? worldLayer
  const overlayLayer = options.overlayLayer ?? app.stage
  const toOverlayPosition = options.toOverlayPosition ?? ((x, y, out) => out.set(x, y))
  const explosionParticles = []
  const blastFlashes = []
  const rippleState = {
    active: false,
    age: 0,
    life: 0.48,
    strength: 106,
  }

  const fxContainer = new PIXI.Container()
  fxContainer.zIndex = 40
  worldLayer.addChild(fxContainer)

  // 火花纹理
  const sparkShape = new PIXI.Graphics()
  sparkShape
    .circle(3, 3, 3)
    .fill(0xffd26f)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.9 })
  const sparkTexture = app.renderer.generateTexture(sparkShape)
  sparkShape.destroy()

  // 碎片纹理
  const shardShape = new PIXI.Graphics()
  shardShape
    .roundRect(0, 0, 16, 4, 2)
    .fill(0xffcc78)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.8 })
  const shardTexture = app.renderer.generateTexture(shardShape)
  shardShape.destroy()

  // 爆闪纹理
  const flashShape = new PIXI.Graphics()
  flashShape.circle(36, 36, 30).fill({ color: 0xffb34d, alpha: 0.75 })
  flashShape.circle(36, 36, 18).fill({ color: 0xffffff, alpha: 0.9 })
  const flashTexture = app.renderer.generateTexture(flashShape)
  flashShape.destroy()

  // 位移贴图（用于单实例冲击波滤镜）
  const createRippleDisplacementTexture = (size = 256) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return PIXI.Texture.WHITE

    const imageData = context.createImageData(size, size)
    const data = imageData.data
    const center = size / 2
    const maxRadius = center - 2
    const clampChannel = (value) => Math.max(0, Math.min(255, Math.round(value)))

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x + 0.5 - center
        const dy = y + 0.5 - center
        const radius = Math.hypot(dx, dy)
        const idx = (y * size + x) * 4

        let offsetX = 0
        let offsetY = 0
        if (radius < maxRadius) {
          const nx = radius > 1e-4 ? dx / radius : 0
          const ny = radius > 1e-4 ? dy / radius : 0
          const core = Math.max(0, 1 - radius / (maxRadius * 0.54))
          const ring = Math.max(0, 1 - Math.abs(radius - maxRadius * 0.7) / (maxRadius * 0.2))
          const strength = core * 24 + ring * 42
          offsetX = nx * strength
          offsetY = ny * strength
        }

        data[idx] = clampChannel(128 + offsetX)
        data[idx + 1] = clampChannel(128 + offsetY)
        data[idx + 2] = 128
        data[idx + 3] = 255
      }
    }

    context.putImageData(imageData, 0, 0)
    return PIXI.Texture.from(canvas)
  }

  const distortionTexture = createRippleDisplacementTexture(256)
  const mapSprite = new PIXI.Sprite(distortionTexture)
  mapSprite.anchor.set(0.5)
  mapSprite.scale.set(0.18)
  mapSprite.renderable = false
  mapSprite.visible = false
  mapSprite.zIndex = 30
  overlayLayer.addChild(mapSprite)

  const distortionFilter = new PIXI.DisplacementFilter({
    sprite: mapSprite,
    scale: { x: 0, y: 0 },
  })
  const overlayPoint = new PIXI.Point()

  const refreshTargetFilters = () => {
    targetLayer.filters = rippleState.active ? [distortionFilter] : null
  }

  // 在指定位置触发位移冲击波（单实例）
  const spawnDistortionRipple = (x, y) => {
    const pos = toOverlayPosition(x, y, overlayPoint)
    mapSprite.position.copyFrom(pos)
    mapSprite.scale.set(0.2)
    mapSprite.rotation = Math.random() * Math.PI * 2
    mapSprite.visible = true
    rippleState.active = true
    rippleState.age = 0
    rippleState.life = 0.48
    rippleState.strength = 106
    refreshTargetFilters()
  }

  // 触发爆炸：组合多种视觉层
  const spawn = (x, y) => {
    // 爆闪
    const flash = new PIXI.Sprite(flashTexture)
    flash.anchor.set(0.5)
    flash.position.set(x, y)
    flash.scale.set(0.22)
    flash.alpha = 1
    flash.blendMode = 'add'
    fxContainer.addChild(flash)
    blastFlashes.push({
      sprite: flash,
      age: 0,
      life: 0.16,
      startScale: 0.22,
      endScale: 1.8,
    })

    // 主火花
    const sparkCount = 42
    for (let i = 0; i < sparkCount; i += 1) {
      const particle = new PIXI.Sprite(sparkTexture)
      const angle = Math.random() * Math.PI * 2
      const speed = 180 + Math.random() * 360
      const life = 0.22 + Math.random() * 0.34
      particle.anchor.set(0.5)
      particle.x = x
      particle.y = y
      particle.scale.set(0.32 + Math.random() * 0.95)
      particle.alpha = 0.8 + Math.random() * 0.2
      particle.tint = Math.random() > 0.5 ? 0xffcf7f : 0xff8a48
      particle.blendMode = 'add'
      fxContainer.addChild(particle)
      const baseScale = particle.scale.x
      explosionParticles.push({
        sprite: particle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        age: 0,
        spin: (Math.random() - 0.5) * 13,
        baseScale,
        gravity: 520,
        drag: 0.95,
        shrink: 0.92,
        fadePower: 1.35,
      })
    }

    // 爆炸碎片
    const shardCount = 16
    for (let i = 0; i < shardCount; i += 1) {
      const shard = new PIXI.Sprite(shardTexture)
      const angle = (i / shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.22
      const speed = 240 + Math.random() * 340
      const life = 0.16 + Math.random() * 0.2
      shard.anchor.set(0.5)
      shard.x = x
      shard.y = y
      shard.rotation = angle
      shard.alpha = 0.9
      shard.scale.set(0.65 + Math.random() * 0.45)
      shard.blendMode = 'add'
      fxContainer.addChild(shard)
      const baseScale = shard.scale.x
      explosionParticles.push({
        sprite: shard,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        age: 0,
        spin: (Math.random() - 0.5) * 20,
        baseScale,
        gravity: 320,
        drag: 0.9,
        shrink: 0.98,
        fadePower: 1.7,
      })
    }

    // 空间涟漪
    spawnDistortionRipple(x, y)

    // 冷色烟雾层，补足爆炸体积感
    for (let i = 0; i < 12; i += 1) {
      const haze = new PIXI.Sprite(sparkTexture)
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.25
      const speed = 70 + Math.random() * 60
      const life = 0.18 + Math.random() * 0.2
      haze.anchor.set(0.5)
      haze.x = x
      haze.y = y
      haze.tint = 0x9fd9ff
      haze.alpha = 0.45
      haze.scale.set(0.2 + Math.random() * 0.25)
      haze.blendMode = 'screen'
      fxContainer.addChild(haze)
      const baseScale = haze.scale.x
      explosionParticles.push({
        sprite: haze,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        age: 0,
        spin: (Math.random() - 0.5) * 10,
        baseScale,
        gravity: 120,
        drag: 0.93,
        shrink: 0.55,
        fadePower: 1.1,
      })
    }
  }

  // 预留布局接口（当前不过滤裁剪区域，避免错误裁剪导致内容消失）
  const layout = () => {}

  // 每帧更新：推进粒子、闪光、涟漪与震屏状态
  const update = (deltaSeconds) => {
    for (let i = explosionParticles.length - 1; i >= 0; i -= 1) {
      const particle = explosionParticles[i]
      particle.age += deltaSeconds
      const t = particle.age / particle.life
      if (t >= 1) {
        fxContainer.removeChild(particle.sprite)
        particle.sprite.destroy()
        explosionParticles.splice(i, 1)
        continue
      }

      particle.vy += (particle.gravity ?? 420) * deltaSeconds
      const drag = particle.drag ?? 1
      if (drag < 1) {
        const dragFactor = drag ** (deltaSeconds * 60)
        particle.vx *= dragFactor
        particle.vy *= dragFactor
      }

      particle.sprite.x += particle.vx * deltaSeconds
      particle.sprite.y += particle.vy * deltaSeconds
      particle.sprite.rotation += particle.spin * deltaSeconds
      particle.sprite.alpha = (1 - t) ** (particle.fadePower ?? 1)
      const shrink = particle.shrink ?? 0.8
      const scale = Math.max(0.05, particle.baseScale * (1 - t * shrink))
      particle.sprite.scale.set(scale)
    }

    for (let i = blastFlashes.length - 1; i >= 0; i -= 1) {
      const flash = blastFlashes[i]
      flash.age += deltaSeconds
      const t = flash.age / flash.life
      if (t >= 1) {
        fxContainer.removeChild(flash.sprite)
        flash.sprite.destroy()
        blastFlashes.splice(i, 1)
        continue
      }

      const easeOut = 1 - (1 - t) ** 3
      const scale = flash.startScale + (flash.endScale - flash.startScale) * easeOut
      flash.sprite.scale.set(scale)
      flash.sprite.alpha = (1 - t) ** 2
    }

    if (rippleState.active) {
      rippleState.age += deltaSeconds
      const t = rippleState.age / rippleState.life
      if (t >= 1) {
        rippleState.active = false
        mapSprite.visible = false
        distortionFilter.scale.x = 0
        distortionFilter.scale.y = 0
        refreshTargetFilters()
      } else {
        const easeOut = 1 - (1 - t) ** 2
        const scale = 0.2 + (2.0 - 0.2) * easeOut
        mapSprite.scale.set(scale)
        mapSprite.rotation += deltaSeconds * 2.2
        const strength = rippleState.strength * ((1 - t) ** 0.72) * (0.76 + 0.24 * Math.sin(rippleState.age * 30))
        distortionFilter.scale.x = strength
        distortionFilter.scale.y = strength
      }
    }

    // 不使用震屏时，确保世界层偏移被重置
    if (worldLayer.x !== 0 || worldLayer.y !== 0) {
      worldLayer.x = 0
      worldLayer.y = 0
    }
  }

  return { spawn, update, layout }
}
