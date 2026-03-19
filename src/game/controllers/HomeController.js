import * as PIXI from 'pixi.js'
import { CATALOG_ENTRIES } from '../data/catalogEntries'
import { SHIP_CATALOG } from '../data/shipCatalog'
import { PLAYER_SHIP_THEME } from '../data/shipCatalog'
import { EXHAUST_PLUGINS } from '../effects/exhaustPlugins'
import { createExhaustSwitcher } from '../effects/createExhaustSwitcher'
import { createCatalogOverlay } from '../renderers/createCatalogOverlay'
import { createSettingsButton } from '../renderers/createSettingsButton'
import { createSettingsOverlay } from '../renderers/createSettingsOverlay'
import { createShip } from '../renderers/createShip'
import { createShipScene } from '../renderers/createShipScene'
import { createSpaceBackdrop } from '../renderers/createSpaceBackdrop'
import { clearGameSettings, loadGameSettings, saveGameSettings } from '../utils/gameSettingsStorage'
import {
  PLAYER_STATS,
  clampAttackPower,
  clampAttackSpeed,
  clampCritChance,
} from '../utils/playerStats'

const SHIP_DEFAULT_ITEM_ID = 'ship-frame-0'
const SHIP_FRAME_ITEM_ID = 'ship-frame-1'
const EXHAUST_0_ITEM_ID = 'exhaust-0'
const EXHAUST_1_ITEM_ID = 'exhaust-1'
const SHIP_DEFAULT_ITEM_NAME = '机体 #0'
const SHIP_DEFAULT_ITEM_DESCRIPTION = '默认机体，维持当前基础机身外观，适合常规出击。'
const SHIP_FRAME_ITEM_NAME = '机体 #1'
const SHIP_FRAME_ITEM_DESCRIPTION = '标准机体组件，外观采用 #1 样式，可用于正常出击。'
const SHIP_FRAME_THEME = SHIP_CATALOG[1]?.theme ?? PLAYER_SHIP_THEME
const EXHAUST_0_PLUGIN = EXHAUST_PLUGINS[0]
const EXHAUST_1_PLUGIN = EXHAUST_PLUGINS[1]
const PREVIEW_THRUST_DISTANCE = 76 * 1.02
const PREVIEW_EFFECT_SCALE = 0.9
const PREVIEW_SHIP_ROTATION = 0.12
const LOGICAL_WIDTH = 1280
const LOGICAL_HEIGHT = 720
const GAME_SETTINGS_DEFAULTS = {
  gameStarted: false,
  pressureTestEnabled: false,
  equippedShipItemId: SHIP_DEFAULT_ITEM_ID,
  equippedExhaustItemId: EXHAUST_0_ITEM_ID,
  musicEnabled: true,
  fpsEnabled: true,
  impactEffectsEnabled: true,
  catalogVisible: false,
  attackPower: PLAYER_STATS.attackPower,
  attackSpeed: PLAYER_STATS.attackSpeed,
  critChance: PLAYER_STATS.critChance,
}
const normalizeGameSettings = (settings) => {
  const legacyEquippedItemId =
    typeof settings.equippedItemId === 'string' ? settings.equippedItemId : null
  const legacyItem = legacyEquippedItemId
    ? INVENTORY_ITEMS?.find?.((item) => item.id === legacyEquippedItemId) ?? null
    : null

  return {
    gameStarted: settings.gameStarted === true,
    pressureTestEnabled: settings.pressureTestEnabled !== false,
    equippedShipItemId:
      typeof settings.equippedShipItemId === 'string'
        ? settings.equippedShipItemId
        : legacyItem?.kind === 'ship'
          ? legacyItem.id
          : SHIP_DEFAULT_ITEM_ID,
    equippedExhaustItemId:
      typeof settings.equippedExhaustItemId === 'string'
        ? settings.equippedExhaustItemId
        : legacyItem?.kind === 'exhaust'
          ? legacyItem.id
          : EXHAUST_0_ITEM_ID,
    musicEnabled: Boolean(settings.musicEnabled),
    fpsEnabled: settings.fpsEnabled !== false,
    impactEffectsEnabled: settings.impactEffectsEnabled !== false,
    catalogVisible: settings.catalogVisible === true,
    catalogPreviewCode: typeof settings.catalogPreviewCode === 'string' ? settings.catalogPreviewCode : null,
    attackPower: clampAttackPower(settings.attackPower),
    attackSpeed: clampAttackSpeed(settings.attackSpeed),
    critChance: clampCritChance(settings.critChance),
  }
}

