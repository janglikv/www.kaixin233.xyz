import * as PIXI from 'pixi.js'

export const createSpaceBackdrop = ({ width, height }) => {
  const backdrop = new PIXI.Container()

  const background = new PIXI.Graphics()
  background.rect(0, 0, width, height).fill(0x0b1020)
  backdrop.addChild(background)

  const nebulaConfigs = [
    {
      x: width * 0.2,
      y: height * 0.24,
      radius: 220,
      color: 0x1e2d6d,
      alpha: 0.18,
      driftX: 8,
      driftY: 10,
      speed: 0.38,
      phase: 0.2,
    },
    {
      x: width * 0.82,
      y: height * 0.22,
      radius: 210,
      color: 0x5d2248,
      alpha: 0.12,
      driftX: 11,
      driftY: 7,
      speed: 0.31,
      phase: 1.4,
    },
    {
      x: width * 0.5,
      y: height * 0.82,
      radius: 260,
      color: 0x143848,
      alpha: 0.1,
      driftX: 14,
      driftY: 12,
      speed: 0.27,
      phase: 2.1,
    },
  ]

  const nebulaLayer = new PIXI.Container()
  const nebulas = nebulaConfigs.map((config) => {
    const glow = new PIXI.Graphics()
    glow.circle(0, 0, config.radius).fill({
      color: config.color,
      alpha: config.alpha,
    })
    glow.position.set(config.x, config.y)
    nebulaLayer.addChild(glow)
    return {
      glow,
      ...config,
    }
  })
  backdrop.addChild(nebulaLayer)

  const createStarStrip = (count, options) => {
    const strip = new PIXI.Graphics()
    for (let index = 0; index < count; index += 1) {
      const x = ((index * options.stepX) % width) + ((index % options.scatterX) - 3) * options.jitterX
      const y =
        ((index * options.stepY) % height) + ((index % options.scatterY) - 2) * options.jitterY
      const radius = index % options.brightEvery === 0 ? options.bigRadius : options.smallRadius
      const alpha = options.alphaBase + (index % options.alphaSteps) * options.alphaStepSize
      if (options.trailLength > 0) {
        strip
          .roundRect(
            x - Math.max(0.6, radius * 0.34),
            y - options.trailLength + options.trailHeadOffset,
            Math.max(1.2, radius * 0.68),
            options.trailLength,
            Math.max(0.6, radius * 0.34),
          )
          .fill({ color: 0xffffff, alpha: alpha * options.trailAlpha })
      }
      strip.circle(x, y, radius).fill({ color: 0xffffff, alpha })
    }
    return strip
  }

  const starLayerConfigs = [
    {
      count: 44,
      speed: 112,
      alpha: 0.88,
      stepX: 173,
      stepY: 131,
      scatterX: 7,
      scatterY: 5,
      jitterX: 5,
      jitterY: 6,
      brightEvery: 11,
      bigRadius: 2.6,
      smallRadius: 1.2,
      alphaBase: 0.16,
      alphaSteps: 6,
      alphaStepSize: 0.08,
      trailLength: 0,
      trailHeadOffset: 0,
      trailAlpha: 0,
    },
    {
      count: 4,
      speed: 232,
      alpha: 0.92,
      stepX: 223,
      stepY: 167,
      scatterX: 6,
      scatterY: 4,
      jitterX: 8,
      jitterY: 10,
      brightEvery: 7,
      bigRadius: 3.2,
      smallRadius: 1.5,
      alphaBase: 0.32,
      alphaSteps: 5,
      alphaStepSize: 0.12,
      trailLength: 30,
      trailHeadOffset: 5,
      trailAlpha: 0.42,
    },
  ]

  const starLayers = starLayerConfigs.map((config) => {
    const layer = new PIXI.Container()
    const primaryStrip = createStarStrip(config.count, config)
    const secondaryStrip = createStarStrip(config.count, config)
    secondaryStrip.y = -height
    layer.alpha = config.alpha
    layer.addChild(primaryStrip, secondaryStrip)
    backdrop.addChild(layer)
    return {
      layer,
      primaryStrip,
      secondaryStrip,
      ...config,
    }
  })

  const shimmerStars = []
  for (let index = 0; index < 18; index += 1) {
    const shimmer = new PIXI.Graphics()
    shimmer
      .circle(0, 0, index % 4 === 0 ? 2.2 : 1.4)
      .fill({ color: index % 5 === 0 ? 0xfff1c1 : 0xffffff, alpha: 0.85 })
    shimmer.position.set(
      ((index * 251) % width) + ((index % 3) - 1) * 12,
      ((index * 193) % height) + ((index % 4) - 2) * 8,
    )
    backdrop.addChild(shimmer)
    shimmerStars.push({
      shimmer,
      baseAlpha: 0.18 + (index % 4) * 0.12,
      amplitude: 0.2 + (index % 3) * 0.08,
      speed: 0.8 + (index % 5) * 0.16,
      phase: index * 0.7,
    })
  }

  let elapsed = 0
  backdrop.update = (deltaSeconds) => {
    elapsed += deltaSeconds

    nebulas.forEach((nebula) => {
      const drift = elapsed * (nebula.speed * 1.35) + nebula.phase
      nebula.glow.position.set(
        nebula.x + Math.cos(drift) * nebula.driftX,
        nebula.y + Math.sin(drift * 0.9) * nebula.driftY,
      )
      const scale = 0.96 + Math.sin(drift * 1.2) * 0.04
      nebula.glow.scale.set(scale)
      nebula.glow.alpha = nebula.alpha * (0.78 + Math.sin(drift * 1.35) * 0.14)
    })

    starLayers.forEach((starLayer) => {
      const scroll = (elapsed * starLayer.speed) % height
      starLayer.primaryStrip.y = scroll
      starLayer.secondaryStrip.y = scroll - height
    })

    shimmerStars.forEach((item) => {
      item.shimmer.alpha =
        item.baseAlpha +
        ((Math.sin(elapsed * (item.speed * 1.4) + item.phase) + 1) * 0.5) * item.amplitude
      const scale = 0.92 + Math.sin(elapsed * (item.speed * 1.55) + item.phase) * 0.08
      item.shimmer.scale.set(scale)
    })
  }

  return backdrop
}
