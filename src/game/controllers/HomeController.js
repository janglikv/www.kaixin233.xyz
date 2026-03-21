import * as PIXI from 'pixi.js'
import { CATALOG_ENTRIES } from '../data/catalogEntries'
import { SHIP_CATALOG } from '../data/shipCatalog'
import { PLAYER_SHIP_THEME } from '../data/shipCatalog'
import { EXHAUST_PLUGINS } from '../effects/exhaustPlugins'
import { createExhaustSwitcher } from '../effects/createExhaustSwitcher'
import { createCoinDisplay } from '../renderers/createCoinDisplay'
import { createCatalogOverlay, createModalCloseButton } from '../renderers/createCatalogOverlay'
import { createSettingsButton } from '../renderers/createSettingsButton'
import { createSettingsOverlay } from '../renderers/createSettingsOverlay'
import { createShip } from '../renderers/createShip'
import { createShipScene } from '../renderers/createShipScene'
import { createSpaceBackdrop } from '../renderers/createSpaceBackdrop'
import { clearGameSettings, loadGameSettings, saveGameSettings } from '../utils/gameSettingsStorage'
import { DEBUG_SCENE_FIXED_TARGET, DEBUG_SCENE_PRESSURE_TEST } from '../runtime/gameConfig'
import {
  PLAYER_STATS,
  clampAttackPower,
  clampAttackSpeed,
  clampCritChance,
  clampPlayerMaxHealth,
  parseAttackPowerInput,
  parseAttackSpeedInput,
  parseCritChanceInput,
  parsePlayerMaxHealthInput,
} from '../utils/playerStats'