const createPanelFrame = ({ x, y, width, height, radius = 26 }) => {
  const container = new PIXI.Container()
  container.position.set(x, y)

  const shadow = new PIXI.Graphics()
  shadow
    .roundRect(8, 12, width, height, radius)
    .fill({ color: 0x02050d, alpha: 0.4 })
  container.addChild(shadow)

  const panel = new PIXI.Graphics()
  panel
    .roundRect(0, 0, width, height, radius)
    .fill({ color: 0x071221, alpha: 0.88 })
    .stroke({ color: 0x2d4b75, width: 2, alpha: 0.95 })
  container.addChild(panel)

  const sheen = new PIXI.Graphics()
  sheen
    .roundRect(1, 1, width - 2, Math.min(76, height * 0.24), radius)
    .fill({ color: 0x17345b, alpha: 0.3 })
  container.addChild(sheen)

  return container
}

const createSectionTitle = ({ text, x, y }) => {
  const container = new PIXI.Container()
  container.position.set(x, y)

  const title = new PIXI.Text({
    text,
    style: {
      fill: 0xeaf6ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: 2,
    },
  })
  container.addChild(title)

  return container
}

const createShipPreviewPanel = ({ x, y, width, height }) => {
  const container = new PIXI.Container()
  container.position.set(x, y)
  let currentTheme = PLAYER_SHIP_THEME
  let currentExhaustIndex = null

  const stageGlow = new PIXI.Graphics()
  stageGlow
    .ellipse(width * 0.5, height * 0.46, 220, 176)
    .fill({ color: 0x1d56d2, alpha: 0.16 })
    .ellipse(width * 0.5, height * 0.46, 152, 118)
    .fill({ color: 0x67d7ff, alpha: 0.14 })
  container.addChild(stageGlow)

  const floor = new PIXI.Graphics()
  floor
    .ellipse(width * 0.5, height - 76, 152, 28)
    .fill({ color: 0x4ebaff, alpha: 0.22 })
    .ellipse(width * 0.5, height - 76, 112, 12)
    .fill({ color: 0x9debff, alpha: 0.4 })
  container.addChild(floor)

  let shipScene = null
  let exhaustSwitcher = null

  const buildShipScene = (theme) => {
    currentTheme = theme
    exhaustSwitcher?.destroy()
    exhaustSwitcher = null
    if (shipScene) {
      container.removeChild(shipScene.shipGroup)
      shipScene.shipGroup.destroy({ children: true })
    }

    shipScene = createShipScene({
      x: width * 0.5,
      y: height * 0.44,
      shipScale: 1.02,
      shipRotation: PREVIEW_SHIP_ROTATION,
      shipTheme: currentTheme,
      showFlame: false,
    })
    container.addChild(shipScene.shipGroup)
    exhaustSwitcher = createExhaustSwitcher({
      PIXI,
      runtimeLayer: shipScene.runtimeLayer,
      initialIndex: currentExhaustIndex ?? 0,
    })
    exhaustSwitcher.setEnabled(currentExhaustIndex !== null)
  }

  buildShipScene(currentTheme)

  return {
    container,
    get shipScene() {
      return shipScene
    },
    setTheme(nextTheme) {
      if (nextTheme === currentTheme) return
      buildShipScene(nextTheme)
    },
    setExhaustIndex(nextIndex) {
      currentExhaustIndex = Number.isInteger(nextIndex) ? nextIndex : null
      if (!exhaustSwitcher) return
      if (currentExhaustIndex === null) {
        exhaustSwitcher.setEnabled(false)
        return
      }
      exhaustSwitcher.setEnabled(true)
      exhaustSwitcher.setIndex(currentExhaustIndex)
    },
    update(deltaSeconds, elapsedSeconds, pulse) {
      const directionX = Math.sin(PREVIEW_SHIP_ROTATION)
      const directionY = -Math.cos(PREVIEW_SHIP_ROTATION)
      exhaustSwitcher?.update(deltaSeconds, elapsedSeconds, {
        originX: shipScene.shipX - directionX * PREVIEW_THRUST_DISTANCE,
        originY: shipScene.shipY - directionY * PREVIEW_THRUST_DISTANCE,
        directionX,
        directionY,
        pulse,
        scale: PREVIEW_EFFECT_SCALE,
      })
    },
    destroy() {
      exhaustSwitcher?.destroy()
      exhaustSwitcher = null
    },
  }
}

