import * as PIXI from 'pixi.js'
import { createShip } from './createShip'

const PANEL_PADDING = 28
const GRID_COLUMNS = 12
const CARD_WIDTH = 76
const CARD_HEIGHT = 92
const GRID_GAP_X = 8
const GRID_GAP_Y = 14
const GRID_START_Y = 52
const CLOSE_SIZE = 34

const createPreviewCard = (entry, x, y) => {
  const card = new PIXI.Container()
  card.position.set(x, y)

  const code = new PIXI.Text({
    text: entry.code,
    style: {
      fill: entry.role === 'player' ? 0x72efdd : 0xff8fab,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 11,
      fontWeight: '700',
    },
  })
  code.anchor.set(0.5, 0)
  code.position.set(CARD_WIDTH * 0.5, 0)
  card.addChild(code)

  const preview = createShip(entry.theme).ship
  preview.scale.set(0.29)
  preview.position.set(CARD_WIDTH * 0.5, 54)
  card.addChild(preview)

  return card
}

export const createCatalogOverlay = ({ x, y, width, height, entries, onClose }) => {
  const container = new PIXI.Container()
  container.position.set(x, y)
  container.visible = false

  const bg = new PIXI.Graphics()
  bg
    .rect(0, 0, width, height)
    .fill({ color: 0x071127, alpha: 0.97 })
  container.addChild(bg)

  const closeBg = new PIXI.Graphics()
  closeBg
    .roundRect(width - PANEL_PADDING - CLOSE_SIZE, PANEL_PADDING, CLOSE_SIZE, CLOSE_SIZE, 10)
    .fill({ color: 0x102347, alpha: 0.92 })
    .stroke({ color: 0x48638f, width: 2, alpha: 0.95 })
  closeBg.eventMode = 'static'
  closeBg.cursor = 'pointer'
  closeBg.on('pointertap', onClose)
  container.addChild(closeBg)

  const closeText = new PIXI.Text({
    text: '×',
    style: {
      fill: 0xe9f4ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 24,
      fontWeight: '700',
    },
  })
  closeText.anchor.set(0.5)
  closeText.position.set(width - PANEL_PADDING - CLOSE_SIZE * 0.5, PANEL_PADDING + CLOSE_SIZE * 0.5)
  container.addChild(closeText)

  entries.forEach((entry, index) => {
    const column = index % GRID_COLUMNS
    const row = Math.floor(index / GRID_COLUMNS)
    const cardX = PANEL_PADDING + column * (CARD_WIDTH + GRID_GAP_X)
    const cardY = GRID_START_Y + row * (CARD_HEIGHT + GRID_GAP_Y)
    container.addChild(createPreviewCard(entry, cardX, cardY))
  })

  return {
    container,
    bounds: {
      left: x,
      top: y,
      right: x + width,
      bottom: y + height,
    },
    toggle() {
      container.visible = !container.visible
    },
    isVisible() {
      return container.visible
    },
    hide() {
      container.visible = false
    },
  }
}
