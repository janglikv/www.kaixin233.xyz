import * as PIXI from 'pixi.js'
import { createShip } from './createShip'

const PANEL_PADDING = 28
const GRID_COLUMNS = 12
const CARD_WIDTH = 76
const CARD_HEIGHT = 112
const GRID_GAP_X = 8
const GRID_GAP_Y = 14
const GRID_START_Y = 52
const CLOSE_SIZE = 34
const MODAL_WIDTH = 420
const MODAL_HEIGHT = 360

const createModalCloseButton = ({ x, y, onTap }) => {
  const button = new PIXI.Container()
  const glow = new PIXI.Graphics()
  const bg = new PIXI.Graphics()
  const icon = new PIXI.Graphics()

  let hovered = false
  let pressed = false

  const draw = () => {
    const fillColor = pressed ? 0x225a8f : hovered ? 0x173e67 : 0x102547
    const strokeColor = pressed ? 0xd6f6ff : hovered ? 0x97deff : 0x6c8fbf
    const glowAlpha = pressed ? 0.22 : hovered ? 0.16 : 0.1
    const offsetY = pressed ? 1 : 0

    glow
      .clear()
      .circle(CLOSE_SIZE * 0.5, CLOSE_SIZE * 0.5 + offsetY, 24)
      .fill({ color: 0x7fd6ff, alpha: glowAlpha })

    bg
      .clear()
      .circle(CLOSE_SIZE * 0.5, CLOSE_SIZE * 0.5 + offsetY, CLOSE_SIZE * 0.5)
      .fill({ color: fillColor, alpha: 0.96 })
      .stroke({ color: strokeColor, width: 2, alpha: 0.95 })
      .circle(CLOSE_SIZE * 0.5, CLOSE_SIZE * 0.5 + offsetY, CLOSE_SIZE * 0.5 - 6)
      .stroke({ color: 0xeaf7ff, width: 1.2, alpha: hovered || pressed ? 0.4 : 0.22 })

    icon
      .clear()
      .moveTo(12, 12 + offsetY)
      .lineTo(22, 22 + offsetY)
      .stroke({ color: 0xf4fbff, width: 2.8, alpha: 0.95, cap: 'round' })
      .moveTo(22, 12 + offsetY)
      .lineTo(12, 22 + offsetY)
      .stroke({ color: 0xf4fbff, width: 2.8, alpha: 0.95, cap: 'round' })
  }

  button.position.set(x, y)
  button.eventMode = 'static'
  button.cursor = 'pointer'
  button.hitArea = new PIXI.Circle(CLOSE_SIZE * 0.5, CLOSE_SIZE * 0.5, 24)
  button.addChild(glow)
  button.addChild(bg)
  button.addChild(icon)
  button.on('pointertap', onTap)
  button.on('pointerover', () => {
    hovered = true
    draw()
  })
  button.on('pointerout', () => {
    hovered = false
    pressed = false
    draw()
  })
  button.on('pointerdown', () => {
    pressed = true
    draw()
  })
  button.on('pointerup', () => {
    pressed = false
    draw()
  })
  button.on('pointerupoutside', () => {
    pressed = false
    draw()
  })

  draw()
  return button
}