const createStartButton = ({ x, y, width, height, label, onTap }) => {
  const container = new PIXI.Container()
  container.position.set(x, y)
  container.eventMode = 'static'
  container.cursor = 'pointer'
  let enabled = true

  const shadow = new PIXI.Graphics()
  shadow
    .roundRect(0, 10, width, height, 26)
    .fill({ color: 0x02111f, alpha: 0.42 })
  container.addChild(shadow)

  const bg = new PIXI.Graphics()
  const gloss = new PIXI.Graphics()
  const text = new PIXI.Text({
    text: label,
    style: {
      fill: 0xf8feff,
      fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: 4,
    },
  })

  const draw = (hovered = false) => {
    bg
      .clear()
      .roundRect(0, 0, width, height, 26)
      .fill({
        color: hovered ? 0x1e8dff : 0x1467d9,
        alpha: 0.98,
      })
      .stroke({
        color: hovered ? 0xa8ebff : 0x7fcfff,
        width: 3,
        alpha: 0.95,
      })

    gloss
      .clear()
      .roundRect(2, 2, width - 4, height * 0.48, 24)
      .fill({
        color: 0xb8f4ff,
        alpha: hovered ? 0.24 : 0.16,
      })
  }

  draw(false)
  text.anchor.set(0.5)
  text.position.set(width * 0.5, height * 0.5)
  container.addChild(bg)
  container.addChild(gloss)
  container.addChild(text)
  container.on('pointertap', () => {
    if (!enabled) return
    onTap?.()
  })
  container.on('pointerover', () => {
    if (!enabled) return
    draw(true)
  })
  container.on('pointerout', () => draw(false))

  return {
    container,
    setEnabled(nextEnabled) {
      draw(false)
      container.cursor = nextEnabled ? 'pointer' : 'default'
      container.alpha = nextEnabled ? 1 : 0.5
      container.eventMode = nextEnabled ? 'static' : 'none'
      enabled = nextEnabled
    },
  }
}

const createShipFrameIcon = ({ size, theme }) => {
  const icon = new PIXI.Container()
  const shipAsset = createShip(theme)
  const { ship, flameGlow, flameCore, flameInner } = shipAsset

  flameGlow.visible = false
  flameCore.visible = false
  flameInner.visible = false

  const shipBounds = ship.getLocalBounds()
  const scale = (size * 0.68) / Math.max(shipBounds.width, shipBounds.height)
  ship.scale.set(scale)

  const scaledBounds = ship.getLocalBounds()
  ship.position.set(
    size * 0.5 - (scaledBounds.x + scaledBounds.width * 0.5),
    size * 0.54 - (scaledBounds.y + scaledBounds.height * 0.5),
  )
  icon.addChild(ship)

  return {
    container: icon,
    update(equipped) {
      icon.alpha = equipped ? 1 : 0.94
    },
  }
}

const createExhaustIcon = ({ size, pluginIndex }) => {
  const container = new PIXI.Container()
  const nozzle = new PIXI.Graphics()
  const runtimeLayer = new PIXI.Container()
  const scale = size / 196
  const offsetY = 12 * (size / 196)
  let elapsed = 0
  let active = false

  nozzle
    .roundRect(
      size * 0.5 - 18 * scale,
      size * 0.2 + offsetY,
      36 * scale,
      24 * scale,
      12 * scale,
    )
    .fill({ color: 0x0f2748, alpha: 0.96 })
    .stroke({ color: 0x5f8bc7, width: 2 * scale, alpha: 0.94 })
    .roundRect(size * 0.5 - 11 * scale, size * 0.24 + offsetY, 22 * scale, 14 * scale, 8 * scale)
    .fill({ color: 0x1f7dff, alpha: 0.92 })
  container.addChild(runtimeLayer)
  container.addChild(nozzle)

  const runtime = EXHAUST_PLUGINS[pluginIndex]?.createRuntime(PIXI, runtimeLayer) ?? null

  return {
    container,
    update(equipped) {
      active = equipped
      container.alpha = equipped ? 1 : 0.94
    },
    tick(deltaSeconds) {
      if (!runtime) return
      elapsed += deltaSeconds
      const pulse = (Math.sin(elapsed * 4.4) + 1) * 0.5
      runtime.update(deltaSeconds, elapsed, {
        originX: size * 0.5,
        originY: size * 0.36 + offsetY,
        directionX: 0,
        directionY: -1,
        pulse: active ? 0.78 + pulse * 0.22 : 0.46 + pulse * 0.12,
        scale: Math.max(0.45, size / 196),
      })
    },
    destroy() {
      runtime?.destroy()
    },
  }
}

