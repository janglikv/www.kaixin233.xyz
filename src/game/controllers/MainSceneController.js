import * as PIXI from 'pixi.js'
import { PLAYER_SHIP_THEME } from '../data/shipCatalog'
import { createShipScene } from '../renderers/createShipScene'
import { createSettingsButton } from '../renderers/createSettingsButton'
import { createSpaceBackdrop } from '../renderers/createSpaceBackdrop'
import { loadGameSettings, saveGameSettings } from '../utils/gameSettingsStorage'

const LOGICAL_WIDTH = 1280
const LOGICAL_HEIGHT = 720
const GAME_SETTINGS_DEFAULTS = {
  pressureTestEnabled: true,
}

const normalizeGameSettings = (settings) => ({
  pressureTestEnabled: settings.pressureTestEnabled !== false,
})

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

  const shipScene = createShipScene({
    x: width * 0.5,
    y: height * 0.44,
    shipScale: 1.02,
    shipRotation: 0.12,
    shipTheme: PLAYER_SHIP_THEME,
    showFlame: true,
  })
  container.addChild(shipScene.shipGroup)

  return {
    container,
    shipScene,
  }
}

const createInventorySlot = ({ x, y, size, label, color, quantity }) => {
  const slot = new PIXI.Container()
  slot.position.set(x, y)

  const bg = new PIXI.Graphics()
  bg
    .roundRect(0, 0, size, size, 18)
    .fill({ color: 0x08101d, alpha: 0.94 })
    .stroke({ color: 0x2a4467, width: 2, alpha: 0.95 })
  slot.addChild(bg)

  const icon = new PIXI.Graphics()
  icon
    .circle(size * 0.5, 30, 12)
    .fill({ color, alpha: 0.9 })
    .roundRect(size * 0.5 - 16, 48, 32, 12, 6)
    .fill({ color, alpha: 0.74 })
  slot.addChild(icon)

  const name = new PIXI.Text({
    text: label,
    style: {
      fill: 0xdbeeff,
      fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
      fontSize: 13,
      fontWeight: '700',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: size - 12,
    },
  })
  name.anchor.set(0.5, 0)
  name.position.set(size * 0.5, 66)
  slot.addChild(name)

  const qty = new PIXI.Text({
    text: `x${quantity}`,
    style: {
      fill: 0x87d8ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 12,
      fontWeight: '700',
    },
  })
  qty.anchor.set(1, 1)
  qty.position.set(size - 10, size - 8)
  slot.addChild(qty)

  return slot
}

const createInventoryPanel = ({ x, y, width, height }) => {
  const container = createPanelFrame({ x, y, width, height })

  container.addChild(
    createSectionTitle({
      text: '物品栏',
      x: 28,
      y: 24,
    }),
  )

  const items = [
    ['修复组件', 0x6fffe9, 8],
    ['等离子芯片', 0x5aa9ff, 14],
    ['高能电池', 0xf7b267, 5],
    ['护盾模块', 0xc77dff, 3],
    ['追踪弹匣', 0xff6b6b, 12],
    ['跃迁许可', 0xf4f1de, 1],
  ]

  items.forEach(([label, color, quantity], index) => {
    container.addChild(
      createInventorySlot({
        x: 24 + index * 98,
        y: 76,
        size: 84,
        label,
        color,
        quantity,
      }),
    )
  })

  return container
}

const createToggleButton = ({ x, y, width, height, label, onTap }) => {
  const container = new PIXI.Container()
  container.position.set(x, y)
  container.eventMode = 'static'
  container.cursor = 'pointer'

  const bg = new PIXI.Graphics()
  const text = new PIXI.Text({
    text: label,
    style: {
      fill: 0xe9f4ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 18,
      fontWeight: '700',
    },
  })

  const draw = (hovered = false) => {
    bg
      .clear()
      .roundRect(0, 0, width, height, 12)
      .fill({
        color: hovered ? 0x15325f : 0x0a1836,
        alpha: 0.94,
      })
      .stroke({
        color: hovered ? 0x7fcfff : 0x48638f,
        width: 2,
        alpha: 0.95,
      })
  }

  draw(false)
  text.anchor.set(0.5)
  text.position.set(width * 0.5, height * 0.5)
  container.addChild(bg)
  container.addChild(text)
  container.on('pointertap', onTap)
  container.on('pointerover', () => draw(true))
  container.on('pointerout', () => draw(false))

  return {
    container,
    update(nextLabel) {
      text.text = nextLabel
    },
  }
}

