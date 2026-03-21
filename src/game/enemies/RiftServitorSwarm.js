import * as PIXI from 'pixi.js'
import { CATALOG_ENTRIES } from '../data/catalogEntries'
import { createVoidCreaturePreview } from '../renderers/createCatalogOverlay'

const ENEMY_ENTRY_CODE = '#10'
const TRACKING_ENEMY_ACCENT = 0xff4d6d
const ENEMY_SCALE = 0.96
const ENEMY_HEALTH = 1
const ENEMY_COLLISION_RADIUS = 38
const ENEMY_SPEED = 224
const ENEMY_COMMIT_SPEED = 456
const ENEMY_CONTACT_DAMAGE = 3
const ENEMY_TRACK_DISTANCE = 600
const ENEMY_COMMIT_DISTANCE = 220
const ENEMY_RECYCLE_BUFFER = 120
const ENEMY_SPATIAL_CELL_SIZE = 80
const ENEMY_SEPARATION_WEIGHT = 0.9
const ENEMY_TRACK_UPDATE_CHANCE = 0.08
const ENEMY_MAX_TURN_RATE = Math.PI * 0.9
const ENEMY_TURN_SMOOTHING = 0.22

const getSpatialCellKey = (x, y, cellSize) =>
  `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`

const normalizeAngleDelta = (angle) => {
  let nextAngle = angle
  while (nextAngle > Math.PI) nextAngle -= Math.PI * 2
  while (nextAngle < -Math.PI) nextAngle += Math.PI * 2
  return nextAngle
}

const createEnemyDisplay = (entry) => {
  const ship = createVoidCreaturePreview(entry, { withGlow: false })
  ship.scale.set(ENEMY_SCALE)
  const bounds = ship.getLocalBounds()
  ship.position.set(-bounds.x - bounds.width * 0.5, -bounds.y - bounds.height * 0.5)

  return {
    display: ship,
    updateAnimation(elapsedSeconds, speedRatio = 1) {
      const gait = ship.runtime?.gait ?? []
      const claws = ship.runtime?.claws ?? []
      gait.forEach((leg) => {
        leg.node.rotation =
          Math.sin(elapsedSeconds * (7.5 + speedRatio * 4) + leg.phase) *
          (0.08 + speedRatio * 0.12)
      })
      claws.forEach((claw) => {
        claw.node.rotation =
          Math.sin(elapsedSeconds * (5.2 + speedRatio * 2.4) + claw.phase) *
          (0.1 + speedRatio * 0.08)
      })
    },
  }
}

