import * as PIXI from 'pixi.js'

const MISSILE_SPEED = 1280
const MISSILE_TURN_RATE = 5.8
const MISSILE_HIT_RADIUS = 24
const MISSILE_MAX_TRACKS = 5
const TRAIL_LENGTH = 40
const MISSILE_LAUNCH_JITTER = 0.18
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

const normalize = (x, y) => {
  const length = Math.hypot(x, y) || 1
  return { x: x / length, y: y / length }
}

const rotateVector = (x, y, angle) => ({
  x: x * Math.cos(angle) - y * Math.sin(angle),
  y: x * Math.sin(angle) + y * Math.cos(angle),
})

export const createHomingBurstSystem = ({ parent, onImpact }) => {
  const layer = new PIXI.Container()
  const missiles = []
  parent.addChild(layer)

  const removeMissile = (index) => {
    const missile = missiles[index]
    missile.trail.destroy()
    missile.sprite.destroy()
    missiles.splice(index, 1)
  }

  const getNextTarget = (missile, excludeId = null) => {
    const targets = missile.getTargets()
    const direction = normalize(missile.velocityX, missile.velocityY)

    return targets
      .filter((target) => target.id !== excludeId && !missile.visitedTargetIds.has(target.id))
      .filter((target) => {
        const toTargetX = target.x - missile.x
        const toTargetY = target.y - missile.y
        return toTargetX * direction.x + toTargetY * direction.y > 0
      })
      .sort((left, right) => {
        const leftDistance = Math.hypot(left.x - missile.x, left.y - missile.y)
        const rightDistance = Math.hypot(right.x - missile.x, right.y - missile.y)
        return leftDistance - rightDistance
      })[0]
  }

  const findCollisionTarget = (missile) => {
    return missile.getTargets().find((target) => {
      if (missile.visitedTargetIds.has(target.id)) return false
      return Math.hypot(target.x - missile.x, target.y - missile.y) <= MISSILE_HIT_RADIUS
    })
  }

  const resolveCurrentTarget = (missile) => {
    if (!missile.target) return null
    if (missile.finalPointActive) return missile.target
    return missile.getTargets().find((target) => target.id === missile.target.id) ?? null
  }

  const spawnMissile = ({ x, y, side, colorOffset, target, getTargets, finalTarget }) => {
    const sprite = createMissileGraphic()
    const trail = new PIXI.Graphics()
    const baseDirection = normalize(side * 0.85, -1)
    const jitter = (Math.random() * 2 - 1) * MISSILE_LAUNCH_JITTER
    const jitteredDirection = rotateVector(baseDirection.x, baseDirection.y, jitter)
    const direction = normalize(jitteredDirection.x, jitteredDirection.y)

    sprite.position.set(x, y)
    trail.blendMode = 'add'
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
      sprite,
      history: Array.from({ length: TRAIL_LENGTH }, () => ({ x, y })),
      colorOffset,
      visitedTargetIds: new Set(),
      hitCount: 0,
      finalPointActive: false,
      finalTarget,
    })
  }

  return {
    spawnPair({ x, y, target, getTargets, finalTarget }) {
      if (!target) return
      spawnMissile({ x, y, side: -1, colorOffset: 0, target, getTargets, finalTarget })
      spawnMissile({ x, y, side: 1, colorOffset: 3, target, getTargets, finalTarget })
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

        if (missile.target) {
          const toTarget = normalize(
            missile.target.x - missile.x,
            missile.target.y - missile.y,
          )
          missile.velocityX +=
            (toTarget.x * MISSILE_SPEED - missile.velocityX) * MISSILE_TURN_RATE * deltaSeconds
          missile.velocityY +=
            (toTarget.y * MISSILE_SPEED - missile.velocityY) * MISSILE_TURN_RATE * deltaSeconds
        }

        missile.x += missile.velocityX * deltaSeconds
        missile.y += missile.velocityY * deltaSeconds
        missile.sprite.position.set(missile.x, missile.y)
        missile.sprite.rotation = Math.atan2(missile.velocityY, missile.velocityX) + Math.PI / 2

        missile.history.unshift({ x: missile.x, y: missile.y })
        missile.history.length = TRAIL_LENGTH

        missile.trail.clear()
        for (let trailIndex = 0; trailIndex < missile.history.length; trailIndex += 1) {
          const point = missile.history[trailIndex]
          const progress = 1 - trailIndex / missile.history.length
          missile.trail
            .circle(point.x, point.y, 1.6 + progress * 5.2)
            .fill({
              color: pickColor(missile.colorOffset + trailIndex),
              alpha: progress * 0.34,
            })
        }

        const collisionTarget =
          missile.finalPointActive || !missile.target
            ? findCollisionTarget(missile)
            : Math.hypot(missile.target.x - missile.x, missile.target.y - missile.y) <=
                  MISSILE_HIT_RADIUS
              ? missile.target
              : null

        if (collisionTarget) {
          const hitTarget = collisionTarget
          missile.visitedTargetIds.add(hitTarget.id)

          if (missile.finalPointActive || !missile.target) {
            onImpact?.({ x: missile.x, y: missile.y, target: hitTarget })
            continue
          }

          const isCrit = onImpact?.({ x: missile.x, y: missile.y, target: hitTarget }) ?? false

          if (!isCrit) {
            removeMissile(index)
            continue
          }

          missile.hitCount += 1

          if (missile.hitCount >= MISSILE_MAX_TRACKS) {
            missile.target = missile.finalTarget ?? null
            missile.finalPointActive = true
            continue
          }

          missile.target = getNextTarget(missile, hitTarget.id) ?? null
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
