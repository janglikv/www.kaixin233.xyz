import * as PIXI from 'pixi.js'

export const createFlameSwitchButton = ({ x, y, onTap }) => {
  const button = new PIXI.Container()
  const background = new PIXI.Graphics()
  const flameIcon = new PIXI.Graphics()

  const drawBackground = (hovered = false) => {
    background
      .clear()
      .roundRect(0, 0, 56, 56, 14)
      .fill({
        color: hovered ? 0x102347 : 0x0a1836,
        alpha: 0.88,
      })
      .stroke({
        color: hovered ? 0x7fcfff : 0x48638f,
        width: 2,
        alpha: 0.95,
      })
  }

  flameIcon
    .poly([
      28, 12,
      38, 23,
      36, 34,
      28, 44,
      20, 34,
      18, 23,
    ])
    .fill({ color: 0xff7a2f, alpha: 0.95 })
  flameIcon
    .poly([
      28, 20,
      33, 27,
      32, 33,
      28, 38,
      24, 33,
      23, 27,
    ])
    .fill({ color: 0xffd166, alpha: 0.96 })
  flameIcon.blendMode = 'add'

  drawBackground(false)
  button.position.set(x, y)
  button.eventMode = 'static'
  button.cursor = 'pointer'
  button.addChild(background)
  button.addChild(flameIcon)

  button.on('pointertap', onTap)
  button.on('pointerover', () => {
    drawBackground(true)
  })
  button.on('pointerout', () => {
    drawBackground(false)
  })

  return button
}
