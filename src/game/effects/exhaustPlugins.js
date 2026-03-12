const LASER_COLORS = [0xff4d6d, 0xff8fab, 0x9d4edd, 0x4cc9f0, 0x72efdd]

const pick = (colors) => colors[Math.floor(Math.random() * colors.length)]

const createParticleGraphic = (PIXI, definition) => {
  const graphic = new PIXI.Graphics()
  graphic.ellipse(0, 0, definition.width, definition.height).fill({
    color: definition.color,
    alpha: definition.alpha,
  })
  if (definition.blendMode) {
    graphic.blendMode = definition.blendMode
  }
  return graphic
}

const createEngineRuntime = (PIXI, parent, config) => {
  const root = new PIXI.Container()
  const trailLayer = new PIXI.Container()
  const aura = new PIXI.Graphics()
  const shock = new PIXI.Graphics()
  const particles = []
  let accumulator = 0

  aura.blendMode = 'add'
  shock.blendMode = 'add'
  root.addChild(trailLayer)
  root.addChild(aura)
  root.addChild(shock)
  parent.addChild(root)

  const spawnParticle = (originX, originY, directionX, directionY, elapsedSeconds, pulse) => {
    const type = config.pickType()
    const definition = config.createParticle(type, pulse)
    const graphic = createParticleGraphic(PIXI, definition)

    graphic.position.set(
      originX + (Math.random() - 0.5) * definition.spawnWidth,
      originY + (Math.random() - 0.5) * definition.spawnHeight,
    )
    graphic.rotation = definition.rotation ?? Math.atan2(-directionX, directionY)
    trailLayer.addChild(graphic)

    particles.push({
      display: graphic,
      type,
      age: 0,
      life: definition.life,
      velocityX:
        -directionX * definition.forwardSpeed +
        (Math.random() - 0.5) * definition.spread +
        Math.sin(elapsedSeconds * definition.waveFrequency + Math.random() * Math.PI) *
          definition.waveAmount,
      velocityY:
        -directionY * definition.forwardSpeed +
        (Math.random() - 0.5) * definition.spread +
        definition.verticalLift,
      growthX: definition.growthX,
      growthY: definition.growthY,
      drag: definition.drag,
      turbulence: definition.turbulence,
      spin: (Math.random() - 0.5) * definition.spin,
      fadePower: definition.fadePower,
      baseAlpha: definition.alpha,
    })
  }

  return {
    update(deltaSeconds, elapsedSeconds, state) {
      const { originX, originY, directionX, directionY, pulse, scale = 1 } = state

      root.scale.set(scale)
      root.position.set(originX * (1 - scale), originY * (1 - scale))

      config.drawAura(aura, shock, { originX, originY, pulse })

      accumulator += deltaSeconds * config.spawnRate(pulse)
      while (accumulator >= 1) {
        accumulator -= 1
        spawnParticle(originX, originY, directionX, directionY, elapsedSeconds, pulse)
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index]
        particle.age += deltaSeconds

        if (particle.age >= particle.life) {
          trailLayer.removeChild(particle.display)
          particle.display.destroy()
          particles.splice(index, 1)
          continue
        }

        const lifeProgress = particle.age / particle.life
        const fade = (1 - lifeProgress) ** particle.fadePower

        particle.velocityX +=
          Math.sin(elapsedSeconds * 9 + particle.age * 18) *
          particle.turbulence *
          deltaSeconds
        particle.velocityY *= particle.drag
        particle.display.position.x += particle.velocityX * deltaSeconds
        particle.display.position.y += particle.velocityY * deltaSeconds
        particle.display.scale.set(
          1 + lifeProgress * particle.growthX,
          1 + lifeProgress * particle.growthY,
        )
        particle.display.alpha = particle.baseAlpha * fade
        particle.display.rotation += particle.spin
      }
    },
    destroy() {
      root.destroy({ children: true })
      particles.length = 0
    },
  }
}

const createWeightedPicker = (weights) => {
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0)

  return () => {
    let cursor = Math.random() * total
    for (const entry of weights) {
      cursor -= entry.weight
      if (cursor <= 0) {
        return entry.type
      }
    }
    return weights[weights.length - 1].type
  }
}

const createPlugin = ({ id, name, description, pickType, drawAura, spawnRate, createParticle }) => ({
  id,
  name,
  description,
  createRuntime(PIXI, parent) {
    return createEngineRuntime(PIXI, parent, {
      pickType,
      drawAura,
      spawnRate,
      createParticle,
    })
  },
})

