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

export const createVoidCreaturePreview = (entry, options = {}) => {
  const { withGlow = true } = options
  const root = new PIXI.Container()
  const anatomy = new PIXI.Container()
  const appendages = new PIXI.Container()
  const accent = entry.accent ?? 0x8f5bff
  const shellDark = 0x12091f
  const shellMid = 0x1c0f2d
  const shellLight = 0x26163f
  const connectorColor = 0x5a2ea6
  const voidGlow = 0xd9a8ff
  const voidHot = 0xf1d6ff
  const shadow = new PIXI.Graphics()
  const connectors = new PIXI.Graphics()
  const body = new PIXI.Graphics()
  const glow = new PIXI.Graphics()
  const details = new PIXI.Graphics()

  shadow.position.set(0, 6)
  shadow.alpha = 0.32
  root.addChild(shadow)
  anatomy.scale.y = -1
  root.addChild(anatomy)
  if (withGlow) {
    anatomy.addChild(glow)
  }
  anatomy.addChild(appendages)
  anatomy.addChild(connectors)
  anatomy.addChild(body)
  anatomy.addChild(details)

  if (entry.silhouette === 'rift-servitor') {
    const createLeg = (points, fillColor) => {
      const leg = new PIXI.Container()
      const graphic = new PIXI.Graphics()
      graphic
        .poly(points)
        .fill({ color: fillColor, alpha: 0.98 })
        .stroke({ color: accent, width: 1.4, alpha: 0.68 })
      leg.addChild(graphic)
      return leg
    }

    shadow
      .ellipse(0, 28, 30, 9)
      .fill(0x02050d)
    glow.blendMode = 'add'
    glow
      .ellipse(0, 0, 14, 22)
      .fill({ color: accent, alpha: 0.14 })
      .ellipse(0, 8, 3, 4.5)
      .fill({ color: voidGlow, alpha: 0.14 })
    body
      .poly([-2, -22, -6, -12, -6, 0, -4, 10, -2, 14, 2, 14, 4, 10, 6, 0, 6, -12, 2, -22])
      .fill({ color: 0x231238, alpha: 0.98 })
      .stroke({ color: accent, width: 2, alpha: 0.85 })
    body
      .poly([-22, -12, -40, -18, -32, 0, -20, 8, -15, -6])
      .fill({ color: 0x32204a, alpha: 1 })
      .stroke({ color: accent, width: 1.8, alpha: 0.76 })
    body
      .poly([22, -12, 40, -18, 32, 0, 20, 8, 15, -6])
      .fill({ color: 0x32204a, alpha: 1 })
      .stroke({ color: accent, width: 1.8, alpha: 0.76 })
    connectors
      .moveTo(-2, -10)
      .lineTo(-8, -9)
      .lineTo(-14, -8)
      .stroke({ color: connectorColor, width: 6, alpha: 0.9, cap: 'round', join: 'round' })
    connectors
      .moveTo(2, -10)
      .lineTo(8, -9)
      .lineTo(14, -8)
      .stroke({ color: connectorColor, width: 6, alpha: 0.9, cap: 'round', join: 'round' })
    const backLegLeft = createLeg([-4, 18, -12, 22, -18, 42, -8, 34], 0x36244f)
    backLegLeft.pivot.set(-4, 18)
    backLegLeft.position.set(-4, 18)
    appendages.addChild(backLegLeft)
    const frontLegLeft = createLeg([-1, 16, -8, 20, -12, 36, -4, 30], 0x493063)
    frontLegLeft.pivot.set(-1, 16)
    frontLegLeft.position.set(-1, 16)
    appendages.addChild(frontLegLeft)
    const backLegRight = createLeg([4, 18, 12, 22, 18, 42, 8, 34], 0x36244f)
    backLegRight.pivot.set(4, 18)
    backLegRight.position.set(4, 18)
    appendages.addChild(backLegRight)
    const frontLegRight = createLeg([1, 16, 8, 20, 12, 36, 4, 30], 0x493063)
    frontLegRight.pivot.set(1, 16)
    frontLegRight.position.set(1, 16)
    appendages.addChild(frontLegRight)
    connectors
      .moveTo(-2, 13)
      .lineTo(-6, 20)
      .lineTo(-8, 24)
      .stroke({ color: connectorColor, width: 6, alpha: 0.9, cap: 'round', join: 'round' })
    connectors
      .moveTo(2, 13)
      .lineTo(6, 20)
      .lineTo(8, 24)
      .stroke({ color: connectorColor, width: 6, alpha: 0.9, cap: 'round', join: 'round' })
    details
      .ellipse(0, -9, 3.6, 5.2)
      .fill({ color: 0x7a2cff, alpha: 0.98 })
      .stroke({ color: 0xb46cff, width: 1.6, alpha: 0.84 })
    details
      .ellipse(-0.6, -10.3, 1.3, 1.9)
      .fill({ color: 0xd7b0ff, alpha: 0.42 })
    root.runtime = {
      gait: [
        { node: backLegLeft, phase: 0 },
        { node: frontLegRight, phase: 0 },
        { node: frontLegLeft, phase: Math.PI },
        { node: backLegRight, phase: Math.PI },
      ],
    }
  } else if (entry.silhouette === 'hollow-pilgrim') {
    shadow
      .ellipse(0, 28, 30, 10)
      .fill(0x02050d)
    glow.blendMode = 'add'
    glow
      .ellipse(0, -2, 26, 42)
      .fill({ color: accent, alpha: 0.1 })
      .ellipse(0, 2, 16, 22)
      .fill({ color: voidGlow, alpha: 0.1 })
    body
      .poly([-10, -34, -18, -14, 0, -22, 18, -14, 10, -34, 0, -40])
      .fill({ color: shellMid, alpha: 1 })
      .stroke({ color: accent, width: 2, alpha: 0.82 })
    body
      .poly([-18, -14, -28, 8, -22, 26, -8, 40, 8, 40, 22, 26, 28, 8, 18, -14, 0, -26])
      .fill({ color: shellDark, alpha: 0.96 })
      .stroke({ color: accent, width: 2, alpha: 0.84 })
    body
      .ellipse(0, 4, 10, 18)
      .cut()
    details
      .ellipse(0, 4, 10, 18)
      .stroke({ color: voidHot, width: 2, alpha: 0.54 })
    details
      .moveTo(-12, -4)
      .lineTo(-30, 12)
      .lineTo(-24, 20)
      .moveTo(12, -4)
      .lineTo(30, 12)
      .lineTo(24, 20)
      .stroke({ color: accent, width: 2, alpha: 0.66, cap: 'round', join: 'round' })
    details
      .moveTo(-8, 28)
      .lineTo(-18, 42)
      .moveTo(8, 28)
      .lineTo(18, 42)
      .stroke({ color: voidGlow, width: 1.8, alpha: 0.46, cap: 'round' })
  } else if (entry.silhouette === 'blind-gazer') {
    shadow
      .ellipse(0, 24, 28, 8)
      .fill(0x02050d)
    glow.blendMode = 'add'
    glow
      .ellipse(0, 0, 28, 28)
      .fill({ color: accent, alpha: 0.14 })
      .ellipse(0, -18, 12, 10)
      .fill({ color: voidGlow, alpha: 0.14 })
    body
      .poly([-16, -20, -26, -6, -24, 12, -10, 26, 10, 26, 24, 12, 26, -6, 16, -20, 0, -28])
      .fill({ color: shellDark, alpha: 0.94 })
      .stroke({ color: accent, width: 2, alpha: 0.86 })
    body
      .poly([-12, -8, -30, -2, -26, 8, -10, 4])
      .fill({ color: shellMid, alpha: 0.96 })
    body
      .poly([12, -8, 30, -2, 26, 8, 10, 4])
      .fill({ color: shellMid, alpha: 0.96 })
    details
      .ellipse(0, -4, 12, 7)
      .fill({ color: 0x02050d, alpha: 0.98 })
      .stroke({ color: voidHot, width: 2, alpha: 0.58 })
    details
      .ellipse(0, -18, 7, 6)
      .fill({ color: shellLight, alpha: 0.95 })
      .stroke({ color: accent, width: 1.8, alpha: 0.72 })
    details
      .moveTo(-8, 14)
      .lineTo(-18, 30)
      .moveTo(8, 14)
      .lineTo(18, 30)
      .stroke({ color: accent, width: 2, alpha: 0.62, cap: 'round' })
  } else if (entry.silhouette === 'fold-hound') {
    shadow
      .ellipse(0, 26, 34, 8)
      .fill(0x02050d)
    glow.blendMode = 'add'
    glow
      .ellipse(0, 4, 34, 20)
      .fill({ color: accent, alpha: 0.12 })
    body
      .poly([-26, 10, -10, -4, 14, -2, 30, -16, 22, 2, 30, 14, 12, 12, -4, 22, -24, 20])
      .fill({ color: shellDark, alpha: 0.96 })
      .stroke({ color: accent, width: 2, alpha: 0.84 })
    body
      .poly([-20, 16, -30, 38, -22, 40, -10, 16])
      .fill({ color: shellMid, alpha: 1 })
    body
      .poly([-2, 20, -10, 40, -2, 42, 8, 18])
      .fill({ color: shellMid, alpha: 1 })
    body
      .poly([10, 14, 4, 36, 12, 38, 22, 10])
      .fill({ color: shellMid, alpha: 1 })
    details
      .poly([-18, -2, -30, -16, -12, -10, 0, -20, 14, -16, 24, -6, 8, -4, -4, -4])
      .fill({ color: shellLight, alpha: 1 })
      .stroke({ color: accent, width: 1.8, alpha: 0.82 })
    details
      .circle(24, -6, 3)
      .fill({ color: voidHot, alpha: 0.9 })
  } else if (entry.silhouette === 'echo-parasite') {
    shadow
      .ellipse(0, 24, 30, 8)
      .fill(0x02050d)
    glow.blendMode = 'add'
    glow
      .ellipse(0, 2, 28, 30)
      .fill({ color: accent, alpha: 0.12 })
      .ellipse(12, -10, 12, 16)
      .fill({ color: voidGlow, alpha: 0.14 })
    body
      .poly([-10, -28, -20, -10, -16, 10, -4, 30, 6, 30, 14, 10, 20, -8, 10, -28])
      .fill({ color: shellDark, alpha: 0.88 })
      .stroke({ color: accent, width: 2, alpha: 0.84 })
    body
      .poly([12, -24, 30, -8, 24, 18, 6, 30])
      .stroke({ color: voidHot, width: 2, alpha: 0.64 })
    details
      .poly([-18, -20, -2, -28, 12, -16, 0, -6])
      .fill({ color: shellLight, alpha: 0.94 })
      .stroke({ color: accent, width: 1.6, alpha: 0.54 })
    details
      .moveTo(-8, 12)
      .lineTo(-28, 24)
      .lineTo(-22, 32)
      .moveTo(8, 12)
      .lineTo(24, 26)
      .lineTo(18, 34)
      .stroke({ color: accent, width: 2, alpha: 0.68, cap: 'round', join: 'round' })
  } else if (entry.silhouette === 'void-bell') {
    shadow
      .ellipse(0, 28, 32, 9)
      .fill(0x02050d)
    glow.blendMode = 'add'
    glow
      .ellipse(0, -2, 32, 34)
      .fill({ color: accent, alpha: 0.12 })
      .ellipse(0, -18, 16, 10)
      .fill({ color: voidGlow, alpha: 0.12 })
    body
      .poly([-18, -24, -30, 6, -18, 30, 18, 30, 30, 6, 18, -24, 0, -36])
      .fill({ color: shellDark, alpha: 0.94 })
      .stroke({ color: accent, width: 2, alpha: 0.84 })
    body
      .ellipse(0, 8, 8, 11)
      .fill({ color: 0x02050d, alpha: 0.92 })
      .stroke({ color: voidHot, width: 2, alpha: 0.44 })
    body
      .poly([-34, -10, -24, -20, -18, -8, -28, 0])
      .fill({ color: accent, alpha: 0.48 })
    body
      .poly([18, -8, 24, -20, 34, -10, 28, 0])
      .fill({ color: accent, alpha: 0.48 })
    details
      .poly([-10, -26, -18, -40, 0, -32, 18, -40, 10, -26, 0, -18])
      .fill({ color: shellLight, alpha: 1 })
      .stroke({ color: accent, width: 1.8, alpha: 0.72 })
    details
      .poly([-30, 14, -20, 10, -14, 18, -24, 24])
      .fill({ color: voidGlow, alpha: 0.26 })
    details
      .poly([30, 14, 20, 10, 14, 18, 24, 24])
      .fill({ color: voidGlow, alpha: 0.18 })
  }

  return root
}