const createVoidCreaturePreview = (entry) => {
  const root = new PIXI.Container()
  const accent = entry.accent ?? 0x72efdd
  const shadow = new PIXI.Graphics()
  const body = new PIXI.Graphics()
  const glow = new PIXI.Graphics()

  shadow.position.set(0, 6)
  shadow.alpha = 0.32
  root.addChild(shadow)
  root.addChild(glow)
  root.addChild(body)

  if (entry.silhouette === 'rift-servitor') {
    shadow
      .poly([-12, -24, -30, 8, -8, 34, 8, 34, 30, 8, 12, -24, 0, -36])
      .fill(0x02050d)
    glow.blendMode = 'add'
    glow
      .ellipse(0, 0, 22, 40)
      .fill({ color: accent, alpha: 0.12 })
      .ellipse(0, 3, 6, 22)
      .fill({ color: 0xf4fbff, alpha: 0.2 })
    body
      .poly([-12, -24, -30, 8, -8, 34, 8, 34, 30, 8, 12, -24, 0, -36])
      .fill({ color: 0x08111f, alpha: 0.96 })
      .stroke({ color: accent, width: 2, alpha: 0.85 })
    body
      .poly([-2, -22, -5, -3, -2, 18, 0, 28, 2, 18, 5, -3, 2, -22])
      .fill({ color: 0xdaf7ff, alpha: 0.92 })
  } else if (entry.silhouette === 'hollow-pilgrim') {
    shadow
      .ellipse(0, 28, 26, 8)
      .fill(0x02050d)
    glow.blendMode = 'add'
    glow
      .ellipse(0, -4, 24, 42)
      .fill({ color: accent, alpha: 0.1 })
      .ellipse(0, 2, 11, 18)
      .fill({ color: 0x04080f, alpha: 0.4 })
    body
      .roundRect(-10, -34, 20, 18, 9)
      .fill({ color: 0x0a1322, alpha: 1 })
      .stroke({ color: accent, width: 2, alpha: 0.82 })
    body
      .poly([-20, -18, -26, 28, -10, 38, 10, 38, 26, 28, 20, -18, 0, -30])
      .fill({ color: 0x09111c, alpha: 0.96 })
      .stroke({ color: accent, width: 2, alpha: 0.84 })
    body
      .ellipse(0, 0, 10, 16)
      .cut()
    body
      .ellipse(0, 0, 10, 16)
      .stroke({ color: 0xddefff, width: 2, alpha: 0.5 })
  } else if (entry.silhouette === 'blind-gazer') {
    shadow
      .ellipse(0, 22, 22, 6)
      .fill(0x02050d)
    glow.blendMode = 'add'
    glow
      .ellipse(0, 0, 26, 26)
      .fill({ color: accent, alpha: 0.14 })
      .ellipse(0, -22, 8, 8)
      .fill({ color: accent, alpha: 0.1 })
    body
      .circle(0, 0, 20)
      .fill({ color: 0x0a1020, alpha: 0.94 })
      .stroke({ color: accent, width: 2, alpha: 0.86 })
    body
      .ellipse(-9, -1, 6, 3)
      .stroke({ color: 0xeef6ff, width: 2, alpha: 0.65 })
    body
      .ellipse(9, -1, 6, 3)
      .stroke({ color: 0xeef6ff, width: 2, alpha: 0.65 })
    body
      .circle(0, -22, 5)
      .fill({ color: 0x071120, alpha: 0.95 })
      .stroke({ color: accent, width: 2, alpha: 0.7 })
    body
      .circle(0, 24, 4)
      .fill({ color: 0x071120, alpha: 0.95 })
      .stroke({ color: accent, width: 2, alpha: 0.7 })
  } else if (entry.silhouette === 'fold-hound') {
    shadow
      .ellipse(0, 24, 28, 7)
      .fill(0x02050d)
    glow.blendMode = 'add'
    glow
      .ellipse(0, 6, 30, 20)
      .fill({ color: accent, alpha: 0.12 })
    body
      .poly([-28, 8, -12, -8, 10, -4, 26, -18, 20, 0, 28, 12, 12, 10, -2, 20, -20, 18])
      .fill({ color: 0x08101d, alpha: 0.96 })
      .stroke({ color: accent, width: 2, alpha: 0.84 })
    body
      .poly([-18, 16, -24, 34, -16, 34, -8, 14])
      .fill({ color: 0x0b1620, alpha: 1 })
    body
      .poly([-2, 20, -6, 38, 2, 38, 8, 18])
      .fill({ color: 0x0b1620, alpha: 1 })
    body
      .poly([10, 14, 6, 34, 14, 34, 20, 10])
      .fill({ color: 0x0b1620, alpha: 1 })
    body
      .circle(28, -18, 3)
      .fill({ color: 0xeefcff, alpha: 0.85 })
  } else if (entry.silhouette === 'echo-parasite') {
    shadow
      .ellipse(0, 24, 26, 8)
      .fill(0x02050d)
    glow.blendMode = 'add'
    glow
      .ellipse(0, 2, 28, 30)
      .fill({ color: accent, alpha: 0.12 })
      .ellipse(10, -10, 12, 16)
      .fill({ color: 0xfce6ef, alpha: 0.09 })
    body
      .poly([-8, -28, -18, -8, -14, 10, -4, 28, 4, 28, 12, 10, 18, -8, 8, -28])
      .fill({ color: 0x0b111f, alpha: 0.88 })
      .stroke({ color: accent, width: 2, alpha: 0.84 })
    body
      .poly([12, -24, 28, -8, 22, 16, 6, 28])
      .stroke({ color: 0xf4d8e8, width: 2, alpha: 0.6 })
    body
      .moveTo(-8, 12)
      .lineTo(-24, 24)
      .stroke({ color: accent, width: 2, alpha: 0.68 })
    body
      .moveTo(8, 12)
      .lineTo(24, 24)
      .stroke({ color: accent, width: 2, alpha: 0.68 })
  } else if (entry.silhouette === 'void-bell') {
    shadow
      .ellipse(0, 28, 28, 8)
      .fill(0x02050d)
    glow.blendMode = 'add'
    glow
      .ellipse(0, -2, 30, 34)
      .fill({ color: accent, alpha: 0.12 })
      .ellipse(0, -18, 14, 10)
      .fill({ color: 0xf7fbff, alpha: 0.12 })
    body
      .poly([-18, -24, -26, 8, -14, 30, 14, 30, 26, 8, 18, -24, 0, -34])
      .fill({ color: 0x0a1222, alpha: 0.94 })
      .stroke({ color: accent, width: 2, alpha: 0.84 })
    body
      .ellipse(0, 6, 8, 10)
      .fill({ color: 0x02050d, alpha: 0.92 })
      .stroke({ color: 0xe9f4ff, width: 2, alpha: 0.44 })
    body
      .poly([-32, -10, -24, -18, -18, -8, -26, 0])
      .fill({ color: accent, alpha: 0.48 })
    body
      .poly([18, -8, 24, -18, 32, -10, 26, 0])
      .fill({ color: accent, alpha: 0.48 })
    body
      .poly([-30, 14, -20, 10, -14, 18, -24, 24])
      .fill({ color: 0xf0f6ff, alpha: 0.28 })
  }

  return root
}

