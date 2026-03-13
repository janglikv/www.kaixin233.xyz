import * as PIXI from 'pixi.js'

const DEFAULT_BAR_WIDTH = 440
const BAR_HEIGHT = 22
const OUTER_PADDING = 3

export const createPlayerHealthBar = ({
  x,
  y,
  health,
  maxHealth,
  width = DEFAULT_BAR_WIDTH,
  align = 'center',
}) => {
  const container = new PIXI.Container()
  const shell = new PIXI.Graphics()
  const track = new PIXI.Graphics()
  const fill = new PIXI.Graphics()
  const gloss = new PIXI.Graphics()
  const text = new PIXI.Text({
    text: '',
    style: {
      fill: 0xf5fbff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 15,
      fontWeight: '700',
      align: 'center',
      stroke: { color: 0x08101f, width: 3, join: 'round' },
    },
  })

  container.position.set(x, y)
  const outerWidth = width
  const innerWidth = width - OUTER_PADDING * 2
  const shellLeft = align === 'right' ? -outerWidth : -outerWidth * 0.5
  const trackLeft = shellLeft + OUTER_PADDING
  const textX = align === 'right' ? -outerWidth * 0.5 : 0

  shell
    .roundRect(shellLeft, -BAR_HEIGHT * 0.5 - OUTER_PADDING, outerWidth, BAR_HEIGHT + OUTER_PADDING * 2, 7)
    .fill({ color: 0x040814, alpha: 0.94 })
    .stroke({ color: 0x48638f, width: 2, alpha: 0.95 })

  track
    .roundRect(trackLeft, -BAR_HEIGHT * 0.5, innerWidth, BAR_HEIGHT, 5)
    .fill({ color: 0x091226, alpha: 0.98 })

  container.addChild(shell)
  container.addChild(track)
  container.addChild(fill)
  container.addChild(gloss)

  text.anchor.set(0.5)
  text.position.set(textX, 0)
  container.addChild(text)

  const update = (nextHealth, nextMaxHealth = maxHealth) => {
    const ratio = Math.max(0, Math.min(1, nextHealth / nextMaxHealth))
    const fillWidth = innerWidth * ratio
    const barColor = ratio > 0.55 ? 0x43d17f : ratio > 0.25 ? 0xf0b64a : 0xe14d67

    fill.clear()
    gloss.clear()

    if (fillWidth > 0) {
      fill
        .roundRect(trackLeft, -BAR_HEIGHT * 0.5, fillWidth, BAR_HEIGHT, 5)
        .fill({ color: barColor, alpha: 0.98 })
      gloss
        .roundRect(trackLeft + 3, -BAR_HEIGHT * 0.5 + 3, Math.max(0, fillWidth - 6), 6, 3)
        .fill({ color: 0xffffff, alpha: 0.16 })
    }

    text.text = `${Math.ceil(nextHealth)}`
  }

  update(health, maxHealth)

  return {
    container,
    update,
  }
}