const SHIP_DEFAULT_ITEM_ID = 'ship-frame-0'
const SHIP_FRAME_ITEM_ID = 'ship-frame-1'
const EXHAUST_0_ITEM_ID = 'exhaust-0'
const EXHAUST_1_ITEM_ID = 'exhaust-1'
const BASIC_EXHAUST_ITEM_ID = 'exhaust-5'
const HOMING_BURST_ITEM_ID = 'tactical-quick-wit'
const ITEM_PRICE = 100
const ITEM_SELL_RATE = 0.7
const SHIP_DEFAULT_ITEM_NAME = '机体 #0'
const SHIP_DEFAULT_ITEM_DESCRIPTION = '默认机体，维持当前基础机身外观，适合常规出击。'
const SHIP_FRAME_ITEM_NAME = '机体 #1'
const SHIP_FRAME_ITEM_DESCRIPTION = '标准机体组件，外观采用 #1 样式，可用于正常出击。'
const SHIP_FRAME_THEME = SHIP_CATALOG[1]?.theme ?? PLAYER_SHIP_THEME
const PREVIEW_THRUST_DISTANCE = 76 * 1.02
const PREVIEW_EFFECT_SCALE = 0.9
const PREVIEW_SHIP_ROTATION = 0.12
const LOGICAL_WIDTH = 1280
const LOGICAL_HEIGHT = 720
const GAME_SETTINGS_DEFAULTS = {
  gameStarted: false,
  pressureTestEnabled: false,
  debugSceneMode: null,
  equippedShipItemId: SHIP_DEFAULT_ITEM_ID,
  equippedExhaustItemId: BASIC_EXHAUST_ITEM_ID,
  equippedTacticalItemId: null,
  musicEnabled: true,
  fpsEnabled: true,
  impactEffectsEnabled: true,
  catalogVisible: false,
  attackPower: PLAYER_STATS.attackPower,
  attackSpeed: PLAYER_STATS.attackSpeed,
  critChance: PLAYER_STATS.critChance,
  playerMaxHealth: PLAYER_STATS.playerMaxHealth,
  coinCount: 0,
  purchasedItemIds: [],
}
const normalizeGameSettings = (settings) => {
  const legacyEquippedItemId =
    typeof settings.equippedItemId === 'string' ? settings.equippedItemId : null
  const legacyItem = legacyEquippedItemId
    ? INVENTORY_ITEMS?.find?.((item) => item.id === legacyEquippedItemId) ?? null
    : null
  const purchasedItemIds = Array.isArray(settings.purchasedItemIds)
    ? [...new Set(settings.purchasedItemIds.filter((itemId) => typeof itemId === 'string'))]
    : []
  const ownedItemIds = getOwnedItemIds(purchasedItemIds)
  const equippedShipItemId =
    typeof settings.equippedShipItemId === 'string'
      ? settings.equippedShipItemId
      : legacyItem?.kind === 'ship'
        ? legacyItem.id
        : SHIP_DEFAULT_ITEM_ID
  const equippedExhaustItemId =
    typeof settings.equippedExhaustItemId === 'string'
      ? settings.equippedExhaustItemId
      : legacyItem?.kind === 'exhaust'
        ? legacyItem.id
        : BASIC_EXHAUST_ITEM_ID
  const equippedTacticalItemId =
    typeof settings.equippedTacticalItemId === 'string'
      ? settings.equippedTacticalItemId
      : legacyItem?.kind === 'tactical'
        ? legacyItem.id
        : null

  return {
    gameStarted: settings.gameStarted === true,
    pressureTestEnabled: settings.pressureTestEnabled === true,
    debugSceneMode: typeof settings.debugSceneMode === 'string' ? settings.debugSceneMode : null,
    equippedShipItemId: ownedItemIds.has(equippedShipItemId) ? equippedShipItemId : SHIP_DEFAULT_ITEM_ID,
    equippedExhaustItemId: ownedItemIds.has(equippedExhaustItemId) ? equippedExhaustItemId : BASIC_EXHAUST_ITEM_ID,
    equippedTacticalItemId: ownedItemIds.has(equippedTacticalItemId) ? equippedTacticalItemId : null,
    musicEnabled: Boolean(settings.musicEnabled),
    fpsEnabled: settings.fpsEnabled !== false,
    impactEffectsEnabled: settings.impactEffectsEnabled !== false,
    catalogVisible: settings.catalogVisible === true,
    catalogPreviewCode: typeof settings.catalogPreviewCode === 'string' ? settings.catalogPreviewCode : null,
    attackPower: clampAttackPower(settings.attackPower),
    attackSpeed: clampAttackSpeed(settings.attackSpeed),
    critChance: clampCritChance(settings.critChance),
    playerMaxHealth: clampPlayerMaxHealth(settings.playerMaxHealth),
    coinCount: Number.isFinite(settings.coinCount) ? Math.max(0, Math.floor(settings.coinCount)) : 0,
    purchasedItemIds,
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

const createHomePanelTab = ({ x, y, label, active = false, onTap }) => {
  const container = new PIXI.Container()
  const bg = new PIXI.Graphics()
  const text = new PIXI.Text({
    text: label,
    style: {
      fill: 0xeaf6ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 21,
      fontWeight: '700',
      letterSpacing: 1.4,
    },
  })
  let currentActive = active

  const draw = (hovered = false) => {
    bg
      .clear()
      .roundRect(0, 0, 114, 46, 15)
      .fill({
        color: currentActive ? 0x184886 : hovered ? 0x133155 : 0x0b1830,
        alpha: currentActive ? 0.98 : 0.92,
      })
      .stroke({
        color: currentActive ? 0xa8ebff : hovered ? 0x7fcfff : 0x35557f,
        width: currentActive ? 2.4 : 2,
        alpha: 0.95,
      })
  }

  draw(false)
  container.position.set(x, y)
  container.eventMode = 'static'
  container.cursor = 'pointer'
  text.anchor.set(0.5)
  text.position.set(57, 23)
  container.addChild(bg)
  container.addChild(text)
  container.on('pointertap', onTap)
  container.on('pointerover', () => draw(true))
  container.on('pointerout', () => draw(false))

  return {
    container,
    setActive(nextActive) {
      currentActive = nextActive
      draw(false)
    },
  }
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

const createTacticalChipIcon = ({ size }) => {
  const container = new PIXI.Container()
  const scale = size / 196
  const board = new PIXI.Graphics()
  const pulseRing = new PIXI.Graphics()
  const core = new PIXI.Graphics()
  const traces = new PIXI.Graphics()
  let elapsed = 0

  board
    .roundRect(size * 0.18, size * 0.18, size * 0.64, size * 0.64, 20 * scale)
    .fill({ color: 0x10243f, alpha: 0.98 })
    .stroke({ color: 0x6ec8ff, width: 3 * scale, alpha: 0.95 })
  container.addChild(board)

  ;[
    [0.5, 0.18, 0.5, 0.34],
    [0.5, 0.66, 0.5, 0.82],
    [0.18, 0.5, 0.34, 0.5],
    [0.66, 0.5, 0.82, 0.5],
    [0.3, 0.3, 0.4, 0.4],
    [0.7, 0.3, 0.6, 0.4],
    [0.3, 0.7, 0.4, 0.6],
    [0.7, 0.7, 0.6, 0.6],
  ].forEach(([x1, y1, x2, y2]) => {
    traces
      .moveTo(size * x1, size * y1)
      .lineTo(size * x2, size * y2)
      .stroke({ color: 0x57b8ff, width: 3 * scale, alpha: 0.92, cap: 'round' })
  })
  container.addChild(traces)

  pulseRing
    .circle(size * 0.5, size * 0.5, size * 0.18)
    .stroke({ color: 0xffd86c, width: 5 * scale, alpha: 0.9 })
  container.addChild(pulseRing)

  core
    .circle(size * 0.5, size * 0.5, size * 0.09)
    .fill({ color: 0xfff0b8, alpha: 0.98 })
  container.addChild(core)

  return {
    container,
    update(equipped) {
      container.alpha = equipped ? 1 : 0.94
      core.tint = equipped ? 0xffffff : 0xfff0b8
    },
    tick(deltaSeconds) {
      elapsed += deltaSeconds
      const pulse = (Math.sin(elapsed * 4.8) + 1) * 0.5
      pulseRing.scale.set(0.92 + pulse * 0.18)
      pulseRing.alpha = 0.36 + pulse * 0.48
      core.scale.set(0.94 + pulse * 0.12)
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

const createItemDetailModal = ({ width, height, onToggleEquip, onPurchaseItem, onSellItem }) => {
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

  const closeButton = createModalCloseButton({
    x: panelWidth - 51,
    y: 21,
    onTap: (event) => {
      event.stopPropagation()
      container.visible = false
    },
  })
  panel.addChild(closeButton)

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

  const actionButtonWidth = 220
  const actionButtonSpacing = 20
  const buttonRowWidth = actionButtonWidth * 2 + actionButtonSpacing
  const buttonRowStartX = (panelWidth - buttonRowWidth) * 0.5
  const buttonRowY = panelHeight - 84

  const actionButton = createModalButton({
    x: buttonRowStartX,
    y: buttonRowY,
    width: actionButtonWidth,
    height: 52,
    label: '装备',
    onTap: () => {
      if (!currentItem) return
      if (currentMode === 'shop') {
        if (currentOwned) return
        const result = onPurchaseItem?.(currentItem.id)
        if (result?.ok === false) {
          statusText.text = result.message ?? '当前状态: 购买失败'
          return
        }
      } else {
        onToggleEquip(currentItem.id)
      }
      container.visible = false
    },
  })
  panel.addChild(actionButton.container)

  const sellButton = createModalButton({
    x: buttonRowStartX + actionButtonWidth + actionButtonSpacing,
    y: buttonRowY,
    width: actionButtonWidth,
    height: 52,
    label: '出售',
    variant: 'secondary',
    onTap: () => {
      if (!currentItem) return
      const result = onSellItem?.(currentItem.id)
      if (result?.ok === false) {
        statusText.text = result.message ?? '当前状态: 出售失败'
        return
      }
      container.visible = false
    },
  })
  panel.addChild(sellButton.container)

  let currentItem = null
  let currentIcon = null
  let currentMode = 'warehouse'
  let currentOwned = false

  return {
    container,
    hide() {
      container.visible = false
    },
    update(item, equippedState, options = {}) {
      const { mode = 'warehouse', purchasedItemIds = [] } = options
      const owned = isItemOwned(item, purchasedItemIds)
      const equipped = isItemEquipped(item, equippedState)

      currentItem = item
      currentMode = mode
      currentOwned = owned
      titleText.text = item.name
      statusText.text =
        mode === 'shop'
          ? owned
            ? '当前状态: 已拥有'
            : `当前状态: 售价 ${item.price ?? ITEM_PRICE} 金币`
          : equipped
            ? '当前状态: 已装备'
            : '当前状态: 未装备'
      descText.text = item.description
      actionButton.setLabel(
        mode === 'shop' ? (owned ? '已拥有' : `购买 ${item.price ?? ITEM_PRICE}`) : equipped ? '取消装备' : '装备',
      )
      sellButton.container.visible = mode === 'warehouse' && owned && !isBaseWarehouseItem(item)
      if (sellButton.container.visible) {
        sellButton.setLabel(`出售 ${getItemSellPrice(item)}`)
      }

      if (currentIcon) {
        iconHost.removeChild(currentIcon.container)
        currentIcon.container.destroy({ children: true })
      }
      currentIcon = item.drawIcon({ size: 196 })
      currentIcon.update?.(equipped || owned)
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

const createInventorySlot = ({ x, y, size, equipped, drawIcon, price = null, onTap }) => {
  const scale = size / 184
  const slot = new PIXI.Container()
  slot.position.set(x, y)
  slot.eventMode = 'static'
  slot.cursor = 'pointer'

  const bg = new PIXI.Graphics()
  const icon = drawIcon({ size })
  const badge = new PIXI.Graphics()
  const priceText = new PIXI.Text({
    text: '',
    style: {
      fill: 0xffde7a,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
  })

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

    if (price != null) {
      priceText.visible = true
      priceText.text = `${price}`
      priceText.anchor.set(0.5)
      priceText.position.set(size * 0.5, size + 34 * scale)
    } else {
      priceText.visible = false
    }
  }

  draw(false, equipped)
  slot.addChild(bg)
  slot.addChild(icon.container)
  slot.addChild(badge)
  slot.addChild(priceText)
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

const TACTICAL_ITEMS = [
  {
    id: HOMING_BURST_ITEM_ID,
    kind: 'tactical',
    name: '暴击锁定',
    description: '暴击时实时发射追踪弹，仅锁定被暴击目标；目标丢失后直线飞行。',
    drawIcon: ({ size }) => createTacticalChipIcon({ size }),
  },
]

const INVENTORY_ITEMS = [
  ...SHIP_ITEMS,
  ...EXHAUST_ITEMS,
  ...TACTICAL_ITEMS,
]
const WAREHOUSE_ITEM_IDS = new Set([SHIP_DEFAULT_ITEM_ID, BASIC_EXHAUST_ITEM_ID])
const SHOP_ITEMS = INVENTORY_ITEMS.filter((item) => !WAREHOUSE_ITEM_IDS.has(item.id)).map((item) => ({
  ...item,
  price: ITEM_PRICE,
}))
const ITEM_BY_ID = new Map([...INVENTORY_ITEMS, ...SHOP_ITEMS].map((item) => [item.id, item]))

const getOwnedItemIds = (purchasedItemIds = []) =>
  new Set([...WAREHOUSE_ITEM_IDS, ...purchasedItemIds.filter((itemId) => ITEM_BY_ID.has(itemId))])

const isItemOwned = (item, purchasedItemIds = []) => getOwnedItemIds(purchasedItemIds).has(item.id)
const isBaseWarehouseItem = (item) => WAREHOUSE_ITEM_IDS.has(item.id)
const getItemPrice = (item) => item.price ?? ITEM_PRICE
const getItemSellPrice = (item) => Math.floor(getItemPrice(item) * ITEM_SELL_RATE)

const isItemEquipped = (item, equippedState) => {
  if (item.kind === 'ship') return equippedState.shipItemId === item.id
  if (item.kind === 'exhaust') return equippedState.exhaustItemId === item.id
  if (item.kind === 'tactical') return equippedState.tacticalItemId === item.id
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
  if (item.kind === 'tactical') {
    return {
      ...equippedState,
      tacticalItemId: equippedState.tacticalItemId === item.id ? null : item.id,
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

const createInventoryPanel = ({
  x,
  y,
  width,
  height,
  equippedState,
  coinCount = 0,
  purchasedItemIds = [],
  onSelectItem,
}) => {
  const container = createPanelFrame({ x, y, width, height })
  let currentEquippedState = equippedState
  let currentPurchasedItemIds = purchasedItemIds
  const slotSize = 94
  const colGap = 14
  const rowGap = 42
  const columns = 6
  const warehouseContent = new PIXI.Container()
  const shopContent = new PIXI.Container()
  const slotEntries = []
  const coinDisplay = createCoinDisplay()
  const coinText = new PIXI.Text({
    text: '',
    style: {
      fill: 0xffe28a,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: 1,
    },
  })
  const shopHint = new PIXI.Text({
    text: '商城建设中',
    style: {
      fill: 0xffde7a,
      fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: 1.2,
    },
  })
  const shopSubHint = new PIXI.Text({
    text: '后续会在这里开放道具购买与解锁。',
    style: {
      fill: 0x9ec8ef,
      fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
      fontSize: 18,
      fontWeight: '600',
    },
  })
  const warehouseTab = createHomePanelTab({
    x: 24,
    y: 16,
    label: '仓库',
    active: true,
    onTap: () => {
      showWarehouse()
    },
  })
  const shopTab = createHomePanelTab({
    x: 148,
    y: 16,
    label: '商城',
    active: false,
    onTap: () => {
      showShop()
    },
  })

  const showWarehouse = () => {
      warehouseContent.visible = true
      shopContent.visible = false
      warehouseTab.setActive(true)
      shopTab.setActive(false)
  }

  const showShop = () => {
      warehouseContent.visible = false
      shopContent.visible = true
      warehouseTab.setActive(false)
      shopTab.setActive(true)
  }

  container.addChild(warehouseTab.container)
  container.addChild(shopTab.container)

  coinDisplay.scale.set(1.05)
  container.addChild(coinDisplay)

  coinText.anchor.set(1, 0.5)
  coinText.position.set(width - 28, 36)
  container.addChild(coinText)

  const setCoinCount = (nextCoinCount) => {
    coinText.text = `${Math.max(0, Math.floor(nextCoinCount ?? 0))}`
    coinDisplay.position.set(coinText.x - coinText.width - 26, 36)
  }
  setCoinCount(coinCount)

  const clearSlots = () => {
    slotEntries.forEach(({ slot, targetContainer }) => {
      targetContainer.removeChild(slot.container)
      slot.destroy?.()
    })
    slotEntries.length = 0
  }

  const appendSlots = (items, targetContainer, mode) => {
    items.forEach((item, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const slot = createInventorySlot({
        x: 36 + column * (slotSize + colGap),
        y: 86 + row * (slotSize + rowGap),
        size: slotSize,
        equipped: isItemEquipped(item, currentEquippedState),
        drawIcon: item.drawIcon,
        price: mode === 'shop' ? item.price ?? ITEM_PRICE : null,
        onTap: () => {
          onSelectItem(item, mode)
        },
      })
      slotEntries.push({
        item,
        slot,
        targetContainer,
      })
      targetContainer.addChild(slot.container)
    })
  }

  shopHint.anchor.set(0.5)
  shopHint.position.set(width * 0.5, 282)
  shopSubHint.anchor.set(0.5)
  shopSubHint.position.set(width * 0.5, 328)

  const renderItems = (nextEquippedState, nextPurchasedItemIds = []) => {
    currentEquippedState = nextEquippedState
    currentPurchasedItemIds = nextPurchasedItemIds
    clearSlots()
    const ownedItemIds = getOwnedItemIds(currentPurchasedItemIds)
    const warehouseItems = INVENTORY_ITEMS.filter((item) => ownedItemIds.has(item.id))
    const shopItems = SHOP_ITEMS

    appendSlots(warehouseItems, warehouseContent, 'warehouse')
    appendSlots(shopItems, shopContent, 'shop')

    if (shopItems.length === 0) {
      if (!shopContent.children.includes(shopHint)) {
        shopContent.addChild(shopHint)
        shopContent.addChild(shopSubHint)
      }
    } else {
      if (shopHint.parent === shopContent) {
        shopContent.removeChild(shopHint)
      }
      if (shopSubHint.parent === shopContent) {
        shopContent.removeChild(shopSubHint)
      }
    }
  }

  showWarehouse()
  container.addChild(warehouseContent)
  container.addChild(shopContent)
  renderItems(equippedState, purchasedItemIds)

  return {
    container,
    setCoinCount,
    showWarehouse,
    showShop,
    update(nextEquippedState, nextPurchasedItemIds = currentPurchasedItemIds) {
      renderItems(nextEquippedState, nextPurchasedItemIds)
    },
    tick(deltaSeconds) {
      slotEntries.forEach(({ slot }) => {
        slot.tick?.(deltaSeconds)
      })
    },
    destroy() {
      slotEntries.forEach(({ slot }) => {
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
    let debugSceneMode = persistedSettings.debugSceneMode
    let equippedState = {
      shipItemId: persistedSettings.equippedShipItemId,
      exhaustItemId: persistedSettings.equippedExhaustItemId,
      tacticalItemId: persistedSettings.equippedTacticalItemId,
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
    let playerMaxHealth = persistedSettings.playerMaxHealth ?? PLAYER_STATS.playerMaxHealth
    let coinCount = persistedSettings.coinCount ?? 0
    let purchasedItemIds = persistedSettings.purchasedItemIds ?? []

    const applyPersistedSettings = (nextSettings) => {
      isPressureTestEnabled = nextSettings.pressureTestEnabled
      debugSceneMode = nextSettings.debugSceneMode
      equippedState = {
        shipItemId: nextSettings.equippedShipItemId,
        exhaustItemId: nextSettings.equippedExhaustItemId,
        tacticalItemId: nextSettings.equippedTacticalItemId,
      }
      isMusicEnabled = nextSettings.musicEnabled !== false
      isFpsVisible = nextSettings.fpsEnabled !== false
      isImpactEffectsEnabled = nextSettings.impactEffectsEnabled !== false
      isCatalogVisible = nextSettings.catalogVisible === true
      activeCatalogPreviewCode = nextSettings.catalogPreviewCode
      attackPower = nextSettings.attackPower ?? PLAYER_STATS.attackPower
      attackSpeed = nextSettings.attackSpeed ?? PLAYER_STATS.attackSpeed
      critChance = nextSettings.critChance ?? PLAYER_STATS.critChance
      playerMaxHealth = nextSettings.playerMaxHealth ?? PLAYER_STATS.playerMaxHealth
      coinCount = nextSettings.coinCount ?? 0
      purchasedItemIds = nextSettings.purchasedItemIds ?? []
    }

    const persistSettings = (overrides = {}) => {
      saveGameSettings(
        {
          gameStarted: false,
          pressureTestEnabled: isPressureTestEnabled,
          debugSceneMode,
          equippedShipItemId: equippedState.shipItemId,
          equippedExhaustItemId: equippedState.exhaustItemId,
          equippedTacticalItemId: equippedState.tacticalItemId,
          musicEnabled: isMusicEnabled,
          fpsEnabled: isFpsVisible,
          impactEffectsEnabled: isImpactEffectsEnabled,
          catalogVisible: isCatalogVisible,
          catalogPreviewCode: activeCatalogPreviewCode,
          attackPower,
          attackSpeed,
          critChance,
          playerMaxHealth,
          coinCount,
          purchasedItemIds,
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
      playerMaxHealth,
      coinCount,
    })
    const settingsOverlay = createSettingsOverlay({
      x: 0,
      y: 0,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      showLeaveButton: false,
      state: getSettingsOverlayState(),
      getDomRect: ({ x: logicalX, y: logicalY, width: logicalWidth, height: logicalHeight }) => {
        const rect = app.canvas.getBoundingClientRect()
        return {
          left: rect.left + layoutOffsetX + logicalX * layoutScale,
          top: rect.top + layoutOffsetY + logicalY * layoutScale,
          width: logicalWidth * layoutScale,
          height: logicalHeight * layoutScale,
        }
      },
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
        if (key === 'attackSpeed') {
          attackSpeed = clampAttackSpeed(attackSpeed + direction * 0.5)
        }
        if (key === 'critChance') {
          critChance = Math.max(0, Math.min(1, Math.round((critChance + direction * 0.05) * 100) / 100))
        }
        if (key === 'playerMaxHealth') {
          playerMaxHealth = clampPlayerMaxHealth(playerMaxHealth + direction)
        }
        if (key === 'coinCount') {
          coinCount = Math.max(0, Math.floor(coinCount + direction))
          inventoryPanel.setCoinCount(coinCount)
        }
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())
      },
      onSaveAttackPower: (value) => {
        const nextAttackPower = parseAttackPowerInput(value)
        if (nextAttackPower == null) {
          return {
            ok: false,
            error: '请输入有效的攻击力数值',
          }
        }

        attackPower = nextAttackPower
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())

        return { ok: true }
      },
      onSavePlayerMaxHealth: (value) => {
        const nextPlayerMaxHealth = parsePlayerMaxHealthInput(value)
        if (nextPlayerMaxHealth == null) {
          return {
            ok: false,
            error: '请输入有效的生命值数值',
          }
        }

        playerMaxHealth = nextPlayerMaxHealth
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())

        return { ok: true }
      },
      onSaveAttackSpeed: (value) => {
        const nextAttackSpeed = parseAttackSpeedInput(value)
        if (nextAttackSpeed == null) {
          return {
            ok: false,
            error: '请输入有效的攻速数值',
          }
        }

        attackSpeed = nextAttackSpeed
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())

        return { ok: true }
      },
      onSaveCritChance: (value) => {
        const nextCritChance = parseCritChanceInput(value)
        if (nextCritChance == null) {
          return {
            ok: false,
            error: '请输入有效的暴击率数值',
          }
        }

        critChance = nextCritChance
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())

        return { ok: true }
      },
      onSaveCoinCount: (value) => {
        const nextCoinCount = Number(value)
        if (!Number.isFinite(nextCoinCount) || nextCoinCount < 0) {
          return {
            ok: false,
            error: '请输入有效的非负金币数值',
          }
        }

        coinCount = Math.floor(nextCoinCount)
        persistSettings()
        inventoryPanel.setCoinCount(coinCount)
        settingsOverlay.update(getSettingsOverlayState())

        return { ok: true }
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
      onEnterPressureTestScene: () => {
        persistSettings({
          gameStarted: true,
          pressureTestEnabled: true,
          debugSceneMode: DEBUG_SCENE_PRESSURE_TEST,
        })
      },
      onEnterFixedTargetScene: () => {
        persistSettings({
          gameStarted: true,
          pressureTestEnabled: true,
          debugSceneMode: DEBUG_SCENE_FIXED_TARGET,
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
        inventoryPanel.update(equippedState, purchasedItemIds)
        previewPanel.setTheme(getPreviewShipTheme(equippedState))
        previewPanel.setExhaustIndex(getPreviewExhaustIndex(equippedState))
        startButton.setEnabled(canStartGame(equippedState))
        itemDetailModal.update(selectedItem, equippedState, {
          mode: 'warehouse',
          purchasedItemIds,
        })
        persistSettings()
      },
      onPurchaseItem: (itemId) => {
        const selectedItem = ITEM_BY_ID.get(itemId)
        if (!selectedItem) {
          return { ok: false, message: '当前状态: 物品不存在' }
        }
        if (isItemOwned(selectedItem, purchasedItemIds)) {
          return { ok: false, message: '当前状态: 已拥有' }
        }
        if (coinCount < (selectedItem.price ?? ITEM_PRICE)) {
          return { ok: false, message: '当前状态: 金币不足' }
        }

        coinCount -= selectedItem.price ?? ITEM_PRICE
        purchasedItemIds = [...new Set([...purchasedItemIds, itemId])]
        inventoryPanel.setCoinCount(coinCount)
        inventoryPanel.update(equippedState, purchasedItemIds)
        inventoryPanel.showWarehouse()
        settingsOverlay.update(getSettingsOverlayState())
        persistSettings()
        return { ok: true }
      },
      onSellItem: (itemId) => {
        const selectedItem = ITEM_BY_ID.get(itemId)
        if (!selectedItem) {
          return { ok: false, message: '当前状态: 物品不存在' }
        }
        if (isBaseWarehouseItem(selectedItem)) {
          return { ok: false, message: '当前状态: 基础物品不可出售' }
        }
        if (!purchasedItemIds.includes(itemId)) {
          return { ok: false, message: '当前状态: 仅可出售已购买物品' }
        }

        coinCount += getItemSellPrice(selectedItem)
        purchasedItemIds = purchasedItemIds.filter((ownedItemId) => ownedItemId !== itemId)

        if (selectedItem.kind === 'ship' && equippedState.shipItemId === itemId) {
          equippedState = {
            ...equippedState,
            shipItemId: SHIP_DEFAULT_ITEM_ID,
          }
        }
        if (selectedItem.kind === 'exhaust' && equippedState.exhaustItemId === itemId) {
          equippedState = {
            ...equippedState,
            exhaustItemId: BASIC_EXHAUST_ITEM_ID,
          }
        }
        if (selectedItem.kind === 'tactical' && equippedState.tacticalItemId === itemId) {
          equippedState = {
            ...equippedState,
            tacticalItemId: null,
          }
        }

        inventoryPanel.setCoinCount(coinCount)
        inventoryPanel.update(equippedState, purchasedItemIds)
        previewPanel.setTheme(getPreviewShipTheme(equippedState))
        previewPanel.setExhaustIndex(getPreviewExhaustIndex(equippedState))
        startButton.setEnabled(canStartGame(equippedState))
        settingsOverlay.update(getSettingsOverlayState())
        persistSettings()
        return { ok: true }
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
        debugSceneMode = null
        persistSettings({
          gameStarted: true,
          pressureTestEnabled: isPressureTestEnabled,
          debugSceneMode,
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
      coinCount,
      purchasedItemIds,
      onSelectItem: (item, mode) => {
        itemDetailModal.update(item, equippedState, {
          mode,
          purchasedItemIds,
        })
      },
    })
    inventoryPanel.setCoinCount(coinCount)
    gameLayer.addChild(inventoryPanel.container)
    gameLayer.addChild(catalogOverlay.container)
    gameLayer.addChild(settingsOverlay.container)
    gameLayer.addChild(itemDetailModal.container)

    const syncFromStorage = () => {
      applyPersistedSettings(readPersistedSettings())
      inventoryPanel.update(equippedState, purchasedItemIds)
      inventoryPanel.setCoinCount(coinCount)
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