const createLaserConfettiVariant = ({
  id,
  name,
  description,
  colors,
  glowColor,
  bloomColor,
  sparkColor,
  size = 1,
  width = 1,
  density = 1,
}) =>
  createPlugin({
    id,
    name,
    description,
    pickType: createWeightedPicker([
      { type: 'core', weight: 14 },
      { type: 'plume', weight: 60 },
      { type: 'ember', weight: 20 },
    ]),
    drawAura(aura, shock, { originX, originY, pulse }) {
      const length = (80 + pulse * 24) * size
      aura
        .clear()
        .ellipse(originX, originY + 16 * size, (12 + pulse * 3) * width, 12 * size)
        .fill({ color: glowColor, alpha: 0.1 + pulse * 0.03 })
        .ellipse(
          originX,
          originY + length * 0.4,
          (16 + pulse * 5) * width,
          length * 0.32,
        )
        .fill({ color: bloomColor, alpha: 0.12 + pulse * 0.04 })
      shock
        .clear()
        .ellipse(originX, originY + 26 * size, (8 + pulse * 2) * width, 4 * size)
        .fill({ color: sparkColor, alpha: 0.1 + pulse * 0.04 })
    },
    spawnRate: (pulse) => (34 + pulse * 14) * density,
    createParticle(type) {
      if (type === 'ember') {
        return {
          width: (3 + Math.random() * 2) * size,
          height: (6 + Math.random() * 4) * size,
          color: pick(colors),
          alpha: 0.76,
          life: 0.22 + Math.random() * 0.12,
          forwardSpeed: 140 + Math.random() * 50,
          spread: 50 * width,
          growthX: 0.22 * size,
          growthY: 0.3 * size,
          drag: 0.987,
          turbulence: 30 * width,
          spin: 0.05,
          fadePower: 1.35,
          spawnWidth: 18 * width,
          spawnHeight: 10 * size,
          verticalLift: 2,
          waveFrequency: 9,
          waveAmount: 8 * width,
          blendMode: 'add',
        }
      }
      if (type === 'core') {
        return {
          width: (4 + Math.random() * 2) * size,
          height: (11 + Math.random() * 8) * size,
          color: colors[0],
          alpha: 0.62,
          life: 0.12 + Math.random() * 0.05,
          forwardSpeed: 170 + Math.random() * 44,
          spread: 10 * width,
          growthX: 0.2 * size,
          growthY: 0.3 * size,
          drag: 0.976,
          turbulence: 8 * width,
          spin: 0.01,
          fadePower: 1.6,
          spawnWidth: 5 * width,
          spawnHeight: 6 * size,
          verticalLift: 0,
          waveFrequency: 8,
          waveAmount: 5 * width,
          blendMode: 'add',
        }
      }
      return {
        width: (7 + Math.random() * 6) * size,
        height: (12 + Math.random() * 16) * size,
        color: pick(colors),
        alpha: 0.66,
        life: 0.24 + Math.random() * 0.16,
        forwardSpeed: 148 + Math.random() * 56,
        spread: 44 * width,
        growthX: 0.64 * size,
        growthY: 0.82 * size,
        drag: 0.985,
        turbulence: 26 * width,
        spin: 0.028,
        fadePower: 1.5,
        spawnWidth: 20 * width,
        spawnHeight: 12 * size,
        verticalLift: 0,
        waveFrequency: 8,
        waveAmount: 10 * width,
        blendMode: 'add',
      }
    },
  })

export const EXHAUST_PLUGINS = [
  createLaserConfettiVariant({
    id: 'laser-confetti-classic',
    name: 'Classic',
    description: 'magenta-cyan baseline',
    colors: LASER_COLORS,
    glowColor: 0xff5db1,
    bloomColor: 0x4cc9f0,
    sparkColor: 0xff8fab,
  }),
  createLaserConfettiVariant({
    id: 'laser-confetti-lime',
    name: 'Lime Pop',
    description: 'acid green and aqua',
    colors: [0xc8ff6a, 0x7ef7c9, 0x76d7ff, 0xefff8a, 0x58f6b2],
    glowColor: 0xa7ff4d,
    bloomColor: 0x58f6b2,
    sparkColor: 0xeaff7a,
  }),
  createLaserConfettiVariant({
    id: 'laser-confetti-sunset',
    name: 'Sunset',
    description: 'orange pink mid-size plume',
    colors: [0xffb347, 0xff8fab, 0xff5d8f, 0xff7a5c, 0xffd166],
    glowColor: 0xff8f5a,
    bloomColor: 0xff5d8f,
    sparkColor: 0xffc38a,
    size: 1.1,
    width: 1.05,
  }),
  createLaserConfettiVariant({
    id: 'laser-confetti-mini',
    name: 'Mini',
    description: 'tight small particles',
    colors: [0x72efdd, 0x4cc9f0, 0xb5179e, 0xff4d6d, 0xff8fab],
    glowColor: 0x4cc9f0,
    bloomColor: 0xb5179e,
    sparkColor: 0x72efdd,
    size: 0.75,
    width: 0.8,
    density: 1.15,
  }),
  createLaserConfettiVariant({
    id: 'laser-confetti-mini-yellow',
    name: 'Mini Yellow',
    description: 'tight small particles in pure yellow',
    colors: [0xc78a00, 0xd89a00, 0xe0a800, 0xf2b705, 0xa96f00],
    glowColor: 0xc78a00,
    bloomColor: 0xe0a800,
    sparkColor: 0xf2b705,
    size: 0.75,
    width: 0.8,
    density: 1.15,
  }),
  createLaserConfettiVariant({
    id: 'laser-confetti-mini-blue',
    name: 'Mini Blue',
    description: 'tight small particles in pure blue',
    colors: [0x0f2fff, 0x1447ff, 0x1f63ff, 0x2d7dff, 0x52a2ff],
    glowColor: 0x1447ff,
    bloomColor: 0x1f63ff,
    sparkColor: 0x52a2ff,
    size: 0.75,
    width: 0.8,
    density: 1.15,
  }),
  createLaserConfettiVariant({
    id: 'laser-confetti-wide',
    name: 'Wide',
    description: 'large wide shards',
    colors: [0xff4d6d, 0xff8fab, 0x9d4edd, 0x4cc9f0, 0xf4a261],
    glowColor: 0xff4d6d,
    bloomColor: 0x9d4edd,
    sparkColor: 0x4cc9f0,
    size: 1.3,
    width: 1.35,
    density: 0.95,
  }),
  createLaserConfettiVariant({
    id: 'laser-confetti-neon',
    name: 'Neon',
    description: 'purple cyan nightclub palette',
    colors: [0xf72585, 0xb5179e, 0x7209b7, 0x4cc9f0, 0x72efdd],
    glowColor: 0xf72585,
    bloomColor: 0x4cc9f0,
    sparkColor: 0x72efdd,
    size: 1.05,
    width: 1.1,
    density: 1.08,
  }),
]
