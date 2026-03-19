import * as PIXI from 'pixi.js'
import { getEnemyCatalogEntryByPluginIndex } from '../data/shipCatalog'
import { createShip } from '../renderers/createShip'
import { createEcsWorld, createEntity, queryEntities } from '../ecs/createEcsWorld'
import { ecsSystemRegistry } from '../ecs/ecsSystemRegistry'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../runtime/gameConfig'

const TEST_ENEMY_COLUMNS = 72
const TEST_ENEMY_ROWS = 40
const TEST_ENEMY_THEME_INDEX = 3
const TEST_ENEMY_SCALE = 0.11
const TEST_ENEMY_HEALTH = 1
const TEST_ENEMY_COLLISION_RADIUS = 14
const TEST_ENEMY_TOP_Y = -72
const TEST_ENEMY_GAP_Y = 28
const TEST_ENEMY_STAGGER_Y = TEST_ENEMY_GAP_Y * 0.5
const TEST_ENEMY_SPEED_Y = 196
const TEST_ENEMY_SIDE_PADDING = 8
const TEST_ENEMY_RECYCLE_BUFFER = 120

const createEnemySpriteAsset = ({ renderer, shipTheme }) => {
  const { ship, flameGlow, flameCore, flameInner } = createShip(shipTheme)

  flameGlow.visible = false
  flameCore.visible = false
  flameInner.visible = false
  ship.rotation = Math.PI
  ship.scale.set(TEST_ENEMY_SCALE)

  const bounds = ship.getLocalBounds()
  ship.position.set(-bounds.x, -bounds.y)

  const wrapper = new PIXI.Container()
  wrapper.addChild(ship)

  return {
    texture: renderer.generateTexture(wrapper),
    anchorX: -bounds.x / bounds.width,
    anchorY: -bounds.y / bounds.height,
  }
}

