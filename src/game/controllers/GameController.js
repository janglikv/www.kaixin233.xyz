import * as PIXI from 'pixi.js'
import { createBulletSystem } from '../effects/createBulletSystem'
import { createExhaustSwitcher } from '../effects/createExhaustSwitcher'
import { createEnemyBulletSystem } from '../effects/createEnemyBulletSystem'
import { createHomingBurstSystem } from '../effects/createHomingBurstSystem'
import { createImpactEffectSystem } from '../effects/createImpactEffectSystem'
import { createDebugPanel } from '../renderers/createDebugPanel'
import { createPlayerHealthBar } from '../renderers/createPlayerHealthBar'
import { createShipScene } from '../renderers/createShipScene'
import { createSpaceBackdrop } from '../renderers/createSpaceBackdrop'
import { createStatsPanel } from '../renderers/createStatsPanel'
import { createKeyboardController } from '../utils/createKeyboardController'
import { createPointerController } from '../utils/createPointerController'

const LOGICAL_WIDTH = 1280
const LOGICAL_HEIGHT = 720
const SHIP_SCALE = 0.42
const EFFECT_SCALE = 0.5
const SHIP_THRUST_DISTANCE = 76 * SHIP_SCALE
const SHIP_MUZZLE_OFFSET = 58 * SHIP_SCALE
const SHIP_MOVE_SPEED = 260
const SHIP_BOUND_HALF_WIDTH = 46 * SHIP_SCALE
const SHIP_BOUND_HALF_HEIGHT = 64 * SHIP_SCALE
const WORLD_INSET = 0
const WORLD_RADIUS = 0
const ENEMY_COLUMNS = 12
const ENEMY_ROWS = 3
const ENEMY_SCALE = 0.3
const ENEMY_TOP = 92
const ENEMY_ROW_GAP = 72
const ENEMY_SIDE_MARGIN = 72
const ENEMY_MAX_HEALTH = 100
const PLAYER_MAX_HEALTH = 100
const ENEMY_ATTACK_SPEED = 2
const ENEMY_BULLET_DAMAGE = 5
const PLAYER_STATS = {
  attackPower: 1,
  attackSpeed: 11.5,
  critChance: 1,
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const createEnemyHealthBar = (PIXI) => {
  const container = new PIXI.Container()
  const frame = new PIXI.Graphics()
  const fill = new PIXI.Graphics()

  frame
    .roundRect(-24, -4, 48, 8, 4)
    .fill({ color: 0x071127, alpha: 0.82 })
    .stroke({ color: 0x5f7ca9, width: 1.5, alpha: 0.95 })

  container.addChild(frame)
  container.addChild(fill)

  return {
    container,
    update(healthRatio) {
      const width = Math.max(0, Math.min(1, healthRatio)) * 44
      fill.clear()
      fill
        .roundRect(-22, -2, width, 4, 2)
        .fill({
          color: healthRatio > 0.55 ? 0x5fffb2 : healthRatio > 0.25 ? 0xffc857 : 0xff5d73,
          alpha: 0.95,
        })
    },
  }
}

const createEnemyFormation = ({ PIXI, parent }) => {
  const enemies = []
  const spacing = (LOGICAL_WIDTH - ENEMY_SIDE_MARGIN * 2) / (ENEMY_COLUMNS - 1)
  const getAliveEnemies = () => enemies.filter((enemy) => enemy.health > 0)

  for (let row = 0; row < ENEMY_ROWS; row += 1) {
    for (let column = 0; column < ENEMY_COLUMNS; column += 1) {
      const enemyId = row * ENEMY_COLUMNS + column
      const scene = createShipScene({
        x: ENEMY_SIDE_MARGIN + spacing * column,
        y: ENEMY_TOP + ENEMY_ROW_GAP * row,
        shipScale: ENEMY_SCALE,
        shipRotation: Math.PI,
      })
      const exhaustSwitcher = createExhaustSwitcher({
        PIXI,
        runtimeLayer: scene.runtimeLayer,
        initialIndex: Math.floor(Math.random() * 9999),
      })
      const healthBar = createEnemyHealthBar(PIXI)

      parent.addChild(scene.shipGroup)
      parent.addChild(healthBar.container)
      enemies.push({
        id: enemyId,
        health: ENEMY_MAX_HEALTH,
        scene,
        exhaustSwitcher,
        healthBar,
        pulseOffset: enemyId * 0.35,
      })
    }
  }

  return {
    getHitboxes() {
      return getAliveEnemies().map((enemy) => ({
        left: enemy.scene.shipX - 24,
        right: enemy.scene.shipX + 24,
        top: enemy.scene.shipY - 30,
        bottom: enemy.scene.shipY + 28,
        id: enemy.id,
        centerX: enemy.scene.shipX,
        centerY: enemy.scene.shipY + 8,
        health: enemy.health,
      }))
    },
    getShooters() {
      return getAliveEnemies().map((enemy) => ({
        id: enemy.id,
        x: enemy.scene.shipX,
        y: enemy.scene.shipY + 26,
      }))
    },
    applyDamage(enemyId, damage) {
      const enemy = enemies.find((item) => item.id === enemyId)
      if (!enemy || enemy.health <= 0) {
        return null
      }

      enemy.health = Math.max(0, enemy.health - damage)
      const alive = enemy.health > 0
      enemy.scene.shipGroup.visible = alive
      enemy.healthBar.container.visible = alive
      enemy.healthBar.update(enemy.health / ENEMY_MAX_HEALTH)

      return {
        id: enemy.id,
        alive,
        health: enemy.health,
        x: enemy.scene.shipX,
        y: enemy.scene.shipY + 8,
      }
    },
    update(deltaSeconds, elapsedSeconds) {
      getAliveEnemies().forEach((enemy) => {
        const pulse = 0.82 + Math.sin(elapsedSeconds * 10 + enemy.pulseOffset) * 0.18
        enemy.healthBar.container.position.set(enemy.scene.shipX, enemy.scene.shipY - 40)
        enemy.healthBar.update(enemy.health / ENEMY_MAX_HEALTH)

        enemy.scene.flameGlow.scale.set(0.94 + pulse * 0.18, 0.86 + pulse * 0.12)
        enemy.scene.flameCore.scale.set(0.92 + pulse * 0.4, 0.8 + pulse * 0.26)
        enemy.scene.flameInner.scale.set(0.84 + pulse * 0.26, 0.74 + pulse * 0.18)
        enemy.scene.flameGlow.alpha = 0.24 + pulse * 0.08
        enemy.scene.flameCore.alpha = 0.46 + pulse * 0.14
        enemy.scene.flameInner.alpha = 0.2 + pulse * 0.1

        enemy.exhaustSwitcher.update(deltaSeconds, elapsedSeconds, {
          originX: enemy.scene.shipX,
          originY: enemy.scene.shipY - SHIP_THRUST_DISTANCE,
          directionX: 0,
          directionY: 1,
          pulse,
          scale: EFFECT_SCALE,
        })
      })
    },
    destroy() {
      enemies.forEach((enemy) => {
        enemy.exhaustSwitcher.destroy()
        enemy.healthBar.container.destroy({ children: true })
      })
    },
  }
}

export class GameController {
  constructor(container, options = {}) {
    this.container = container
    this.pluginIndex = options.pluginIndex ?? 0
    this.app = null
    this.cleanupFn = null
    this.started = false
    this.destroyed = false
  }

  async start() {
    if (this.started || !this.container) return

    this.started = true
    this.destroyed = false

    let disposed = false
    let initialized = false

    const app = new PIXI.Application()
    this.app = app

    await app.init({
      background: '#000000',
      antialias: true,
      resizeTo: this.container,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    initialized = true
    if (disposed || this.destroyed || !this.container) {
      app.destroy(true, { children: true })
      return
    }

    this.container.appendChild(app.canvas)

    const gameLayer = new PIXI.Container()
    app.stage.addChild(gameLayer)
    let layoutScale = 1
    let layoutOffsetX = 0
    let layoutOffsetY = 0

    const worldLayer = new PIXI.Container()
    const worldMask = new PIXI.Graphics()
    const playerHealth = {
      current: PLAYER_MAX_HEALTH,
      max: PLAYER_MAX_HEALTH,
    }
    const playerStats = { ...PLAYER_STATS }
    worldMask
      .roundRect(
        WORLD_INSET,
        WORLD_INSET,
        LOGICAL_WIDTH - WORLD_INSET * 2,
        LOGICAL_HEIGHT - WORLD_INSET * 2,
        WORLD_RADIUS,
      )
      .fill(0xffffff)
    worldLayer.mask = worldMask

    worldLayer.addChild(
      createSpaceBackdrop({
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
      }),
    )

    const shipScene = createShipScene({
      x: LOGICAL_WIDTH * 0.5,
      y: LOGICAL_HEIGHT * 0.72,
      shipScale: SHIP_SCALE,
    })
    const enemyFormation = createEnemyFormation({
      PIXI,
      parent: worldLayer,
    })
    const impactEffectSystem = createImpactEffectSystem(worldLayer)
    const enemyBulletSystem = createEnemyBulletSystem(worldLayer, {
      onHit: ({ x, y }) => {
        playerHealth.current = Math.max(0, playerHealth.current - ENEMY_BULLET_DAMAGE)
        playerHealthBar.update(playerHealth.current, playerHealth.max)
        impactEffectSystem.spawn(x, y, { scale: 0.95 })
      },
    })
    const homingBurstSystem = createHomingBurstSystem({
      parent: worldLayer,
      onImpact: ({ x, y, target }) => {
        const isCrit = Math.random() < playerStats.critChance
        enemyFormation.applyDamage(target.id, playerStats.attackPower * (isCrit ? 2 : 1))
        impactEffectSystem.spawn(x, y, { scale: isCrit ? 1.65 : 1.15 })
        return isCrit
      },
    })
    const bulletSystem = createBulletSystem(worldLayer, {
      onHit: ({ x, y, target }) => {
        const isCrit = Math.random() < playerStats.critChance
        const damage = playerStats.attackPower * (isCrit ? 2 : 1)
        const damagedEnemy = enemyFormation.applyDamage(target.id, damage)

        impactEffectSystem.spawn(x, y, {
          scale: isCrit ? 1.7 : 1 + damage / 80,
        })
        if (!isCrit || !damagedEnemy?.alive) return

        homingBurstSystem.spawnPair({
          x: shipScene.shipX,
          y: shipScene.shipY - SHIP_MUZZLE_OFFSET,
          target: {
            id: damagedEnemy.id,
            x: damagedEnemy.x,
            y: damagedEnemy.y,
          },
          finalTarget: {
            x: shipScene.shipX,
            y: -120,
          },
          getTargets: () =>
            enemyFormation.getHitboxes().map((enemy) => ({
              id: enemy.id,
              x: enemy.centerX,
              y: enemy.centerY,
            })),
        })
      },
    })
    const keyboard = createKeyboardController()
    let debugBounds = null
    const pointer = createPointerController(app.canvas, {
      shouldStart: (event) => {
        const rect = app.canvas.getBoundingClientRect()
        const logicalX = (event.clientX - rect.left - layoutOffsetX) / layoutScale
        const logicalY = (event.clientY - rect.top - layoutOffsetY) / layoutScale

        return !(
          debugBounds &&
          logicalX >= debugBounds.left &&
          logicalX <= debugBounds.right &&
          logicalY >= debugBounds.top &&
          logicalY <= debugBounds.bottom
        )
      },
    })
    const exhaustSwitcher = createExhaustSwitcher({
      PIXI,
      runtimeLayer: shipScene.runtimeLayer,
      initialIndex: this.pluginIndex,
    })

    const statsPanel = createStatsPanel({
      x: LOGICAL_WIDTH - 18,
      y: LOGICAL_HEIGHT - 74,
      stats: playerStats,
    })
    const playerHealthBar = createPlayerHealthBar({
      x: LOGICAL_WIDTH * 0.5,
      y: LOGICAL_HEIGHT - 26,
      health: playerHealth.current,
      maxHealth: playerHealth.max,
    })
    const debugPanel = createDebugPanel({
      x: 14,
      y: LOGICAL_HEIGHT - 182,
      stats: playerStats,
      onFlameSwitch: () => {
        exhaustSwitcher.switchNext()
      },
      onChange: (index, direction) => {
        if (index === 0) {
          playerStats.attackPower = clamp(playerStats.attackPower + direction, 1, 999)
        }
        if (index === 1) {
          playerStats.attackSpeed = clamp(
            Math.round((playerStats.attackSpeed + direction * 0.5) * 10) / 10,
            1,
            30,
          )
        }
        if (index === 2) {
          playerStats.critChance = clamp(
            Math.round((playerStats.critChance + direction * 0.05) * 100) / 100,
            0,
            1,
          )
        }
        statsPanel.update(playerStats)
        debugPanel.update(playerStats)
      },
    })
    debugBounds = debugPanel.bounds
    worldLayer.addChild(shipScene.shipGroup)
    gameLayer.addChild(worldLayer)
    gameLayer.addChild(worldMask)
    gameLayer.addChild(debugPanel.container)
    gameLayer.addChild(playerHealthBar.container)
    gameLayer.addChild(statsPanel.container)

    let elapsedSeconds = 0

    const layout = () => {
      layoutScale = Math.min(
        app.renderer.width / LOGICAL_WIDTH,
        app.renderer.height / LOGICAL_HEIGHT,
      )
      layoutOffsetX = (app.renderer.width - LOGICAL_WIDTH * layoutScale) * 0.5
      layoutOffsetY = (app.renderer.height - LOGICAL_HEIGHT * layoutScale) * 0.5

      gameLayer.scale.set(layoutScale)
      gameLayer.position.set(layoutOffsetX, layoutOffsetY)
    }

    const tick = (ticker) => {
      const deltaSeconds = ticker.deltaMS / 1000
      elapsedSeconds += deltaSeconds
      const { horizontal, vertical } = keyboard.getAxis()
      const movementLength = Math.hypot(horizontal, vertical) || 1
      const velocityX = (horizontal / movementLength) * SHIP_MOVE_SPEED
      const velocityY = (vertical / movementLength) * SHIP_MOVE_SPEED
      const nextShipX = Math.max(
        WORLD_INSET + SHIP_BOUND_HALF_WIDTH,
        Math.min(
          LOGICAL_WIDTH - WORLD_INSET - SHIP_BOUND_HALF_WIDTH,
          shipScene.shipX + velocityX * deltaSeconds,
        ),
      )
      const nextShipY = Math.max(
        WORLD_INSET + SHIP_BOUND_HALF_HEIGHT,
        Math.min(
          LOGICAL_HEIGHT - WORLD_INSET - SHIP_BOUND_HALF_HEIGHT,
          shipScene.shipY + velocityY * deltaSeconds,
        ),
      )

      shipScene.setPosition(nextShipX, nextShipY)

      const pulse = 0.82 + Math.sin(elapsedSeconds * 14) * 0.18

      shipScene.flameGlow.scale.set(0.94 + pulse * 0.18, 0.86 + pulse * 0.12)
      shipScene.flameCore.scale.set(0.92 + pulse * 0.4, 0.8 + pulse * 0.26)
      shipScene.flameInner.scale.set(0.84 + pulse * 0.26, 0.74 + pulse * 0.18)
      shipScene.flameGlow.alpha = 0.24 + pulse * 0.08
      shipScene.flameCore.alpha = 0.46 + pulse * 0.14
      shipScene.flameInner.alpha = 0.2 + pulse * 0.1

      exhaustSwitcher.update(deltaSeconds, elapsedSeconds, {
        originX: shipScene.shipX,
        originY: shipScene.shipY + SHIP_THRUST_DISTANCE,
        directionX: 0,
        directionY: -1,
        pulse,
        scale: EFFECT_SCALE,
      })
      enemyFormation.update(deltaSeconds, elapsedSeconds)
      enemyBulletSystem.update(deltaSeconds, {
        shooters: enemyFormation.getShooters(),
        fireInterval: 1 / ENEMY_ATTACK_SPEED,
        target: {
          left: shipScene.shipX - 22,
          right: shipScene.shipX + 22,
          top: shipScene.shipY - 34,
          bottom: shipScene.shipY + 28,
        },
      })
      bulletSystem.update(deltaSeconds, {
        shouldFire: pointer.isFiring(),
        originX: shipScene.shipX,
        originY: shipScene.shipY - SHIP_MUZZLE_OFFSET,
        targets: enemyFormation.getHitboxes(),
        fireInterval: 1 / playerStats.attackSpeed,
      })
      homingBurstSystem.update(deltaSeconds)
      impactEffectSystem.update(deltaSeconds)
    }

    app.renderer.on('resize', layout)
    app.ticker.add(tick)
    layout()

    this.cleanupFn = () => {
      if (disposed) return
      disposed = true

      if (this.app === app) {
        this.app = null
      }

      app.renderer.off('resize', layout)
      app.ticker.remove(tick)

      bulletSystem.destroy()
      enemyBulletSystem.destroy()
      homingBurstSystem.destroy()
      impactEffectSystem.destroy()
      enemyFormation.destroy()
      keyboard.destroy()
      pointer.destroy()
      exhaustSwitcher.destroy()

      if (initialized) {
        app.destroy(true, { children: true })
      }
    }
  }

  destroy() {
    this.destroyed = true
    this.started = false
    this.cleanupFn?.()
    this.cleanupFn = null
  }
}
