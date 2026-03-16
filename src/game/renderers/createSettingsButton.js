import * as PIXI from 'pixi.js'

const BUTTON_SIZE = 34

export const createSettingsButton = ({ x, y, onTap }) => {
  const container = new PIXI.Container()
  container.position.set(x, y)
  container.eventMode = 'static'
  container.cursor = 'pointer'

  const bg = new PIXI.Graphics()
  const icon = new PIXI.Graphics()

  const draw = (hovered = false) => {
    bg
      .clear()
      .roundRect(0, 0, BUTTON_SIZE, BUTTON_SIZE, 10)
      .fill({
        color: hovered ? 0x15325f : 0x0a1836,
        alpha: 0.94,
      })
      .stroke({
        color: hovered ? 0x7fcfff : 0x48638f,
        width: 2,
        alpha: 0.95,
      })
  }

  icon
    .circle(17, 17, 5)
    .stroke({ color: 0xe9f4ff, width: 2.2, alpha: 0.95 })
    .circle(17, 17, 10)
    .stroke({ color: 0xe9f4ff, width: 1.8, alpha: 0.35 })

  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI * 2 * index) / 6
    const inner = 10.5
    const outer = 13.5
    icon
      .moveTo(17 + Math.cos(angle) * inner, 17 + Math.sin(angle) * inner)
      .lineTo(17 + Math.cos(angle) * outer, 17 + Math.sin(angle) * outer)
      .stroke({ color: 0xe9f4ff, width: 2, alpha: 0.92 })
  }

  draw(false)
  container.addChild(bg)
  container.addChild(icon)
  container.on('pointertap', onTap)
  container.on('pointerover', () => draw(true))
  container.on('pointerout', () => draw(false))

  return {
    container,
    bounds: {
      left: x,
      top: y,
      right: x + BUTTON_SIZE,
      bottom: y + BUTTON_SIZE,
    },
  }
}
