import * as PIXI from 'pixi.js'

const BAR_WIDTH = 440
const BAR_HEIGHT = 22

export const createPlayerHealthBar = ({ x, y, health, maxHealth }) => {
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

  shell
    .roundRect(-BAR_WIDTH * 0.5 - 8, -BAR_HEIGHT * 0.5 - 8, BAR_WIDTH + 16, BAR_HEIGHT + 16, 16)
    .fill({ color: 0x040814, alpha: 0.94 })
    .stroke({ color: 0x48638f, width: 2, alpha: 0.95 })

  track
    .roundRect(-BAR_WIDTH * 0.5, -BAR_HEIGHT * 0.5, BAR_WIDTH, BAR_HEIGHT, 11)
    .fill({ color: 0x091226, alpha: 0.98 })

  container.addChild(shell)
  container.addChild(track)
  container.addChild(fill)
  container.addChild(gloss)

  text.anchor.set(0.5)
  text.position.set(0, 0)
  container.addChild(text)

  const update = (nextHealth, nextMaxHealth = maxHealth) => {
    const ratio = Math.max(0, Math.min(1, nextHealth / nextMaxHealth))
    const fillWidth = BAR_WIDTH * ratio
    const barColor = ratio > 0.55 ? 0x43d17f : ratio > 0.25 ? 0xf0b64a : 0xe14d67

    fill.clear()
    gloss.clear()

    if (fillWidth > 0) {
      fill
        .roundRect(-BAR_WIDTH * 0.5, -BAR_HEIGHT * 0.5, fillWidth, BAR_HEIGHT, 11)
        .fill({ color: barColor, alpha: 0.98 })
      gloss
        .roundRect(-BAR_WIDTH * 0.5 + 4, -BAR_HEIGHT * 0.5 + 3, Math.max(0, fillWidth - 8), 6, 4)
        .fill({ color: 0xffffff, alpha: 0.16 })
    }

    text.text = `${Math.ceil(nextHealth)} / ${nextMaxHealth}`
  }

  update(health, maxHealth)

  return {
    container,
    update,
  }
}
