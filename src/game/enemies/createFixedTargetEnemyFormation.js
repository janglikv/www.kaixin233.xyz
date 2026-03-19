import * as PIXI from 'pixi.js'
import { getEnemyCatalogEntryByPluginIndex } from '../data/shipCatalog'
import { createShip } from '../renderers/createShip'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../runtime/gameConfig'

const TARGET_THEME_INDEX = 3
const TARGET_SCALE = 0.34
const TARGET_COUNT = 48
const TARGET_COLUMNS = 16
const TARGET_ROWS = 3
const TARGET_TOP_Y = LOGICAL_HEIGHT * 0.17
const TARGET_ROW_GAP = 72
const TARGET_ROW_WIDTH = LOGICAL_WIDTH * 0.82
const TARGET_START_X = (LOGICAL_WIDTH - TARGET_ROW_WIDTH) * 0.5
const TARGET_SPACING_X = TARGET_ROW_WIDTH / (TARGET_COLUMNS - 1)
const TARGET_HITBOX_HALF_WIDTH = 42
const TARGET_HITBOX_TOP_OFFSET = 52
const TARGET_HITBOX_BOTTOM_OFFSET = 44
const TARGET_HITBOX_CENTER_Y_OFFSET = 6

const createEnemySpriteAsset = ({ renderer, shipTheme }) => {
  const { ship, flameGlow, flameCore, flameInner } = createShip(shipTheme)

  flameGlow.visible = false
  flameCore.visible = false
  flameInner.visible = false
  ship.rotation = Math.PI
  ship.scale.set(TARGET_SCALE)

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

export const createFixedTargetEnemyFormation = ({ renderer, parent }) => {
  const enemyCatalogEntry = getEnemyCatalogEntryByPluginIndex(TARGET_THEME_INDEX)
  const enemySpriteAsset = createEnemySpriteAsset({
    renderer,
    shipTheme: enemyCatalogEntry.theme,
  })
  const layer = new PIXI.Container()
  const targets = Array.from({ length: TARGET_COUNT }, (_, index) => {
    const column = index % TARGET_COLUMNS
    const row = Math.floor(index / TARGET_COLUMNS) % TARGET_ROWS
    const rowOffset = row % 2 === 0 ? 0 : TARGET_SPACING_X * 0.5
    const x = TARGET_START_X + TARGET_SPACING_X * column + rowOffset
    const y = TARGET_TOP_Y + TARGET_ROW_GAP * row
    const sprite = new PIXI.Sprite(enemySpriteAsset.texture)
    sprite.anchor.set(enemySpriteAsset.anchorX, enemySpriteAsset.anchorY)
    sprite.position.set(x, y)
    layer.addChild(sprite)

    const hitbox = {
      left: x - TARGET_HITBOX_HALF_WIDTH,
      right: x + TARGET_HITBOX_HALF_WIDTH,
      top: y - TARGET_HITBOX_TOP_OFFSET,
      bottom: y + TARGET_HITBOX_BOTTOM_OFFSET,
      id: `fixed-target-${index}`,
      centerX: x,
      centerY: y + TARGET_HITBOX_CENTER_Y_OFFSET,
      health: Number.POSITIVE_INFINITY,
    }

    return { hitbox, sprite }
  })

  parent.addChild(layer)
  const hitboxes = targets.map((entry) => entry.hitbox)
  const hitboxById = new Map(targets.map((entry) => [entry.hitbox.id, entry.hitbox]))

  return {
    getHitboxes() {
      return hitboxes
    },
    getShooters() {
      return []
    },
    applyDamage(enemyId) {
      const hitbox = hitboxById.get(enemyId)
      if (!hitbox) return null

      return {
        id: hitbox.id,
        alive: true,
        died: false,
        health: Number.POSITIVE_INFINITY,
        x: hitbox.centerX,
        y: hitbox.centerY,
      }
    },
    update() {},
    destroy() {
      enemySpriteAsset.texture.destroy(true)
      layer.destroy({ children: true })
    },
  }
}
