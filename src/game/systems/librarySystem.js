import * as PIXI from 'pixi.js'

// 资料库系统：展示所有敌机缩略图与编号
export const createLibrarySystem = (app, enemyTextures, visible) => {
  const container = new PIXI.Container()
  container.zIndex = 5000
  container.visible = visible
  app.stage.addChild(container)

  // 蒙层、面板和网格容器
  const backdrop = new PIXI.Graphics()
  const panel = new PIXI.Graphics()
  const grid = new PIXI.Container()
  container.addChild(backdrop)
  container.addChild(panel)
  container.addChild(grid)

  const title = new PIXI.Text({
    text: 'Enemy Library',
    style: {
      fill: 0xffffff,
      fontSize: 24,
      fontWeight: '700',
    },
  })
  container.addChild(title)

  // 为每个敌机纹理生成一个条目（图 + #序号）
  const entries = enemyTextures.map((texture, index) => {
    const item = new PIXI.Container()
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)

    const label = new PIXI.Text({
      text: `#${index + 1}`,
      style: {
        fill: 0xfff18a,
        fontSize: 18,
        fontWeight: '700',
      },
    })
    label.anchor.set(0.5, 0)

    item.addChild(sprite)
    item.addChild(label)
    grid.addChild(item)

    return { item, sprite, label }
  })

  // 布局：根据窗口尺寸动态计算列数与单元尺寸
  const layout = () => {
    const stageW = app.renderer.width
    const stageH = app.renderer.height

    backdrop.clear()
    backdrop.rect(0, 0, stageW, stageH).fill(0x000000)
    backdrop.alpha = 0.62

    const panelPadding = 24
    const panelX = panelPadding
    const panelY = panelPadding
    const panelW = Math.max(320, stageW - panelPadding * 2)
    const panelH = Math.max(260, stageH - panelPadding * 2)

    panel.clear()
    panel.roundRect(panelX, panelY, panelW, panelH, 16).fill(0x10263d)
    panel
      .roundRect(panelX, panelY, panelW, panelH, 16)
      .stroke({ color: 0x79b8ff, width: 2, alpha: 0.85 })

    title.position.set(panelX + 24, panelY + 14)

    const gridTop = panelY + 64
    const gridLeft = panelX + 18
    const gridRight = panelX + panelW - 18
    const gridBottom = panelY + panelH - 20
    const cols = Math.max(3, Math.min(6, Math.floor((gridRight - gridLeft) / 140)))
    const cellW = (gridRight - gridLeft) / cols
    const rows = Math.ceil(entries.length / cols)
    const cellH = Math.max(98, (gridBottom - gridTop) / Math.max(1, rows))

    entries.forEach((entry, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const centerX = gridLeft + cellW * (col + 0.5)
      const centerY = gridTop + cellH * (row + 0.5)
      const targetSize = Math.min(cellW * 0.72, cellH * 0.58)
      const maxSide = Math.max(entry.sprite.texture.width, entry.sprite.texture.height)
      const scale = maxSide > 0 ? targetSize / maxSide : 0.2

      entry.item.position.set(centerX, centerY)
      entry.sprite.scale.set(scale)
      entry.sprite.position.set(0, -10)
      entry.label.position.set(0, cellH * 0.28)
    })
  }

  // 外部开关
  const setVisible = (nextVisible) => {
    container.visible = nextVisible
    if (!nextVisible) return
    layout()
    app.stage.sortChildren()
  }

  return { layout, setVisible, container }
}