export class RiftServitorSwarm {
  constructor({
    parent,
    columns = 4,
    rows = 3,
    spawnX,
    spawnY = -92,
    spawnInterval = 1.08,
    flightPath = null,
    trackPlayer = true,
    trackDistance = ENEMY_TRACK_DISTANCE,
    commitDistance = ENEMY_COMMIT_DISTANCE,
    commitSpeedMultiplier = 1,
    worldWidth = 1280,
    worldHeight = 720,
    onEnemyDeath = null,
  }) {
    this.parent = parent
    this.columns = columns
    this.rows = rows
    this.spawnX = spawnX
    this.spawnY = spawnY
    this.spawnInterval = spawnInterval
    this.flightPath = Array.isArray(flightPath) ? flightPath.filter(Boolean) : []
    this.trackPlayer = trackPlayer
    this.trackDistance = trackDistance
    this.commitDistance = commitDistance
    this.commitSpeedMultiplier = commitSpeedMultiplier
    this.leftLimit = -ENEMY_RECYCLE_BUFFER
    this.rightLimit = worldWidth + ENEMY_RECYCLE_BUFFER
    this.topLimit = -ENEMY_RECYCLE_BUFFER
    this.bottomLimit = worldHeight + ENEMY_RECYCLE_BUFFER
    this.onEnemyDeath = typeof onEnemyDeath === 'function' ? onEnemyDeath : null
    this.elapsedSeconds = 0
    this.hitboxes = []
    this.enemies = []
    this.nextId = 1

    const baseEntry = CATALOG_ENTRIES.find((item) => item.code === ENEMY_ENTRY_CODE)
    if (!baseEntry) return
    const entry = this.trackPlayer
      ? {
          ...baseEntry,
          accent: TRACKING_ENEMY_ACCENT,
        }
      : baseEntry

    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
        const spawnOrder = rowIndex * columns + columnIndex
        const runtime = createEnemyDisplay(entry)
        const display = runtime.display
        display.position.set(spawnX, spawnY)
        display.visible = false
        parent.addChild(display)

        this.enemies.push({
          id: this.nextId,
          x: spawnX,
          y: spawnY,
          velocityX: 0,
          velocityY: 0,
          health: ENEMY_HEALTH,
          active: false,
          commit: false,
          seekDirectionX: 0,
          seekDirectionY: 1,
          moveDirectionX: 0,
          moveDirectionY: 1,
          commitDirectionX: 0,
          commitDirectionY: 1,
          pathIndex: 0,
          spawnTime: spawnOrder * spawnInterval,
          collisionRadius: ENEMY_COLLISION_RADIUS,
          hitboxHalfWidth: 24,
          hitboxTopOffset: 30,
          hitboxBottomOffset: 28,
          hitboxCenterYOffset: 8,
          display,
          runtime,
          hitbox: {
            left: spawnX - 24,
            right: spawnX + 24,
            top: spawnY - 30,
            bottom: spawnY + 28,
            id: this.nextId,
            centerX: spawnX,
            centerY: spawnY + 8,
            health: ENEMY_HEALTH,
          },
        })
        this.nextId += 1
      }
    }
  }

  getHitboxes() {
    this.hitboxes.length = 0
    this.enemies.forEach((enemy) => {
      if (enemy.health > 0 && enemy.active) {
        this.hitboxes.push(enemy.hitbox)
      }
    })
    return this.hitboxes
  }

  getShooters() {
    return []
  }

  applyDamage(enemyId, damage) {
    const enemy = this.enemies.find((item) => item.id === enemyId)
    if (!enemy || enemy.health <= 0) return null

    const previousHealth = enemy.health
    enemy.health = Math.max(0, enemy.health - damage)
    enemy.hitbox.health = enemy.health
    const died = previousHealth > 0 && enemy.health <= 0
    if (died) {
      enemy.display.visible = false
    }

    return {
      id: enemy.id,
      alive: enemy.health > 0,
      died,
      health: enemy.health,
      x: enemy.x,
      y: enemy.y + enemy.hitboxCenterYOffset,
    }
  }

  update(deltaSeconds, seekTarget = null, onPlayerCollision = () => {}) {
    this.elapsedSeconds += deltaSeconds
    const activeEnemies = []

    this.enemies.forEach((enemy) => {
      if (enemy.health <= 0) return
      if (!enemy.active) {
        if (this.elapsedSeconds < enemy.spawnTime) return
        enemy.active = true
        enemy.moveDirectionX = 0
        enemy.moveDirectionY = 1
        enemy.display.visible = true
      }
      activeEnemies.push(enemy)
    })

    const spatialGrid = new Map()
    activeEnemies.forEach((enemy) => {
      const key = getSpatialCellKey(enemy.x, enemy.y, ENEMY_SPATIAL_CELL_SIZE)
      const bucket = spatialGrid.get(key)
      if (bucket) {
        bucket.push(enemy)
        return
      }
      spatialGrid.set(key, [enemy])
    })

    activeEnemies.forEach((enemy) => {
      const playerDeltaX = (seekTarget?.x ?? enemy.x) - enemy.x
      const playerDeltaY = (seekTarget?.y ?? enemy.y) - enemy.y
      const playerDistance = seekTarget ? Math.hypot(playerDeltaX, playerDeltaY) : Infinity
      let deltaX = 0
      let deltaY = 1
      const trackingTarget =
        this.trackPlayer && seekTarget && playerDistance <= this.trackDistance
          ? seekTarget
          : null
      const cellX = Math.floor(enemy.x / ENEMY_SPATIAL_CELL_SIZE)
      const cellY = Math.floor(enemy.y / ENEMY_SPATIAL_CELL_SIZE)
      let separationX = 0
      let separationY = 0

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const neighborBucket = spatialGrid.get(`${cellX + offsetX},${cellY + offsetY}`)
          if (!neighborBucket) continue

          neighborBucket.forEach((neighbor) => {
            if (neighbor.id === enemy.id) return
            const offsetToNeighborX = enemy.x - neighbor.x
            const offsetToNeighborY = enemy.y - neighbor.y
            const minDistance = enemy.collisionRadius + neighbor.collisionRadius
            const distanceSquared =
              offsetToNeighborX * offsetToNeighborX + offsetToNeighborY * offsetToNeighborY
            if (distanceSquared === 0 || distanceSquared >= minDistance * minDistance) return

            const distance = Math.sqrt(distanceSquared)
            const strength = ((minDistance - distance) / minDistance) * ENEMY_SEPARATION_WEIGHT
            separationX += (offsetToNeighborX / distance) * strength
            separationY += (offsetToNeighborY / distance) * strength
          })
        }
      }

      if (!enemy.commit && trackingTarget && playerDistance <= this.commitDistance) {
        enemy.commit = true
        const commitLength = Math.hypot(playerDeltaX, playerDeltaY) || 1
        enemy.commitDirectionX = playerDeltaX / commitLength
        enemy.commitDirectionY = playerDeltaY / commitLength
      }

      if (enemy.commit) {
        deltaX = enemy.commitDirectionX
        deltaY = enemy.commitDirectionY
      } else if (!trackingTarget && this.flightPath.length > 0) {
        while (enemy.pathIndex < this.flightPath.length) {
          const waypoint = this.flightPath[enemy.pathIndex]
          const waypointDeltaX = waypoint.x - enemy.x
          const waypointDeltaY = waypoint.y - enemy.y
          const waypointDistance = Math.hypot(waypointDeltaX, waypointDeltaY)
          if (waypointDistance > ENEMY_SPEED * deltaSeconds) {
            deltaX = waypointDeltaX
            deltaY = waypointDeltaY
            break
          }
          enemy.pathIndex += 1
        }
      } else {
        const shouldRefreshSeek =
          Math.random() < ENEMY_TRACK_UPDATE_CHANCE ||
          (enemy.seekDirectionX === 0 && enemy.seekDirectionY === 1)
        if (trackingTarget && shouldRefreshSeek) {
          const seekLength = Math.hypot(playerDeltaX, playerDeltaY) || 1
          enemy.seekDirectionX = playerDeltaX / seekLength
          enemy.seekDirectionY = playerDeltaY / seekLength
        }
        const desiredDirectionX = enemy.seekDirectionX + separationX
        const desiredDirectionY = enemy.seekDirectionY + separationY
        const desiredLength = Math.hypot(desiredDirectionX, desiredDirectionY) || 1
        const desiredAngle = Math.atan2(
          desiredDirectionY / desiredLength,
          desiredDirectionX / desiredLength,
        )
        const currentAngle = Math.atan2(enemy.moveDirectionY, enemy.moveDirectionX)
        const angleDelta = normalizeAngleDelta(desiredAngle - currentAngle)
        const smoothedAngleDelta = angleDelta * ENEMY_TURN_SMOOTHING
        const maxTurnStep = ENEMY_MAX_TURN_RATE * deltaSeconds
        const nextAngle =
          currentAngle + Math.max(-maxTurnStep, Math.min(maxTurnStep, smoothedAngleDelta))
        enemy.moveDirectionX = Math.cos(nextAngle)
        enemy.moveDirectionY = Math.sin(nextAngle)
        deltaX = enemy.moveDirectionX
        deltaY = enemy.moveDirectionY
      }

      const length = enemy.commit ? 1 : Math.hypot(deltaX, deltaY) || 1
      const commitSpeed = ENEMY_SPEED * this.commitSpeedMultiplier
      const speed = enemy.commit ? commitSpeed : ENEMY_SPEED
      enemy.velocityX = (deltaX / length) * speed
      enemy.velocityY = (deltaY / length) * speed
      enemy.x += enemy.velocityX * deltaSeconds
      enemy.y += enemy.velocityY * deltaSeconds
      enemy.display.position.set(enemy.x, enemy.y)
      enemy.display.rotation = Math.atan2(enemy.velocityY, enemy.velocityX) - Math.PI * 0.5

      if (
        enemy.x < this.leftLimit ||
        enemy.x > this.rightLimit ||
        enemy.y < this.topLimit ||
        enemy.y > this.bottomLimit
      ) {
        enemy.health = 0
        enemy.hitbox.health = 0
        enemy.display.visible = false
        this.onEnemyDeath?.({
          id: enemy.id,
          x: enemy.x,
          y: enemy.y + enemy.hitboxCenterYOffset,
          reason: 'bottom',
        })
        return
      }

      enemy.hitbox.left = enemy.x - enemy.hitboxHalfWidth
      enemy.hitbox.right = enemy.x + enemy.hitboxHalfWidth
      enemy.hitbox.top = enemy.y - enemy.hitboxTopOffset
      enemy.hitbox.bottom = enemy.y + enemy.hitboxBottomOffset
      enemy.hitbox.centerX = enemy.x
      enemy.hitbox.centerY = enemy.y + enemy.hitboxCenterYOffset
      enemy.hitbox.health = enemy.health

      const playerBounds = seekTarget?.bounds
      const collidedWithPlayer =
        playerBounds &&
        enemy.hitbox.left <= playerBounds.right &&
        enemy.hitbox.right >= playerBounds.left &&
        enemy.hitbox.top <= playerBounds.bottom &&
        enemy.hitbox.bottom >= playerBounds.top

      if (collidedWithPlayer) {
        enemy.health = 0
        enemy.hitbox.health = 0
        enemy.display.visible = false
        this.onEnemyDeath?.({
          id: enemy.id,
          x: enemy.x,
          y: enemy.y + enemy.hitboxCenterYOffset,
          reason: 'explode',
        })
        onPlayerCollision({
          x: enemy.x,
          y: enemy.y + enemy.hitboxCenterYOffset,
          damage: ENEMY_CONTACT_DAMAGE,
        })
        return
      }

      enemy.runtime.updateAnimation(this.elapsedSeconds, speed / commitSpeed)
    })
  }

  destroy() {
    this.enemies.forEach((enemy) => {
      enemy.display.destroy({ children: true })
    })
    this.enemies.length = 0
    this.hitboxes.length = 0
  }

  isFinished() {
    return this.enemies.length > 0 && this.enemies.every((enemy) => enemy.health <= 0)
  }
}
