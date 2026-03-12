import * as PIXI from 'pixi.js'
import { createShip } from './createShip'

export const createShipScene = ({ x, y, shipScale }) => {
  const shipGroup = new PIXI.Container()
  const laneGlow = new PIXI.Graphics()
  const runtimeLayer = new PIXI.Container()
  const { ship, flameGlow, flameCore, flameInner } = createShip()
  let shipX = x
  let shipY = y

  laneGlow.circle(0, 0, 168).fill({
    color: 0x233f7d,
    alpha: 0.1,
  })
  laneGlow.ellipse(0, 186, 88, 28).fill({
    color: 0x7fd6ff,
    alpha: 0.06,
  })

  ship.position.set(shipX, shipY)
  ship.scale.set(shipScale)

  shipGroup.addChild(laneGlow)
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