const createModalButton = ({ x, y, width, height, label, onTap, variant = 'primary' }) => {
  const container = new PIXI.Container()
  container.position.set(x, y)
  container.eventMode = 'static'
  container.cursor = 'pointer'

  const bg = new PIXI.Graphics()
  const text = new PIXI.Text({
    text: label,
    style: {
      fill: 0xf8feff,
      fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 2,
    },
  })
  text.anchor.set(0.5)
  text.position.set(width * 0.5, height * 0.5)

  const palette =
    variant === 'secondary'
      ? {
          idle: 0x2a3547,
          hover: 0x354866,
          stroke: 0x7f9cc2,
          hoverStroke: 0xaed3ff,
        }
      : {
          idle: 0x1467d9,
          hover: 0x1e8dff,
          stroke: 0x7fcfff,
          hoverStroke: 0xa8ebff,
        }

  const draw = (hovered = false) => {
    bg
      .clear()
      .roundRect(0, 0, width, height, 18)
      .fill({ color: hovered ? palette.hover : palette.idle, alpha: 0.98 })
      .stroke({
        color: hovered ? palette.hoverStroke : palette.stroke,
        width: 2,
        alpha: 0.96,
      })
  }

  draw(false)
  container.addChild(bg)
  container.addChild(text)
  container.on('pointertap', (event) => {
    event.stopPropagation()
    onTap?.()
  })
  container.on('pointerover', () => draw(true))
  container.on('pointerout', () => draw(false))

  return {
    container,
    setLabel(nextLabel) {
      text.text = nextLabel
    },
  }
}

const createItemDetailModal = ({ width, height, onToggleEquip }) => {
  const container = new PIXI.Container()
  container.visible = false

  const overlay = new PIXI.Graphics()
  overlay
    .rect(0, 0, width, height)
    .fill({ color: 0x030711, alpha: 0.7 })
  overlay.eventMode = 'static'
  overlay.cursor = 'default'
  overlay.on('pointertap', () => {
    container.visible = false
  })
  container.addChild(overlay)

  const panelWidth = 680
  const panelHeight = 470
  const panelX = (width - panelWidth) * 0.5
  const panelY = (height - panelHeight) * 0.5
  const panel = createPanelFrame({
    x: panelX,
    y: panelY,
    width: panelWidth,
    height: panelHeight,
    radius: 30,
  })
  panel.eventMode = 'static'
  panel.cursor = 'default'
  panel.on('pointertap', (event) => {
    event.stopPropagation()
  })
  container.addChild(panel)

  const closeButton = new PIXI.Graphics()
  closeButton
    .roundRect(panelWidth - 58, 18, 40, 40, 12)
    .fill({ color: 0x132745, alpha: 0.96 })
    .stroke({ color: 0x5c86bc, width: 2, alpha: 0.96 })
  closeButton.eventMode = 'static'
  closeButton.cursor = 'pointer'
  closeButton.on('pointertap', (event) => {
    event.stopPropagation()
    container.visible = false
  })
  panel.addChild(closeButton)

  const closeText = new PIXI.Text({
    text: '×',
    style: {
      fill: 0xeaf6ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 24,
      fontWeight: '700',
    },
  })
  closeText.anchor.set(0.5)
  closeText.position.set(panelWidth - 38, 38)
  panel.addChild(closeText)

  const previewFrame = new PIXI.Graphics()
  previewFrame
    .roundRect(34, 84, 196, 196, 26)
    .fill({ color: 0x0c1830, alpha: 0.98 })
    .stroke({ color: 0x4675b0, width: 2, alpha: 0.96 })
  panel.addChild(previewFrame)

  const iconHost = new PIXI.Container()
  iconHost.position.set(34, 84)
  panel.addChild(iconHost)

  const titleText = new PIXI.Text({
    text: '',
    style: {
      fill: 0xffde7a,
      fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: 1.2,
    },
  })
  titleText.position.set(260, 92)
  panel.addChild(titleText)

  const statusText = new PIXI.Text({
    text: '',
    style: {
      fill: 0x8cd8ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 1.2,
    },
  })
  statusText.position.set(262, 142)
  panel.addChild(statusText)

  const descText = new PIXI.Text({
    text: '',
    style: {
      fill: 0xd7e8ff,
      fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
      fontSize: 20,
      lineHeight: 32,
      wordWrap: true,
      breakWords: true,
      wordWrapWidth: 380,
    },
  })
  descText.position.set(262, 186)
  panel.addChild(descText)

  const actionButton = createModalButton({
    x: (panelWidth - 220) * 0.5,
    y: panelHeight - 84,
    width: 220,
    height: 52,
    label: '装备',
    onTap: () => {
      if (!currentItem) return
      onToggleEquip(currentItem.id)
      container.visible = false
    },
  })
  panel.addChild(actionButton.container)

  let currentItem = null
  let currentIcon = null

  return {
    container,
    hide() {
      container.visible = false
    },
    update(item, equippedState) {
      currentItem = item
      titleText.text = item.name
      statusText.text = isItemEquipped(item, equippedState) ? '当前状态: 已装备' : '当前状态: 未装备'
      descText.text = item.description
      actionButton.setLabel(isItemEquipped(item, equippedState) ? '取消装备' : '装备')

      if (currentIcon) {
        iconHost.removeChild(currentIcon.container)
        currentIcon.container.destroy({ children: true })
      }
      currentIcon = item.drawIcon({ size: 196 })
      currentIcon.update?.(isItemEquipped(item, equippedState))
      iconHost.addChild(currentIcon.container)
      container.visible = true
    },
    tick(deltaSeconds) {
      currentIcon?.tick?.(deltaSeconds)
    },
    destroy() {
      currentIcon?.destroy?.()
      currentIcon = null
    },
  }
}