const createMainSceneSettingsOverlay = ({ x, y, width, height, enabled, onToggle, onClose }) => {
  const container = new PIXI.Container()
  container.position.set(x, y)
  container.visible = false

  const bg = new PIXI.Graphics()
  bg.rect(0, 0, width, height).fill({ color: 0x050a15, alpha: 0.96 })
  container.addChild(bg)

  const panel = new PIXI.Graphics()
  panel
    .roundRect(width * 0.5 - 250, 120, 500, 240, 24)
    .fill({ color: 0x081225, alpha: 0.96 })
    .stroke({ color: 0x28426c, width: 2, alpha: 0.95 })
  container.addChild(panel)

  const title = new PIXI.Text({
    text: '设置',
    style: {
      fill: 0xe9f4ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 36,
      fontWeight: '700',
    },
  })
  title.position.set(width * 0.5 - 214, 150)
  container.addChild(title)

  const subtitle = new PIXI.Text({
    text: '切换后会重新进入对应场景',
    style: {
      fill: 0x8dbdff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 14,
    },
  })
  subtitle.position.set(width * 0.5 - 214, 198)
  container.addChild(subtitle)

  const label = new PIXI.Text({
    text: '压力测试场景',
    style: {
      fill: 0xe9f4ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 24,
      fontWeight: '700',
    },
  })
  label.position.set(width * 0.5 - 214, 256)
  container.addChild(label)

  const valueText = new PIXI.Text({
    text: '',
    style: {
      fill: 0xf5fbff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 20,
      fontWeight: '700',
    },
  })
  valueText.anchor.set(1, 0.5)
  valueText.position.set(width * 0.5 + 118, 274)
  container.addChild(valueText)

  let currentValue = enabled
  const toggleButton = createToggleButton({
    x: width * 0.5 + 132,
    y: 256,
    width: 96,
    height: 40,
    label: '',
    onTap: () => {
      currentValue = !currentValue
      update(currentValue)
      onToggle(currentValue)
    },
  })
  container.addChild(toggleButton.container)

  const closeButton = createToggleButton({
    x: width * 0.5 - 48,
    y: 324,
    width: 96,
    height: 40,
    label: '关闭',
    onTap: onClose,
  })
  container.addChild(closeButton.container)

  const update = (nextEnabled) => {
    currentValue = nextEnabled
    valueText.text = currentValue ? '已开启' : '已关闭'
    toggleButton.update(currentValue ? '关闭' : '开启')
  }

  update(enabled)

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
    hide() {
      container.visible = false
    },
    isVisible() {
      return container.visible
    },
    update,
  }
}

export class MainSceneController {
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

    const persistedSettings = normalizeGameSettings(loadGameSettings(GAME_SETTINGS_DEFAULTS))
    let isPressureTestEnabled = persistedSettings.pressureTestEnabled
    let layoutScale = 1
    let layoutOffsetX = 0
    let layoutOffsetY = 0
    let settingsBounds = null
    let settingsButtonBounds = null
    let isSettingsVisible = false
    let animationTime = 0

    const persistSettings = () => {
      saveGameSettings(
        {
          ...loadGameSettings({}),
          pressureTestEnabled: isPressureTestEnabled,
        },
      )
    }

    gameLayer.addChild(
      createSpaceBackdrop({
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
      }),
    )

    const previewPanel = createShipPreviewPanel({
      x: 56,
      y: 64,
      width: 430,
      height: 634,
    })
    gameLayer.addChild(previewPanel.container)

    const inventoryPanel = createInventoryPanel({
      x: 516,
      y: 64,
      width: 708,
      height: 634,
    })
    gameLayer.addChild(inventoryPanel)

    const settingsOverlay = createMainSceneSettingsOverlay({
      x: 0,
      y: 0,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      enabled: isPressureTestEnabled,
      onToggle: (enabled) => {
        isPressureTestEnabled = enabled
        persistSettings()
        settingsOverlay.update(isPressureTestEnabled)
      },
      onClose: () => {
        settingsOverlay.hide()
        isSettingsVisible = false
      },
    })

    const settingsButton = createSettingsButton({
      x: LOGICAL_WIDTH - 48,
      y: 14,
      onTap: () => {
        settingsOverlay.toggle()
        isSettingsVisible = settingsOverlay.isVisible()
        settingsOverlay.update(isPressureTestEnabled)
      },
    })

    settingsBounds = settingsOverlay.bounds
    settingsButtonBounds = settingsButton.bounds

    gameLayer.addChild(settingsButton.container)
    gameLayer.addChild(settingsOverlay.container)

    const handlePointerDown = (event) => {
      if (!isSettingsVisible) return

      const rect = app.canvas.getBoundingClientRect()
      const logicalX = (event.clientX - rect.left - layoutOffsetX) / layoutScale
      const logicalY = (event.clientY - rect.top - layoutOffsetY) / layoutScale
      const insideSettingsButton =
        settingsButtonBounds &&
        logicalX >= settingsButtonBounds.left &&
        logicalX <= settingsButtonBounds.right &&
        logicalY >= settingsButtonBounds.top &&
        logicalY <= settingsButtonBounds.bottom
      const insideSettings =
        settingsBounds &&
        logicalX >= settingsBounds.left &&
        logicalX <= settingsBounds.right &&
        logicalY >= settingsBounds.top &&
        logicalY <= settingsBounds.bottom

      if (!insideSettings && !insideSettingsButton) {
        settingsOverlay.hide()
        isSettingsVisible = false
      }
    }

    const tick = (ticker) => {
      animationTime += ticker.deltaMS / 1000
      const pulse = (Math.sin(animationTime * 3.1) + 1) * 0.5
      previewPanel.shipScene.shipGroup.y = Math.sin(animationTime * 1.5) * 6
      previewPanel.shipScene.shipGroup.rotation = Math.sin(animationTime * 0.9) * 0.03
      previewPanel.shipScene.flameGlow.scale.set(0.94 + pulse * 0.16, 0.88 + pulse * 0.12)
      previewPanel.shipScene.flameCore.scale.set(0.92 + pulse * 0.28, 0.82 + pulse * 0.24)
      previewPanel.shipScene.flameInner.scale.set(0.9 + pulse * 0.16, 0.82 + pulse * 0.18)
      previewPanel.shipScene.flameGlow.alpha = 0.22 + pulse * 0.08
      previewPanel.shipScene.flameCore.alpha = 0.52 + pulse * 0.16
      previewPanel.shipScene.flameInner.alpha = 0.24 + pulse * 0.08
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

    app.canvas.addEventListener('pointerdown', handlePointerDown, { passive: true })
    app.renderer.on('resize', layout)
    app.ticker.add(tick)
    layout()

    this.cleanupFn = () => {
      if (disposed) return
      disposed = true

      if (this.app === app) {
        this.app = null
      }

      app.canvas.removeEventListener('pointerdown', handlePointerDown)
      app.renderer.off('resize', layout)
      app.ticker.remove(tick)

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
