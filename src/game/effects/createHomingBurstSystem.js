import * as PIXI from 'pixi.js'

const MISSILE_SPEED = 1280
const MISSILE_TURN_RATE = 5.8
const MISSILE_HIT_RADIUS = 24
const MISSILE_MAX_TRACKS = 5
const TRAIL_LENGTH = 36
const MISSILE_LAUNCH_JITTER = 0.18
const MISSILE_BIAS_STRENGTH = 0.72
const MISSILE_BIAS_DECAY = 0.94
const TRAIL_COLORS = [0xd90429, 0xf72585, 0xff9e00, 0x06d6a0, 0x118ab2, 0x8338ec]

const pickColor = (offset) => TRAIL_COLORS[offset % TRAIL_COLORS.length]

const createMissileGraphic = () => {
  const graphic = new PIXI.Graphics()
  graphic
    .roundRect(-2, -8, 4, 16, 2)
    .fill({ color: 0xb8d8ff, alpha: 0.92 })
    .poly([
      0, -14,
      4, -5,
      -4, -5,
    ])
    .fill({ color: 0x4cc9f0, alpha: 0.88 })
  graphic.blendMode = 'add'
  return graphic
}

const createTrailSegment = () => {
  const sprite = new PIXI.Sprite(PIXI.Texture.WHITE)
  sprite.anchor.set(0, 0.5)
  sprite.blendMode = 'add'
  sprite.visible = false
  return sprite
}

const normalize = (x, y) => {
  const length = Math.hypot(x, y) || 1
  return { x: x / length, y: y / length }
}

const rotateVector = (x, y, angle) => ({
  x: x * Math.cos(angle) - y * Math.sin(angle),
  y: x * Math.sin(angle) + y * Math.cos(angle),
})

