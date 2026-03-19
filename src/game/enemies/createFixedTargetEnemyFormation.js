import * as PIXI from 'pixi.js'
import { getEnemyCatalogEntryByPluginIndex } from '../data/shipCatalog'
import { createShip } from '../renderers/createShip'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../runtime/gameConfig'

const TARGET_THEME_INDEX = 3
const TARGET_SCALE = 0.34
const TARGET_X = LOGICAL_WIDTH * 0.5
const TARGET_Y = LOGICAL_HEIGHT * 0.24
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
  const sprite = new PIXI.Sprite(enemySpriteAsset.texture)
  sprite.anchor.set(enemySpriteAsset.anchorX, enemySpriteAsset.anchorY)
  sprite.position.set(TARGET_X, TARGET_Y)
  parent.addChild(sprite)

  const hitbox = {
    left: TARGET_X - TARGET_HITBOX_HALF_WIDTH,
    right: TARGET_X + TARGET_HITBOX_HALF_WIDTH,
    top: TARGET_Y - TARGET_HITBOX_TOP_OFFSET,
    bottom: TARGET_Y + TARGET_HITBOX_BOTTOM_OFFSET,
    id: 'fixed-target',
    centerX: TARGET_X,
    centerY: TARGET_Y + TARGET_HITBOX_CENTER_Y_OFFSET,
    health: Number.POSITIVE_INFINITY,
  }

  return {
    getHitboxes() {
      return [hitbox]
    },
    getShooters() {
      return []
    },
    applyDamage(enemyId) {
      if (enemyId !== hitbox.id) return null

      return {
        id: hitbox.id,
        alive: true,
        died: false,
        health: Number.POSITIVE_INFINITY,
        x: TARGET_X,
        y: TARGET_Y + TARGET_HITBOX_CENTER_Y_OFFSET,
      }
    },
    update() {},
    destroy() {
      enemySpriteAsset.texture.destroy(true)
      sprite.destroy()
    },
  }
}