const createPreviewGraphic = (entry) => {
  if (entry.previewKind === 'void-creature') {
    return createVoidCreaturePreview(entry)
  }

  return createShip(entry.theme).ship
}

const createPreviewCard = (entry, x, y, onOpenPreview) => {
  const card = new PIXI.Container()
  card.position.set(x, y)
  card.eventMode = 'static'
  card.cursor = 'pointer'
  card.hitArea = new PIXI.Rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT)
  card.on('pointertap', (event) => {
    event.stopPropagation()
    onOpenPreview(entry)
  })

  const code = new PIXI.Text({
    text: entry.code,
    style: {
      fill:
        entry.previewKind === 'void-creature'
          ? entry.accent ?? 0x72efdd
          : entry.role === 'player'
            ? 0x72efdd
            : 0xff8fab,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 18,
      fontWeight: '700',
    },
  })
  code.anchor.set(0.5, 0)
  code.position.set(CARD_WIDTH * 0.5, 8)
  card.addChild(code)

  const preview = createPreviewGraphic(entry)
  preview.scale.set(entry.previewKind === 'void-creature' ? 0.72 : 0.29)
  preview.position.set(CARD_WIDTH * 0.5, entry.previewKind === 'void-creature' ? 57 : 54)
  card.addChild(preview)

  return card
}