const createInventorySlot = ({ x, y, size, equipped, drawIcon, onTap }) => {
  const scale = size / 184
  const slot = new PIXI.Container()
  slot.position.set(x, y)
  slot.eventMode = 'static'
  slot.cursor = 'pointer'

  const bg = new PIXI.Graphics()
  const icon = drawIcon({ size })
  const badge = new PIXI.Graphics()

  const draw = (hovered = false, isEquipped = equipped) => {
    bg
      .clear()
      .roundRect(0, 0, size, size, 22 * scale)
      .fill({
        color: isEquipped ? 0x2f2410 : 0x101318,
        alpha: 0.96,
      })
      .stroke({
        color: isEquipped ? 0xffd86c : hovered ? 0x7fcfff : 0x2a4467,
        width: isEquipped ? 3 : 2,
        alpha: 0.95,
      })

    icon.update?.(isEquipped || hovered)

    badge.visible = isEquipped
    badge
      .clear()
      .roundRect(size - 50 * scale, 8 * scale, 40 * scale, 40 * scale, 10 * scale)
      .fill({ color: 0xffd86c, alpha: 0.98 })
      .stroke({ color: 0xffefb0, width: 2 * scale, alpha: 0.95 })
      .moveTo(size - 40 * scale, 28 * scale)
      .lineTo(size - 32 * scale, 36 * scale)
      .lineTo(size - 18 * scale, 18 * scale)
      .stroke({ color: 0x3a2400, width: 3 * scale, alpha: 1, cap: 'round', join: 'round' })
  }

  draw(false, equipped)
  slot.addChild(bg)
  slot.addChild(icon.container)
  slot.addChild(badge)
  slot.on('pointertap', () => {
    onTap?.()
  })
  slot.on('pointerover', () => {
    draw(true, equipped)
  })
  slot.on('pointerout', () => {
    draw(false, equipped)
  })

  return {
    container: slot,
    update(nextEquipped) {
      equipped = nextEquipped
      draw(false, equipped)
    },
    tick(deltaSeconds) {
      icon.tick?.(deltaSeconds)
    },
    destroy() {
      icon.destroy?.()
    },
  }
}

const getShipItemId = (serial) => {
  if (serial === 0) return SHIP_DEFAULT_ITEM_ID
  if (serial === 1) return SHIP_FRAME_ITEM_ID
  return `ship-frame-${serial}`
}

const getExhaustItemId = (index) => {
  if (index === 0) return EXHAUST_0_ITEM_ID
  if (index === 1) return EXHAUST_1_ITEM_ID
  return `exhaust-${index}`
}

const SHIP_ITEMS = SHIP_CATALOG.map((entry) => ({
  id: getShipItemId(entry.serial),
  kind: 'ship',
  name: `机体 ${entry.code}`,
  description:
    entry.serial === 0
      ? '默认机体，维持当前基础机身外观，适合常规出击。'
      : `${entry.name} 风格机体，编号 ${entry.code}。`,
  theme: entry.theme,
  drawIcon: ({ size }) => {
    return createShipFrameIcon({
      size,
      theme: entry.theme,
    })
  },
}))

const EXHAUST_ITEMS = EXHAUST_PLUGINS.map((plugin, index) => ({
  id: getExhaustItemId(index),
  kind: 'exhaust',
  name: `尾焰 #${index}`,
  description: `${plugin.name} / ${plugin.description}`,
  pluginIndex: index,
  drawIcon: ({ size }) => {
    return createExhaustIcon({
      size,
      pluginIndex: index,
    })
  },
}))

const INVENTORY_ITEMS = [
  ...SHIP_ITEMS,
  ...EXHAUST_ITEMS,
]