const createPreviewGraphic = (entry, options) => {
  if (entry.previewKind === 'void-creature') {
    return createVoidCreaturePreview(entry, options)
  }

  return createShip(entry.theme).ship
}

const animatePreviewGraphic = (preview, deltaSeconds, elapsedSeconds) => {
  const gait = preview?.runtime?.gait
  if (Array.isArray(gait) && gait.length > 0) {
    gait.forEach((leg) => {
      leg.node.rotation = Math.sin(elapsedSeconds * 7.6 + leg.phase) * 0.22
      leg.node.y = leg.node.position.y + Math.cos(elapsedSeconds * 9.2 + leg.phase) * 0.9
    })
    preview.y = 10 + Math.sin(elapsedSeconds * 2.4) * 4
  }
  return deltaSeconds
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

  let currentModalPreview = null
  let previewElapsedSeconds = 0
  const openPreviewModal = (entry) => {
    modalCode.text = entry.code
    modalCode.style.fill =
      entry.previewKind === 'void-creature'
        ? entry.accent ?? 0x72efdd
        : entry.role === 'player'
          ? 0x72efdd
          : 0xff8fab

    if (currentModalPreview) {
      modalPreviewStage.removeChild(currentModalPreview)
      currentModalPreview.destroy({ children: true })
      currentModalPreview = null
    }

    currentModalPreview = createPreviewGraphic(entry, { withGlow: false })
    currentModalPreview.scale.set(entry.previewKind === 'void-creature' ? 2.4 : 1.1)
    currentModalPreview.position.set(0, 10)
    modalPreviewStage.addChild(currentModalPreview)
    previewElapsedSeconds = 0
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
    update(deltaSeconds) {
      if (!modalOverlay.visible || !currentModalPreview) return
      previewElapsedSeconds += deltaSeconds
      animatePreviewGraphic(currentModalPreview, deltaSeconds, previewElapsedSeconds)
    },
    hide() {
      container.visible = false
      closePreviewModal()
    },
  }
}