export const createHomingBurstSystem = ({ parent, onImpact, onSpawn }) => {
  const layer = new PIXI.Container()
  const missiles = []
  parent.addChild(layer)

  const removeMissile = (index) => {
    const missile = missiles[index]
    missile.trail.destroy({ children: true })
    missile.sprite.destroy()
    missiles.splice(index, 1)
  }

  const getNextTarget = (missile, excludeId = null) => {
    const targets = missile.getTargets()
    let bestTarget = null
    let bestDistance = Infinity

    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index]
      if (target.id === excludeId || missile.visitedTargetIds.has(target.id)) {
        continue
      }

      const distance = Math.hypot(target.x - missile.x, target.y - missile.y)
      if (distance < bestDistance) {
        bestDistance = distance
        bestTarget = target
      }
    }

    return bestTarget
  }

  const findCollisionTarget = (missile) => {
    return missile.getTargets().find((target) => {
      if (missile.visitedTargetIds.has(target.id)) return false
      return Math.hypot(target.x - missile.x, target.y - missile.y) <= MISSILE_HIT_RADIUS
    })
  }

  const resolveCurrentTarget = (missile) => {
    if (!missile.target) return null
    return missile.getTargets().find((target) => target.id === missile.target.id) ?? null
  }

  const spawnMissile = ({ x, y, side, colorOffset, target, getTargets }) => {
    const sprite = createMissileGraphic()
    const trail = new PIXI.Container()
    const baseDirection = normalize(side * 0.85, -1)
    const jitter = (Math.random() * 2 - 1) * MISSILE_LAUNCH_JITTER
    const jitteredDirection = rotateVector(baseDirection.x, baseDirection.y, jitter)
    const direction = normalize(jitteredDirection.x, jitteredDirection.y)
    const steeringBias = normalize(jitteredDirection.x - baseDirection.x, jitteredDirection.y - baseDirection.y)

    sprite.position.set(x, y)
    const trailSegments = Array.from({ length: TRAIL_LENGTH - 1 }, () => createTrailSegment())
    trailSegments.forEach((segment) => trail.addChild(segment))
    layer.addChild(trail)
    layer.addChild(sprite)

    missiles.push({
      x,
      y,
      velocityX: direction.x * MISSILE_SPEED,
      velocityY: direction.y * MISSILE_SPEED,
      target,
      getTargets,
      trail,
      trailSegments,
      sprite,
      history: Array.from({ length: TRAIL_LENGTH }, () => ({ x, y })),
      colorOffset,
      visitedTargetIds: new Set(),
      hitCount: 0,
      biasX: steeringBias.x,
      biasY: steeringBias.y,
      biasStrength: MISSILE_BIAS_STRENGTH,
    })
  }

  return {
    spawnPair({ x, y, target, getTargets }) {
      if (!target) return
      onSpawn?.({ x, y, target })
      spawnMissile({ x, y, side: -1, colorOffset: 0, target, getTargets })
      spawnMissile({ x, y, side: 1, colorOffset: 3, target, getTargets })
    },
    update(deltaSeconds) {
      for (let index = missiles.length - 1; index >= 0; index -= 1) {
        const missile = missiles[index]

        if (missile.target) {
          const currentTarget = resolveCurrentTarget(missile)

          if (!currentTarget) {
            missile.target = getNextTarget(missile, missile.target.id) ?? null
          } else {
            missile.target = currentTarget
          }
        }

        if (!missile.target) {
          missile.target = getNextTarget(missile)
        }

        if (!missile.target) {
          removeMissile(index)
          continue
        }

        if (missile.target) {
          const toTarget = normalize(
            missile.target.x - missile.x,
            missile.target.y - missile.y,
          )
          const desiredDirection = normalize(
            toTarget.x + missile.biasX * missile.biasStrength,
            toTarget.y + missile.biasY * missile.biasStrength,
          )
          missile.velocityX +=
            (desiredDirection.x * MISSILE_SPEED - missile.velocityX) *
            MISSILE_TURN_RATE *
            deltaSeconds
          missile.velocityY +=
            (desiredDirection.y * MISSILE_SPEED - missile.velocityY) *
            MISSILE_TURN_RATE *
            deltaSeconds
          missile.biasStrength *= 1 - (1 - MISSILE_BIAS_DECAY) * deltaSeconds * 60
        }

        missile.x += missile.velocityX * deltaSeconds
        missile.y += missile.velocityY * deltaSeconds
        missile.sprite.position.set(missile.x, missile.y)
        missile.sprite.rotation = Math.atan2(missile.velocityY, missile.velocityX) + Math.PI / 2

        missile.history.unshift({ x: missile.x, y: missile.y })
        missile.history.length = TRAIL_LENGTH

        for (let trailIndex = 0; trailIndex < missile.trailSegments.length; trailIndex += 1) {
          const fromPoint = missile.history[trailIndex]
          const toPoint = missile.history[trailIndex + 1]
          const segment = missile.trailSegments[trailIndex]
          const progress = 1 - trailIndex / missile.trailSegments.length
          const dx = toPoint.x - fromPoint.x
          const dy = toPoint.y - fromPoint.y
          const length = Math.hypot(dx, dy)

          if (length < 0.001) {
            segment.visible = false
            continue
          }

          segment.visible = true
          segment.position.set(fromPoint.x, fromPoint.y)
          segment.rotation = Math.atan2(dy, dx)
          segment.width = length
          segment.height = 1.5 + progress * 5
          segment.tint = pickColor(missile.colorOffset + trailIndex)
          segment.alpha = 0.14 + progress * 0.62
        }

        const collisionTarget =
          Math.hypot(missile.target.x - missile.x, missile.target.y - missile.y) <= MISSILE_HIT_RADIUS
            ? missile.target
            : findCollisionTarget(missile)

        if (collisionTarget) {
          const hitTarget = collisionTarget
          missile.visitedTargetIds.add(hitTarget.id)
          const isCrit = onImpact?.({ x: missile.x, y: missile.y, target: hitTarget }) ?? false

          if (!isCrit) {
            removeMissile(index)
            continue
          }

          missile.hitCount += 1

          if (missile.hitCount >= MISSILE_MAX_TRACKS) {
            removeMissile(index)
            continue
          }

          missile.target = getNextTarget(missile, hitTarget.id) ?? null
          if (!missile.target) {
            removeMissile(index)
          }
          continue
        }

        if (
          missile.x < -80 ||
          missile.x > 1360 ||
          missile.y < -80 ||
          missile.y > 800
        ) {
          removeMissile(index)
        }
      }
    },
    destroy() {
      layer.destroy({ children: true })
      missiles.length = 0
    },
  }
}