const isItemEquipped = (item, equippedState) => {
  if (item.kind === 'ship') return equippedState.shipItemId === item.id
  if (item.kind === 'exhaust') return equippedState.exhaustItemId === item.id
  return false
}

const toggleEquippedItem = (item, equippedState) => {
  if (item.kind === 'ship') {
    return {
      ...equippedState,
      shipItemId: equippedState.shipItemId === item.id ? null : item.id,
    }
  }
  if (item.kind === 'exhaust') {
    return {
      ...equippedState,
      exhaustItemId: equippedState.exhaustItemId === item.id ? null : item.id,
    }
  }
  return equippedState
}

const canStartGame = (equippedState) =>
  Boolean(equippedState.shipItemId) && Boolean(equippedState.exhaustItemId)

const getPreviewShipTheme = (equippedState) => {
  const shipItem = SHIP_ITEMS.find((item) => item.id === equippedState.shipItemId)
  return shipItem?.theme ?? PLAYER_SHIP_THEME
}

const getPreviewExhaustIndex = (equippedState) => {
  const exhaustItem = EXHAUST_ITEMS.find((item) => item.id === equippedState.exhaustItemId)
  return Number.isInteger(exhaustItem?.pluginIndex) ? exhaustItem.pluginIndex : null
}

const createInventoryPanel = ({ x, y, width, height, equippedState, onSelectItem }) => {
  const container = createPanelFrame({ x, y, width, height })
  const slots = []
  const slotSize = 94
  const colGap = 14
  const rowGap = 22
  const columns = 6

  container.addChild(
    createSectionTitle({
      text: '物品',
      x: 28,
      y: 12,
    }),
  )

  INVENTORY_ITEMS.forEach((item, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const slot = createInventorySlot({
      x: 36 + column * (slotSize + colGap),
      y: 64 + row * (slotSize + rowGap),
      size: slotSize,
      equipped: isItemEquipped(item, equippedState),
      drawIcon: item.drawIcon,
      onTap: () => {
        onSelectItem(item)
      },
    })
    slots.push({
      id: item.id,
      slot,
    })
    container.addChild(slot.container)
  })

  return {
    container,
    update(nextEquippedState) {
      slots.forEach(({ id, slot }) => {
        const item = INVENTORY_ITEMS.find((entry) => entry.id === id)
        slot.update(item ? isItemEquipped(item, nextEquippedState) : false)
      })
    },
    tick(deltaSeconds) {
      slots.forEach(({ slot }) => {
        slot.tick?.(deltaSeconds)
      })
    },
    destroy() {
      slots.forEach(({ slot }) => {
        slot.destroy?.()
      })
    },
  }
}

export class HomeController {
  constructor(container) {
    this.container = container
    this.app = null
    this.cleanupFn = null
    this.started = false
    this.destroyed = false
  }

