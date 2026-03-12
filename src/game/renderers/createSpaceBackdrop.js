import * as PIXI from 'pixi.js'

export const createSpaceBackdrop = ({ width, height }) => {
  const backdrop = new PIXI.Container()

  const background = new PIXI.Graphics()
  background.rect(0, 0, width, height).fill(0x0b1020)
  background.circle(width * 0.2, height * 0.24, 220).fill({
    color: 0x1e2d6d,
    alpha: 0.18,
  })
  background.circle(width * 0.82, height * 0.22, 210).fill({
    color: 0x5d2248,
    alpha: 0.12,
  })
  background.circle(width * 0.5, height * 0.82, 260).fill({
    color: 0x143848,
    alpha: 0.1,
  })
  backdrop.addChild(background)

  const starfield = new PIXI.Graphics()
  for (let index = 0; index < 140; index += 1) {
    const x = ((index * 197) % width) + ((index % 7) - 3) * 4
    const y = ((index * 149) % height) + ((index % 5) - 2) * 5
    const radius = index % 9 === 0 ? 2 : 1.1
    const alpha = 0.14 + (index % 6) * 0.08
    starfield.circle(x, y, radius).fill({ color: 0xffffff, alpha })
  }
  backdrop.addChild(starfield)

  return backdrop
}
