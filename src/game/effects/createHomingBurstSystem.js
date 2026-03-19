import * as PIXI from 'pixi.js'

const MISSILE_SPEED = 1280
const MISSILE_TURN_RATE = 5.8
const MISSILE_HIT_RADIUS = 24
const MISSILE_MAX_TRACKS = 5
const TRAIL_LENGTH = 36
const MISSILE_LAUNCH_JITTER = 0.18
const MISSILE_BIAS_STRENGTH = 0.72
const MISSILE_BIAS_DECAY = 0.94
const BOUNDS_PADDING = 80
const BOUNDS_MAX_X = 1280 + BOUNDS_PADDING
const BOUNDS_MAX_Y = 720 + BOUNDS_PADDING
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
  graphic.visible = false
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

const getTargetX = (target) => target?.x ?? target?.centerX ?? 0
const getTargetY = (target) => target?.y ?? target?.centerY ?? 0

const getDistanceSquaredToTarget = (x, y, target) => {
  const dx = getTargetX(target) - x
  const dy = getTargetY(target) - y
  return dx * dx + dy * dy
}

const createTrail = () => {
  const trail = new PIXI.Container()
  const trailSegments = Array.from({ length: TRAIL_LENGTH - 1 }, () => createTrailSegment())
  trail.visible = false
  trailSegments.forEach((segment) => trail.addChild(segment))
  return { trail, trailSegments }
}

const createMissileState = () => {
  const sprite = createMissileGraphic()
  const { trail, trailSegments } = createTrail()

  return {
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    target: null,
    targetX: 0,
    targetY: 0,
    targetFrozen: false,
    getTargets: null,
    trail,
    trailSegments,
    sprite,
    historyX: new Float32Array(TRAIL_LENGTH),
    historyY: new Float32Array(TRAIL_LENGTH),
    historyCursor: 0,
    colorOffset: 0,
    visitedTargetIds: new Set(),
    hitCount: 0,
    biasX: 0,
    biasY: 0,
    biasStrength: MISSILE_BIAS_STRENGTH,
  }
}

