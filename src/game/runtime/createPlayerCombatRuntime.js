import { createBulletSystem } from '../effects/createBulletSystem'
import { createEnemyBulletSystem } from '../effects/createEnemyBulletSystem'
import { createExhaustSwitcher } from '../effects/createExhaustSwitcher'
import { createHomingBurstSystem } from '../effects/createHomingBurstSystem'
import { EXHAUST_PLUGINS } from '../effects/exhaustPlugins'
import { createShipScene } from '../renderers/createShipScene'
import { createEcsWorld, createEntity } from '../ecs/createEcsWorld'
import { ecsSystemRegistry } from '../ecs/ecsSystemRegistry'

const SHIP_SCALE = 0.42
const EFFECT_SCALE = 0.5
const SHIP_THRUST_DISTANCE = 76 * SHIP_SCALE
const SHIP_MUZZLE_OFFSET = 58 * SHIP_SCALE
const SHIP_MOVE_SPEED = 260
const SHIP_BOUND_HALF_WIDTH = 46 * SHIP_SCALE
const SHIP_BOUND_HALF_HEIGHT = 64 * SHIP_SCALE
const WORLD_INSET = 0
const ENEMY_ATTACK_SPEED = 1
const ENEMY_BULLET_DAMAGE = 5

const createGameplayWorld = ({ shipScene, width, height }) => {
  const world = createEcsWorld()
  const playerEntity = createEntity(world)

  world.components.position.set(playerEntity, {
    x: shipScene.shipX,
    y: shipScene.shipY,
  })
  world.components.bounds.set(playerEntity, {
    halfWidth: SHIP_BOUND_HALF_WIDTH,
    halfHeight: SHIP_BOUND_HALF_HEIGHT,
  })
  world.components.playerControlled.set(playerEntity, { tag: 'player' })
  world.links.shipScene.set(playerEntity, shipScene)

  return {
    syncPlayerRender() {
      const position = world.components.position.get(playerEntity)
      if (!position) return
      shipScene.setPosition(position.x, position.y)
    },
    getPlayerPosition() {
      return world.components.position.get(playerEntity)
    },
    updatePlayer(deltaSeconds, axis) {
      ecsSystemRegistry.playerMovementSystem(world, {
        deltaSeconds,
        axis,
        speed: SHIP_MOVE_SPEED,
        clampRect: {
          left: WORLD_INSET,
          right: width - WORLD_INSET,
          top: WORLD_INSET,
          bottom: height - WORLD_INSET,
        },
      })
      this.syncPlayerRender()
    },
  }
}

const getPulse = (elapsedSeconds) => 0.82 + Math.sin(elapsedSeconds * 14) * 0.18

export const clampExhaustIndex = (value) =>
  Math.max(0, Math.min(Number.isFinite(value) ? Math.floor(value) : 0, Math.max(0, EXHAUST_PLUGINS.length - 1)))