export const createCatalogOverlay = ({ x, y, width, height, entries, onClose, onPreviewOpen, onPreviewClose }) => {
  const container = new PIXI.Container()
  container.position.set(x, y)
  container.visible = false
  let activePreviewCode = null

  const bg = new PIXI.Graphics()
  bg
    .rect(0, 0, width, height)
    .fill({ color: 0x071127, alpha: 0.97 })
  bg.eventMode = 'static'
  bg.cursor = 'default'
  bg.hitArea = new PIXI.Rectangle(0, 0, width, height)
  bg.on('pointerdown', (event) => {
    event.stopPropagation()
  })
  bg.on('pointertap', (event) => {
    event.stopPropagation()
  })
  container.addChild(bg)

  const modalOverlay = new PIXI.Container()
  modalOverlay.visible = false
  modalOverlay.eventMode = 'static'
  modalOverlay.cursor = 'default'

  const closePreviewModal = () => {
    if (!modalOverlay.visible && activePreviewCode == null) {
      return
    }

    modalOverlay.visible = false
    activePreviewCode = null
    onPreviewClose?.()
  }

  const modalMask = new PIXI.Graphics()
  modalMask
    .rect(0, 0, width, height)
    .fill({ color: 0x020611, alpha: 0.72 })
  modalMask.on('pointertap', (event) => {
    event.stopPropagation()
    closePreviewModal()
  })
  modalOverlay.addChild(modalMask)

  const modalPanel = new PIXI.Container()
  modalPanel.position.set((width - MODAL_WIDTH) * 0.5, (height - MODAL_HEIGHT) * 0.5)
  modalPanel.eventMode = 'static'
  modalPanel.cursor = 'default'
  modalPanel.on('pointertap', (event) => {
    event.stopPropagation()
  })
  modalOverlay.addChild(modalPanel)

  const modalBg = new PIXI.Graphics()
  modalBg
    .roundRect(0, 0, MODAL_WIDTH, MODAL_HEIGHT, 28)
    .fill({ color: 0x091324, alpha: 0.96 })
    .stroke({ color: 0x31527e, width: 2, alpha: 0.92 })
  modalPanel.addChild(modalBg)

  const modalSheen = new PIXI.Graphics()
  modalSheen
    .roundRect(1, 1, MODAL_WIDTH - 2, 92, 28)
    .fill({ color: 0x17345b, alpha: 0.22 })
  modalPanel.addChild(modalSheen)

  const modalCloseButton = createModalCloseButton({
    x: MODAL_WIDTH - CLOSE_SIZE - 22,
    y: 20,
    onTap: (event) => {
      event.stopPropagation()
      closePreviewModal()
    },
  })
  modalPanel.addChild(modalCloseButton)

  const modalCode = new PIXI.Text({
    text: '',
    style: {
      fill: 0xeaf6ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: 1,
    },
  })
  modalCode.anchor.set(0.5, 0)
  modalCode.position.set(MODAL_WIDTH * 0.5, 28)
  modalPanel.addChild(modalCode)

  const modalPreviewStage = new PIXI.Container()
  modalPreviewStage.position.set(MODAL_WIDTH * 0.5, 210)
  modalPanel.addChild(modalPreviewStage)

  const modalPreviewGlow = new PIXI.Graphics()
  modalPreviewGlow.blendMode = 'add'
  modalPreviewStage.addChild(modalPreviewGlow)

  let currentModalPreview = null
  const openPreviewModal = (entry) => {
    modalCode.text = entry.code
    modalCode.style.fill =
      entry.previewKind === 'void-creature'
        ? entry.accent ?? 0x72efdd
        : entry.role === 'player'
          ? 0x72efdd
          : 0xff8fab

    modalPreviewGlow.clear()
    modalPreviewGlow
      .ellipse(0, 8, 92, 92)
      .fill({
        color: entry.previewKind === 'void-creature' ? entry.accent ?? 0x72efdd : 0x4cc9f0,
        alpha: 0.1,
      })
      .ellipse(0, 18, 48, 22)
      .fill({ color: 0xf3fbff, alpha: 0.08 })

    if (currentModalPreview) {
      modalPreviewStage.removeChild(currentModalPreview)
      currentModalPreview.destroy({ children: true })
      currentModalPreview = null
    }

    currentModalPreview = createPreviewGraphic(entry)
    currentModalPreview.scale.set(entry.previewKind === 'void-creature' ? 2.4 : 1.1)
    currentModalPreview.position.set(0, 10)
    modalPreviewStage.addChild(currentModalPreview)
    activePreviewCode = entry.code
    modalOverlay.visible = true
    onPreviewOpen?.(entry.code)
  }

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
    container.addChild(createPreviewCard(entry, cardX, cardY, openPreviewModal))
  })

  container.addChild(modalOverlay)

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
    show() {
      container.visible = true
    },
    isVisible() {
      return container.visible
    },
    openPreviewByCode(code) {
      const entry = entries.find((item) => item.code === code)
      if (!entry) return false

      if (!container.visible) {
        container.visible = true
      }
      openPreviewModal(entry)
      return true
    },
    getActivePreviewCode() {
      return activePreviewCode
    },
    hide() {
      container.visible = false
      closePreviewModal()
    },
  }
}
