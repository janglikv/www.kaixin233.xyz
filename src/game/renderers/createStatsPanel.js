import * as PIXI from 'pixi.js'

export const createStatsPanel = ({ x, y, stats }) => {
  const panel = new PIXI.Container()
  panel.position.set(x, y)

  const text = new PIXI.Text({
    text: '',
    style: {
      fill: 0xe9f4ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 14,
      lineHeight: 22,
      align: 'right',
    },
  })
  text.anchor.set(1, 0)
  text.position.set(0, 0)
  panel.addChild(text)

  const update = (nextStats) => {
    text.text = [
      `攻击力 ${nextStats.attackPower}`,
      `攻速 ${nextStats.attackSpeed.toFixed(1)}/s`,
      `暴击 ${(nextStats.critChance * 100).toFixed(0)}%`,
    ].join('\n')
  }

  update(stats)

  return {
    container: panel,
    update,
  }
}
