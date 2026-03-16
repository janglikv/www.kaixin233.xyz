import * as PIXI from 'pixi.js'
import { createShip } from './createShip'

export const createShipScene = ({
  x,
  y,
  shipScale,
  shipRotation = 0,
  shipTheme,
  showFlame = true,
  cacheAsTexture = false,
}) => {
  const shipGroup = new PIXI.Container()
  const runtimeLayer = new PIXI.Container()
  const { ship, flameGlow, flameCore, flameInner } = createShip(shipTheme)
  let shipX = x
  let shipY = y

  ship.position.set(shipX, shipY)
  ship.scale.set(shipScale)
  ship.rotation = shipRotation
  flameGlow.visible = showFlame
  flameCore.visible = showFlame
  flameInner.visible = showFlame

  if (cacheAsTexture && typeof ship.cacheAsTexture === 'function') {
    ship.cacheAsTexture(true)
  }

  shipGroup.addChild(runtimeLayer)
  shipGroup.addChild(ship)

  return {
    shipGroup,
    runtimeLayer,
    get shipX() {
      return shipX
    },
    get shipY() {
      return shipY
    },
    setPosition(nextX, nextY) {
      shipX = nextX
      shipY = nextY
      ship.position.set(shipX, shipY)
    },
    flameGlow,
    flameCore,
    flameInner,
  }
}
