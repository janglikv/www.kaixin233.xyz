import * as PIXI from 'pixi.js'

const PANEL_WIDTH = 190
const PANEL_HEIGHT = 236
const ROW_START_Y = 42
const ROW_GAP = 34
const BUTTON_SIZE = 24

const createBoxButton = ({ x, y, label, onTap }) => {
  const button = new PIXI.Container()
  const bg = new PIXI.Graphics()
  const text = new PIXI.Text({
    text: label,
    style: {
      fill: 0xe9f4ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 16,
      fontWeight: '700',
      align: 'center',
    },
  })

  const draw = (hovered = false) => {
    bg
      .clear()
      .roundRect(0, 0, BUTTON_SIZE, BUTTON_SIZE, 8)
      .fill({
        color: hovered ? 0x15325f : 0x0a1836,
        alpha: 0.92,
      })
      .stroke({
        color: hovered ? 0x7fcfff : 0x48638f,
        width: 2,
        alpha: 0.95,
      })
  }

  draw(false)
  button.position.set(x, y)
  button.eventMode = 'static'
  button.cursor = 'pointer'
  text.anchor.set(0.5)
  text.position.set(BUTTON_SIZE * 0.5, BUTTON_SIZE * 0.5)
  button.addChild(bg)
  button.addChild(text)
  button.on('pointertap', onTap)
  button.on('pointerover', () => draw(true))
  button.on('pointerout', () => draw(false))

  return button
}

const createFlameButton = ({ x, y, onTap }) => {
  const button = new PIXI.Container()
  const bg = new PIXI.Graphics()
  const flame = new PIXI.Graphics()

  const draw = (hovered = false) => {
    bg
      .clear()
      .roundRect(0, 0, BUTTON_SIZE, BUTTON_SIZE, 8)
      .fill({
        color: hovered ? 0x15325f : 0x0a1836,
        alpha: 0.92,
      })
      .stroke({
        color: hovered ? 0x7fcfff : 0x48638f,
        width: 2,
        alpha: 0.95,
      })
  }

  flame
    .poly([
      12, 3,
      18, 10,
      17, 16,
      12, 22,
      7, 16,
      6, 10,
    ])
    .fill({ color: 0xff7a2f, alpha: 0.95 })
  flame
    .poly([
      12, 8,
      15, 12,
      14, 16,
      12, 19,
      10, 16,
      9, 12,
    ])
    .fill({ color: 0xffd166, alpha: 0.95 })
  flame.blendMode = 'add'

  draw(false)
  button.position.set(x, y)
  button.eventMode = 'static'
  button.cursor = 'pointer'
  button.addChild(bg)
  button.addChild(flame)
  button.on('pointertap', onTap)
  button.on('pointerover', () => draw(true))
  button.on('pointerout', () => draw(false))

  return button
}

export const createDebugPanel = ({
  x,
  y,
  state,
  onAdjustStat,
  onAdjustStageStartAt,
  onFlameSwitch,
  onCatalogToggle,
}) => {
  const panel = new PIXI.Container()
  panel.position.set(x, y)

  const bg = new PIXI.Graphics()
  bg
    .roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 16)
    .fill({ color: 0x071127, alpha: 0.8 })
    .stroke({ color: 0x35527d, width: 2, alpha: 0.9 })
  panel.addChild(bg)

  const title = new PIXI.Text({
    text: 'DEBUG',
    style: {
      fill: 0x8dbdff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1.2,
    },
  })
  title.position.set(14, 12)
  panel.addChild(title)

  const rows = [
    { key: 'attackPower', label: 'ATK', formatValue: (value) => `${value}` },
    { key: 'attackSpeed', label: 'SPD', formatValue: (value) => value.toFixed(1) },
    { key: 'critChance', label: 'CRIT', formatValue: (value) => `${(value * 100).toFixed(0)}%` },
    { key: 'debugStageStartAt', label: 'START', formatValue: (value) => value.toFixed(1) },
  ]

  const valueTexts = new Map()

  rows.forEach((row, index) => {
    const rowY = ROW_START_Y + index * ROW_GAP

    const labelText = new PIXI.Text({
      text: row.label,
      style: {
        fill: 0xc7dbff,
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 13,
      },
    })
    labelText.position.set(14, rowY + 4)
    panel.addChild(labelText)

    const onTapAdjust = (direction) => {
      if (row.key === 'debugStageStartAt') {
        onAdjustStageStartAt?.(direction)
        return
      }
      onAdjustStat?.(row.key, direction)
    }

    panel.addChild(
      createBoxButton({
        x: 78,
        y: rowY,
        label: '-',
        onTap: () => onTapAdjust(-1),
      }),
    )

    const valueText = new PIXI.Text({
      text: '',
      style: {
        fill: 0xf5fbff,
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 13,
        align: 'right',
      },
    })
    valueText.anchor.set(1, 0)
    valueText.position.set(145, rowY + 4)
    panel.addChild(valueText)
    valueTexts.set(row.key, valueText)

    panel.addChild(
      createBoxButton({
        x: 152,
        y: rowY,
        label: '+',
        onTap: () => onTapAdjust(1),
      }),
    )
  })

  const flameLabel = new PIXI.Text({
    text: 'FX',
    style: {
      fill: 0xc7dbff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 13,
    },
  })
  flameLabel.position.set(14, 180)
  panel.addChild(flameLabel)

  panel.addChild(
    createFlameButton({
      x: PANEL_WIDTH - BUTTON_SIZE - 14,
      y: 172,
      onTap: onFlameSwitch,
    }),
  )

  const catalogLabel = new PIXI.Text({
    text: 'CAT',
    style: {
      fill: 0xc7dbff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 13,
    },
  })
  catalogLabel.position.set(14, 208)
  panel.addChild(catalogLabel)

  panel.addChild(
    createBoxButton({
      x: PANEL_WIDTH - BUTTON_SIZE - 14,
      y: 200,
      label: 'O',
      onTap: onCatalogToggle,
    }),
  )

  const update = (nextState) => {
    rows.forEach((row) => {
      const valueText = valueTexts.get(row.key)
      if (!valueText) return
      valueText.text = row.formatValue(nextState[row.key] ?? 0)
    })
  }

  update(state)

  return {
    container: panel,
    bounds: {
      left: x,
      top: y,
      right: x + PANEL_WIDTH,
      bottom: y + PANEL_HEIGHT,
    },
    update,
  }
}