  async start() {
    if (this.started || !this.container) return

    this.started = true
    this.destroyed = false

    let disposed = false
    let initialized = false

    const app = new PIXI.Application()
    this.app = app

    await app.init({
      background: '#000000',
      antialias: true,
      resizeTo: this.container,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    initialized = true
    if (disposed || this.destroyed || !this.container) {
      app.destroy(true, { children: true })
      return
    }

    this.container.appendChild(app.canvas)

    const gameLayer = new PIXI.Container()
    app.stage.addChild(gameLayer)

    const readPersistedSettings = () =>
      normalizeGameSettings(loadGameSettings(GAME_SETTINGS_DEFAULTS))
    const persistedSettings = readPersistedSettings()
    let isPressureTestEnabled = persistedSettings.pressureTestEnabled
    let equippedState = {
      shipItemId: persistedSettings.equippedShipItemId,
      exhaustItemId: persistedSettings.equippedExhaustItemId,
    }
    let layoutScale = 1
    let layoutOffsetX = 0
    let layoutOffsetY = 0
    let animationTime = 0
    let isMusicEnabled = persistedSettings.musicEnabled !== false
    let isFpsVisible = persistedSettings.fpsEnabled !== false
    let isImpactEffectsEnabled = persistedSettings.impactEffectsEnabled !== false
    let isCatalogVisible = persistedSettings.catalogVisible === true
    let activeCatalogPreviewCode = persistedSettings.catalogPreviewCode
    let attackPower = persistedSettings.attackPower ?? PLAYER_STATS.attackPower
    let attackSpeed = persistedSettings.attackSpeed ?? PLAYER_STATS.attackSpeed
    let critChance = persistedSettings.critChance ?? PLAYER_STATS.critChance

    const applyPersistedSettings = (nextSettings) => {
      isPressureTestEnabled = nextSettings.pressureTestEnabled
      equippedState = {
        shipItemId: nextSettings.equippedShipItemId,
        exhaustItemId: nextSettings.equippedExhaustItemId,
      }
      isMusicEnabled = nextSettings.musicEnabled !== false
      isFpsVisible = nextSettings.fpsEnabled !== false
      isImpactEffectsEnabled = nextSettings.impactEffectsEnabled !== false
      isCatalogVisible = nextSettings.catalogVisible === true
      activeCatalogPreviewCode = nextSettings.catalogPreviewCode
      attackPower = nextSettings.attackPower ?? PLAYER_STATS.attackPower
      attackSpeed = nextSettings.attackSpeed ?? PLAYER_STATS.attackSpeed
      critChance = nextSettings.critChance ?? PLAYER_STATS.critChance
    }

    const persistSettings = (overrides = {}) => {
      saveGameSettings(
        {
          gameStarted: false,
          pressureTestEnabled: isPressureTestEnabled,
          equippedShipItemId: equippedState.shipItemId,
          equippedExhaustItemId: equippedState.exhaustItemId,
          musicEnabled: isMusicEnabled,
          fpsEnabled: isFpsVisible,
          impactEffectsEnabled: isImpactEffectsEnabled,
          catalogVisible: isCatalogVisible,
          catalogPreviewCode: activeCatalogPreviewCode,
          attackPower,
          attackSpeed,
          critChance,
          ...overrides,
        },
      )
    }

    const spaceBackdrop = createSpaceBackdrop({
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    })
    gameLayer.addChild(spaceBackdrop)

    const previewPanel = createShipPreviewPanel({
      x: 794,
      y: 34,
      width: 430,
      height: 520,
    })
    previewPanel.setTheme(getPreviewShipTheme(equippedState))
    previewPanel.setExhaustIndex(getPreviewExhaustIndex(equippedState))
    gameLayer.addChild(previewPanel.container)

    const catalogOverlay = createCatalogOverlay({
      x: 0,
      y: 0,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      entries: CATALOG_ENTRIES,
      onPreviewOpen: (code) => {
        activeCatalogPreviewCode = code
        persistSettings()
      },
      onPreviewClose: () => {
        activeCatalogPreviewCode = null
        persistSettings()
      },
      onClose: () => {
        catalogOverlay.hide()
        isCatalogVisible = false
        activeCatalogPreviewCode = null
        persistSettings()
      },
    })
    if (isCatalogVisible) {
      catalogOverlay.show()
      if (activeCatalogPreviewCode) {
        catalogOverlay.openPreviewByCode(activeCatalogPreviewCode)
      }
    }
    const getSettingsOverlayState = () => ({
      musicEnabled: isMusicEnabled,
      fpsEnabled: isFpsVisible,
      impactEffectsEnabled: isImpactEffectsEnabled,
      attackPower,
      attackSpeed,
      critChance,
    })
    const settingsOverlay = createSettingsOverlay({
      x: 0,
      y: 0,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      state: getSettingsOverlayState(),
      onMusicToggle: (enabled) => {
        isMusicEnabled = enabled
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())
      },
      onFpsToggle: (enabled) => {
        isFpsVisible = enabled
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())
      },
      onImpactEffectsToggle: (enabled) => {
        isImpactEffectsEnabled = enabled
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())
      },
      onAdjustStat: (key, direction) => {
        if (key === 'attackPower') attackPower = Math.max(1, Math.round(attackPower + direction))
        if (key === 'attackSpeed') attackSpeed = Math.max(1, Math.round((attackSpeed + direction * 0.5) * 10) / 10)
        if (key === 'critChance') {
          critChance = Math.max(0, Math.min(1, Math.round((critChance + direction * 0.05) * 100) / 100))
        }
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())
      },
      onCatalogOpen: () => {
        settingsOverlay.hide()
        catalogOverlay.toggle()
        isCatalogVisible = catalogOverlay.isVisible()
        if (!isCatalogVisible) {
          activeCatalogPreviewCode = null
        }
        persistSettings()
      },
      onClearData: () => {
        clearGameSettings()
      },
      onEnterDebugScene: () => {
        persistSettings({
          gameStarted: true,
          pressureTestEnabled: true,
        })
      },
      onLeave: () => {
        saveGameSettings({
          gameStarted: false,
        })
      },
      onClose: () => {
        settingsOverlay.hide()
      },
    })
    const settingsButton = createSettingsButton({
      x: LOGICAL_WIDTH - 64,
      y: 28,
      onTap: () => {
        settingsOverlay.toggle()
        settingsOverlay.update(getSettingsOverlayState())
      },
    })
    gameLayer.addChild(settingsButton.container)

    const itemDetailModal = createItemDetailModal({
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      onToggleEquip: (itemId) => {
        const selectedItem = INVENTORY_ITEMS.find((item) => item.id === itemId)
        if (!selectedItem) return
        equippedState = toggleEquippedItem(selectedItem, equippedState)
        inventoryPanel.update(equippedState)
        previewPanel.setTheme(getPreviewShipTheme(equippedState))
        previewPanel.setExhaustIndex(getPreviewExhaustIndex(equippedState))
        startButton.setEnabled(canStartGame(equippedState))
        itemDetailModal.update(selectedItem, equippedState)
        persistSettings()
      },
    })

    const startButton = createStartButton({
      x: 756,
      y: 597,
      width: 492,
      height: 100,
      label: '开始游戏',
      onTap: () => {
        if (!canStartGame(equippedState)) return
        isPressureTestEnabled = false
        persistSettings({
          gameStarted: true,
          pressureTestEnabled: isPressureTestEnabled,
        })
      },
    })
    startButton.setEnabled(canStartGame(equippedState))
    gameLayer.addChild(startButton.container)

    const inventoryPanel = createInventoryPanel({
      x: 28,
      y: 24,
      width: 702,
      height: 674,
      equippedState,
      onSelectItem: (item) => {
        itemDetailModal.update(item, equippedState)
      },
    })
    gameLayer.addChild(inventoryPanel.container)
    gameLayer.addChild(catalogOverlay.container)
    gameLayer.addChild(settingsOverlay.container)
    gameLayer.addChild(itemDetailModal.container)

    const syncFromStorage = () => {
      applyPersistedSettings(readPersistedSettings())
      inventoryPanel.update(equippedState)
      previewPanel.setTheme(getPreviewShipTheme(equippedState))
      previewPanel.setExhaustIndex(getPreviewExhaustIndex(equippedState))
      startButton.setEnabled(canStartGame(equippedState))
      settingsOverlay.update(getSettingsOverlayState())
    }
    window.addEventListener('game-settings-changed', syncFromStorage)

    const tick = (ticker) => {
      const deltaSeconds = ticker.deltaMS / 1000
      animationTime += deltaSeconds
      spaceBackdrop.update?.(deltaSeconds)
      catalogOverlay.update(deltaSeconds)
      const pulse = (Math.sin(animationTime * 3.1) + 1) * 0.5
      previewPanel.update(deltaSeconds, animationTime, pulse)
      previewPanel.shipScene.shipGroup.y = Math.sin(animationTime * 1.5) * 6
      previewPanel.shipScene.shipGroup.rotation = Math.sin(animationTime * 0.9) * 0.03
      previewPanel.shipScene.flameGlow.scale.set(0.94 + pulse * 0.16, 0.88 + pulse * 0.12)
      previewPanel.shipScene.flameCore.scale.set(0.92 + pulse * 0.28, 0.82 + pulse * 0.24)
      previewPanel.shipScene.flameInner.scale.set(0.9 + pulse * 0.16, 0.82 + pulse * 0.18)
      previewPanel.shipScene.flameGlow.alpha = 0.22 + pulse * 0.08
      previewPanel.shipScene.flameCore.alpha = 0.52 + pulse * 0.16
      previewPanel.shipScene.flameInner.alpha = 0.24 + pulse * 0.08
      inventoryPanel.tick(deltaSeconds)
      itemDetailModal.tick(deltaSeconds)
    }

    const layout = () => {
      layoutScale = Math.min(
        app.renderer.width / LOGICAL_WIDTH,
        app.renderer.height / LOGICAL_HEIGHT,
      )
      layoutOffsetX = (app.renderer.width - LOGICAL_WIDTH * layoutScale) * 0.5
      layoutOffsetY = (app.renderer.height - LOGICAL_HEIGHT * layoutScale) * 0.5
      gameLayer.scale.set(layoutScale)
      gameLayer.position.set(layoutOffsetX, layoutOffsetY)
    }

    app.renderer.on('resize', layout)
    app.ticker.add(tick)
    layout()

    this.cleanupFn = () => {
      if (disposed) return
      disposed = true

      if (this.app === app) {
        this.app = null
      }

      app.renderer.off('resize', layout)
      app.ticker.remove(tick)
      window.removeEventListener('game-settings-changed', syncFromStorage)
      previewPanel.destroy()
      inventoryPanel.destroy()
      itemDetailModal.destroy()

      if (initialized) {
        app.destroy(true, { children: true })
      }
    }
  }

  destroy() {
    this.destroyed = true
    this.started = false
    this.cleanupFn?.()
    this.cleanupFn = null
  }
}