export const createPressureTestEnemyFormation = ({ renderer, parent }) => {
  const world = createEcsWorld()
  const activeHitboxes = []
  const enemyCatalogEntry = getEnemyCatalogEntryByPluginIndex(TEST_ENEMY_THEME_INDEX)
  const enemySpriteAsset = createEnemySpriteAsset({
    renderer,
    shipTheme: enemyCatalogEntry.theme,
  })
  const columnSpacing =
    TEST_ENEMY_COLUMNS > 1
      ? (LOGICAL_WIDTH - TEST_ENEMY_SIDE_PADDING * 2) / (TEST_ENEMY_COLUMNS - 1)
      : 0
  const recycleSpan = TEST_ENEMY_ROWS * TEST_ENEMY_GAP_Y
  const bottomLimit = LOGICAL_HEIGHT + TEST_ENEMY_RECYCLE_BUFFER

  const syncEnemySprite = (entityId) => {
    const position = world.components.position.get(entityId)
    const sprite = world.links.sprite.get(entityId)
    if (!position || !sprite) return
    sprite.position.set(position.x, position.y)
  }

  const recycleEnemy = (entityId, steps = 1) => {
    const position = world.components.position.get(entityId)
    const health = world.components.health.get(entityId)
    const recycle = world.components.recycle.get(entityId)
    const sprite = world.links.sprite.get(entityId)
    const hitbox = world.components.hitbox.get(entityId)
    const enemy = world.components.enemy.get(entityId)

    if (!position || !health || !recycle || !sprite || !hitbox || !enemy) return

    health.current = recycle.resetHealth
    position.y -= recycle.spanY * steps
    sprite.visible = true
    hitbox.left = position.x - enemy.hitboxHalfWidth
    hitbox.right = position.x + enemy.hitboxHalfWidth
    hitbox.top = position.y - enemy.hitboxTopOffset
    hitbox.bottom = position.y + enemy.hitboxBottomOffset
    hitbox.centerX = position.x
    hitbox.centerY = position.y + enemy.hitboxCenterYOffset
    hitbox.health = health.current
  }

  for (let rowIndex = 0; rowIndex < TEST_ENEMY_ROWS; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < TEST_ENEMY_COLUMNS; columnIndex += 1) {
      const x = TEST_ENEMY_SIDE_PADDING + columnIndex * columnSpacing
      const y =
        TEST_ENEMY_TOP_Y -
        rowIndex * TEST_ENEMY_GAP_Y +
        (columnIndex % 2 === 0 ? 0 : TEST_ENEMY_STAGGER_Y)
      const enemyId = createEntity(world)
      const sprite = new PIXI.Sprite(enemySpriteAsset.texture)
      sprite.anchor.set(enemySpriteAsset.anchorX, enemySpriteAsset.anchorY)
      sprite.position.set(x, y)

      parent.addChild(sprite)
      const hitbox = {
        left: x - 24,
        right: x + 24,
        top: y - 30,
        bottom: y + 28,
        id: enemyId,
        centerX: x,
        centerY: y + 8,
        health: TEST_ENEMY_HEALTH,
      }
      world.components.position.set(enemyId, { x, y })
      world.components.velocity.set(enemyId, { x: 0, y: TEST_ENEMY_SPEED_Y })
      world.components.health.set(enemyId, { current: TEST_ENEMY_HEALTH })
      world.components.recycle.set(enemyId, { spanY: recycleSpan, resetHealth: TEST_ENEMY_HEALTH })
      world.components.enemy.set(enemyId, {
        id: enemyId,
        columnIndex,
        collisionRadius: TEST_ENEMY_COLLISION_RADIUS,
        hitboxHalfWidth: 24,
        hitboxTopOffset: 30,
        hitboxBottomOffset: 28,
        hitboxCenterYOffset: 8,
      })
      world.components.hitbox.set(enemyId, hitbox)
      world.links.sprite.set(enemyId, sprite)
      syncEnemySprite(enemyId)
      hitbox.health = TEST_ENEMY_HEALTH
      activeHitboxes.push(hitbox)
    }
  }

  const findEnemyEntity = (enemyId) =>
    queryEntities(world, ['enemy']).find((entityId) => world.components.enemy.get(entityId)?.id === enemyId)

  return {
    getHitboxes() {
      activeHitboxes.length = 0
      queryEntities(world, ['enemy', 'health', 'hitbox']).forEach((entityId) => {
        const health = world.components.health.get(entityId)
        const hitbox = world.components.hitbox.get(entityId)
        if (health?.current > 0 && hitbox) {
          activeHitboxes.push(hitbox)
        }
      })
      return activeHitboxes
    },
    getShooters() {
      return []
    },
    applyDamage(enemyId, damage) {
      const entityId = findEnemyEntity(enemyId)
      if (!entityId) return null

      const enemy = world.components.enemy.get(entityId)
      const position = world.components.position.get(entityId)
      const health = world.components.health.get(entityId)
      const hitbox = world.components.hitbox.get(entityId)
      const sprite = world.links.sprite.get(entityId)

      if (!enemy || !position || !health || !hitbox || !sprite || health.current <= 0) {
        return null
      }

      const previousHealth = health.current
      health.current = Math.max(0, health.current - damage)
      hitbox.health = health.current
      const alive = health.current > 0
      const died = previousHealth > 0 && !alive
      if (died) {
        sprite.visible = false
      }

      const hitResult = {
        id: enemy.id,
        alive,
        died,
        health: health.current,
        x: position.x,
        y: position.y + enemy.hitboxCenterYOffset,
      }

      if (died) {
        recycleEnemy(entityId)
        syncEnemySprite(entityId)
      }

      return hitResult
    },
    update(deltaSeconds) {
      ecsSystemRegistry.enemyFormationSystem(world, {
        deltaSeconds,
        bottomLimit,
      })
      queryEntities(world, ['position']).forEach((entityId) => {
        syncEnemySprite(entityId)
      })
    },
    destroy() {
      enemySpriteAsset.texture.destroy(true)
    },
  }
}