export const createHomingBurstSystem = ({ parent, onImpact, onSpawn }) => {
  const layer = new PIXI.Container()
  const missiles = []
  const pool = []
  let launchSequence = 0
  parent.addChild(layer)

  const acquireMissile = () => {
    const missile = pool.pop() ?? createMissileState()
    if (!missile.sprite.parent) {
      layer.addChild(missile.trail)
      layer.addChild(missile.sprite)
    }
    missile.trail.visible = true
    missile.sprite.visible = true
    return missile
  }

  const releaseMissile = (index) => {
    const missile = missiles[index]
    missile.sprite.visible = false
    missile.trail.visible = false
    missile.target = null
    missile.targetFrozen = false
    missile.getTargets = null
    missile.hitCount = 0
    missile.biasStrength = MISSILE_BIAS_STRENGTH
    missile.visitedTargetIds.clear()

    for (let trailIndex = 0; trailIndex < missile.trailSegments.length; trailIndex += 1) {
      missile.trailSegments[trailIndex].visible = false
    }

    missiles.splice(index, 1)
    pool.push(missile)
  }

  const targetCache = new Map()

  const getCachedTargets = (missile) => {
    const getter = missile.getTargets
    if (typeof getter !== 'function') {
      return { targets: [], targetById: new Map() }
    }

    const cached = targetCache.get(getter)
    if (cached) return cached

    const targets = getter() ?? []
    const nextCache = { targets }
    targetCache.set(getter, nextCache)
    return nextCache
  }

  const getNextTarget = (missile, excludeId = null) => {
    const { targets } = getCachedTargets(missile)
    let bestTarget = null
    let bestDistanceSquared = Infinity

    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index]
      if (target.id === excludeId || missile.visitedTargetIds.has(target.id)) {
        continue
      }

      const distanceSquared = getDistanceSquaredToTarget(missile.x, missile.y, target)
      if (distanceSquared < bestDistanceSquared) {
        bestDistanceSquared = distanceSquared
        bestTarget = target
      }
    }

    return bestTarget
  }

  const findCollisionTarget = (missile) => {
    const { targets } = getCachedTargets(missile)
    const hitDistanceSquared = MISSILE_HIT_RADIUS * MISSILE_HIT_RADIUS

    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index]
      if (missile.visitedTargetIds.has(target.id)) continue
      if (getDistanceSquaredToTarget(missile.x, missile.y, target) <= hitDistanceSquared) {
        return target
      }
    }

    return null
  }

  const setMissileTarget = (missile, target) => {
    missile.target = target
    missile.targetX = getTargetX(target)
    missile.targetY = getTargetY(target)
    missile.targetFrozen = false
  }

  const syncTargetPosition = (missile) => {
    if (!missile.target || missile.targetFrozen) return
    if (missile.target.health <= 0) {
      missile.targetFrozen = true
      return
    }

    missile.targetX = getTargetX(missile.target)
    missile.targetY = getTargetY(missile.target)
  }

  const initializeHistory = (missile, x, y) => {
    for (let index = 0; index < TRAIL_LENGTH; index += 1) {
      missile.historyX[index] = x
      missile.historyY[index] = y
    }
    missile.historyCursor = 0
  }

  const pushHistoryPoint = (missile, x, y) => {
    missile.historyCursor = (missile.historyCursor + TRAIL_LENGTH - 1) % TRAIL_LENGTH
    missile.historyX[missile.historyCursor] = x
    missile.historyY[missile.historyCursor] = y
  }

  const updateTrail = (missile) => {
    const segmentCount = missile.trailSegments.length

    for (let trailIndex = 0; trailIndex < segmentCount; trailIndex += 1) {
      const fromIndex = (missile.historyCursor + trailIndex) % TRAIL_LENGTH
      const toIndex = (fromIndex + 1) % TRAIL_LENGTH
      const fromX = missile.historyX[fromIndex]
      const fromY = missile.historyY[fromIndex]
      const toX = missile.historyX[toIndex]
      const toY = missile.historyY[toIndex]
      const segment = missile.trailSegments[trailIndex]
      const progress = 1 - trailIndex / segmentCount
      const dx = toX - fromX
      const dy = toY - fromY
      const length = Math.hypot(dx, dy)

      if (length < 0.001) {
        segment.visible = false
        continue
      }

      segment.visible = true
      segment.position.set(fromX, fromY)
      segment.rotation = Math.atan2(dy, dx)
      segment.width = length
      segment.height = 1.5 + progress * 5
      segment.tint = pickColor(missile.colorOffset + trailIndex)
      segment.alpha = 0.14 + progress * 0.62
    }
  }

  const spawnMissile = ({ x, y, side, colorOffset, target, getTargets }) => {
    const missile = acquireMissile()
    const baseDirection = normalize(side * 0.85, -1)
    const jitter = (Math.random() * 2 - 1) * MISSILE_LAUNCH_JITTER
    const jitteredDirection = rotateVector(baseDirection.x, baseDirection.y, jitter)
    const direction = normalize(jitteredDirection.x, jitteredDirection.y)
    const steeringBias = normalize(jitteredDirection.x - baseDirection.x, jitteredDirection.y - baseDirection.y)

    missile.x = x
    missile.y = y
    missile.velocityX = direction.x * MISSILE_SPEED
    missile.velocityY = direction.y * MISSILE_SPEED
    missile.getTargets = getTargets
    missile.colorOffset = colorOffset
    missile.hitCount = 0
    missile.biasX = steeringBias.x
    missile.biasY = steeringBias.y
    missile.biasStrength = MISSILE_BIAS_STRENGTH
    missile.visitedTargetIds.clear()
    setMissileTarget(missile, target)
    initializeHistory(missile, x, y)

    missile.sprite.position.set(x, y)
    missiles.push(missile)
  }

  return {
    spawnBurst({ x, y, targets, getTargets }) {
      if (!Array.isArray(targets) || targets.length === 0) return
      onSpawn?.({ x, y, targets })

      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index]
        if (!target) continue
        const sequence = launchSequence
        const side = sequence % 2 === 0 ? -1 : 1
        const colorOffset = side < 0 ? sequence % 3 : 3 + (sequence % 3)
        launchSequence += 1
        spawnMissile({ x, y, side, colorOffset, target, getTargets })
      }
    },
    update(deltaSeconds) {
      targetCache.clear()

      for (let index = missiles.length - 1; index >= 0; index -= 1) {
        const missile = missiles[index]
        syncTargetPosition(missile)

        if (missile.target) {
          const toTarget = normalize(missile.targetX - missile.x, missile.targetY - missile.y)
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

        pushHistoryPoint(missile, missile.x, missile.y)
        updateTrail(missile)

        const targetDistanceSquared = missile.target
          ? getDistanceSquaredToTarget(missile.x, missile.y, {
              x: missile.targetX,
              y: missile.targetY,
            })
          : Infinity

        if (missile.targetFrozen && targetDistanceSquared <= MISSILE_HIT_RADIUS * MISSILE_HIT_RADIUS) {
          setMissileTarget(missile, getNextTarget(missile, missile.target?.id ?? null) ?? null)
          continue
        }

        const collisionTarget = missile.target
          ? !missile.targetFrozen && targetDistanceSquared <= MISSILE_HIT_RADIUS * MISSILE_HIT_RADIUS
            ? missile.target
            : findCollisionTarget(missile)
          : findCollisionTarget(missile)

        if (collisionTarget) {
          const hitTarget = collisionTarget
          missile.visitedTargetIds.add(hitTarget.id)
          const isCrit = onImpact?.({ x: missile.x, y: missile.y, target: hitTarget }) ?? false

          if (!isCrit) {
            releaseMissile(index)
            continue
          }

          missile.hitCount += 1

          if (missile.hitCount >= MISSILE_MAX_TRACKS) {
            releaseMissile(index)
            continue
          }

          setMissileTarget(missile, getNextTarget(missile, hitTarget.id) ?? null)
          continue
        }

        if (
          missile.x < -BOUNDS_PADDING ||
          missile.x > BOUNDS_MAX_X ||
          missile.y < -BOUNDS_PADDING ||
          missile.y > BOUNDS_MAX_Y
        ) {
          releaseMissile(index)
        }
      }
    },
    destroy() {
      missiles.length = 0
      pool.length = 0
      layer.destroy({ children: true })
    },
  }
}