export const createPlayerCombatRuntime = ({
  PIXI,
  parent,
  width,
  height,
  renderer,
  audio,
  shipTheme,
  initialExhaustIndex = 0,
  initialStats,
  initialHealth,
  spawnImpact,
  getEnemyFormation,
  onHealthChange,
  onPlayerDepleted,
}) => {
  const stats = {
    attackPower: initialStats.attackPower,
    attackSpeed: initialStats.attackSpeed,
    critChance: initialStats.critChance,
    hasHomingBurst: initialStats.hasHomingBurst === true,
  }
  const health = {
    current: initialHealth.current,
    max: initialHealth.max,
  }
  const shipScene = createShipScene({
    x: width * 0.5,
    y: height * 0.72,
    shipScale: SHIP_SCALE,
    shipTheme,
  })
  const gameplayWorld = createGameplayWorld({ shipScene, width, height })
  const exhaustSwitcher = createExhaustSwitcher({
    PIXI,
    runtimeLayer: shipScene.runtimeLayer,
    initialIndex: initialExhaustIndex,
  })

  parent.addChild(shipScene.shipGroup)

  const applyIncomingDamage = ({ damage, x, y, impactOptions = null }) => {
    if (health.current <= 0 || damage <= 0) return
    health.current = Math.max(0, health.current - damage)
    onHealthChange?.(health.current, health.max)
    audio.playHit()
    if (impactOptions) {
      spawnImpact(x, y, impactOptions)
    }
    if (health.current <= 0) {
      onPlayerDepleted?.()
    }
  }

  const homingBurstSystem = createHomingBurstSystem({
    parent,
    onSpawn: () => {
      audio.playHomingLaunch()
    },
    onImpact: ({ x, y, targetId, target }) => {
      const enemyFormation = getEnemyFormation()
      const isCrit = Math.random() < stats.critChance
      const damagedEnemy =
        targetId == null ? null : enemyFormation.applyDamage(targetId, stats.attackPower * (isCrit ? 2 : 1))

      audio.playExplosion({ large: damagedEnemy?.died === true })
      if (target) {
        audio.playHit({ crit: isCrit })
      }
      spawnImpact(x, y, {
        scale: damagedEnemy?.died ? 0.74 : isCrit ? 0.56 : 0.34,
        flashOuterColor: 0xff8a5b,
        flashInnerColor: 0xffe0b2,
        sparkColors: [0xff6b35, 0xff9f68, 0xffd166],
      })
      if (damagedEnemy?.died) {
        spawnImpact(damagedEnemy.x, damagedEnemy.y, {
          scale: 2.7,
          flashOuterColor: 0xff5a36,
          flashInnerColor: 0xffd0a8,
          sparkColors: [0xff3b30, 0xff7b54, 0xffb347],
        })
      }
      return isCrit
    },
  })

  const bulletSystem = createBulletSystem(parent, {
    renderer,
    onFire: () => {
      audio.playPlayerShot()
    },
    onHit: ({ x, y, target }) => {
      const enemyFormation = getEnemyFormation()
      const isCrit = Math.random() < stats.critChance
      const damage = stats.attackPower * (isCrit ? 2 : 1)
      const damagedEnemy = enemyFormation.applyDamage(target.id, damage)

      audio.playHit({ crit: isCrit })
      spawnImpact(x, y, {
        scale: isCrit ? 0.62 : 0.28 + damage / 260,
      })
      if (damagedEnemy?.died) {
        audio.playExplosion({ large: true })
        spawnImpact(damagedEnemy.x, damagedEnemy.y, {
          scale: 2.7,
          flashOuterColor: 0xff5a36,
          flashInnerColor: 0xffd0a8,
          sparkColors: [0xff3b30, 0xff7b54, 0xffb347],
        })
      }
      if (!isCrit || !stats.hasHomingBurst || !damagedEnemy) return

      const homingEnemyFormation = getEnemyFormation()
      homingBurstSystem.spawnBurst({
        x: shipScene.shipX,
        y: shipScene.shipY,
        targets: [
          {
            id: damagedEnemy.id,
            x: damagedEnemy.x,
            y: damagedEnemy.y,
          },
        ],
        getTargets: () => homingEnemyFormation.getHitboxes(),
      })
    },
  })

  const enemyBulletSystem = createEnemyBulletSystem(parent, {
    renderer,
    onFire: () => {
      audio.playEnemyShot()
    },
    onHit: ({ x, y }) => {
      applyIncomingDamage({
        damage: ENEMY_BULLET_DAMAGE,
        x,
        y,
        impactOptions: { scale: 0.5 },
      })
    },
  })

  parent.setChildIndex(shipScene.shipGroup, parent.children.length - 1)

  return {
    getPosition() {
      const playerPosition = gameplayWorld.getPlayerPosition()
      return {
        x: playerPosition?.x ?? shipScene.shipX,
        y: playerPosition?.y ?? shipScene.shipY,
      }
    },
    getTargetBounds() {
      const { x, y } = this.getPosition()
      return {
        left: x - 22,
        right: x + 22,
        top: y - 34,
        bottom: y + 28,
      }
    },
    getStats() {
      return stats
    },
    getHealth() {
      return health
    },
    setShipVisible(visible) {
      shipScene.shipGroup.visible = visible
    },
    setExhaustIndex(nextIndex) {
      exhaustSwitcher.setIndex(nextIndex)
    },
    syncSettings({ attackPower, attackSpeed, critChance, exhaustIndex, hasHomingBurst }) {
      stats.attackPower = attackPower
      stats.attackSpeed = attackSpeed
      stats.critChance = critChance
      stats.hasHomingBurst = hasHomingBurst === true
      exhaustSwitcher.setIndex(exhaustIndex)
    },
    applyIncomingDamage,
    update(deltaSeconds, elapsedSeconds, { axis, shouldFire, gameOver }) {
      gameplayWorld.updatePlayer(deltaSeconds, axis)
      const { x, y } = this.getPosition()
      const pulse = getPulse(elapsedSeconds)

      shipScene.flameGlow.scale.set(0.94 + pulse * 0.18, 0.86 + pulse * 0.12)
      shipScene.flameCore.scale.set(0.92 + pulse * 0.4, 0.8 + pulse * 0.26)
      shipScene.flameInner.scale.set(0.84 + pulse * 0.26, 0.74 + pulse * 0.18)
      shipScene.flameGlow.alpha = 0.24 + pulse * 0.08
      shipScene.flameCore.alpha = 0.46 + pulse * 0.14
      shipScene.flameInner.alpha = 0.2 + pulse * 0.1

      if (!gameOver) {
        exhaustSwitcher.update(deltaSeconds, elapsedSeconds, {
          originX: x,
          originY: y + SHIP_THRUST_DISTANCE,
          directionX: 0,
          directionY: -1,
          pulse,
          scale: EFFECT_SCALE,
        })
      }

      const enemyFormation = getEnemyFormation()
      enemyBulletSystem.update(deltaSeconds, {
        shooters: enemyFormation.getShooters(),
        fireInterval: 1 / ENEMY_ATTACK_SPEED,
        target: gameOver ? null : this.getTargetBounds(),
      })
      bulletSystem.update(deltaSeconds, {
        shouldFire: !gameOver && shouldFire,
        originX: x,
        originY: y,
        targets: enemyFormation.getHitboxes(),
        fireInterval: 1 / stats.attackSpeed,
      })
      homingBurstSystem.update(deltaSeconds)
    },
    destroy() {
      bulletSystem.destroy()
      enemyBulletSystem.destroy()
      homingBurstSystem.destroy()
      exhaustSwitcher.destroy()
      shipScene.shipGroup.destroy({ children: true })
    },
  }
}
