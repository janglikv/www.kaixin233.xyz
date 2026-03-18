import * as PIXI from 'pixi.js'
import { createCatalogOverlay } from '../renderers/createCatalogOverlay'
import { createPlayerHealthBar } from '../renderers/createPlayerHealthBar'
import { createSettingsButton } from '../renderers/createSettingsButton'
import { createSettingsOverlay } from '../renderers/createSettingsOverlay'
import { createStatsPanel } from '../renderers/createStatsPanel'

const FPS_TEXT_STYLE = {
  fill: 0x7cff72,
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 14,
  fontWeight: '700',
}

export class BattleOverlayController {
  constructor({
    gameLayer,
    width,
    height,
    entries,
    playerStats,
    playerHealth,
    initialCatalogVisible = false,
    initialCatalogPreviewCode = null,
    initialFpsVisible = true,
    getSettingsState,
    onUiClick,
    onPreviewOpen,
    onPreviewClose,
    onCatalogClose,
    onMusicToggle,
    onFpsToggle,
    onImpactEffectsToggle,
    onAdjustStat,
    onCatalogOpen,
    onClearData,
    onEnterDebugScene,
    onLeave,
  }) {
    this.getSettingsState = getSettingsState
    this.onUiClick = onUiClick
    this.isCatalogOpen = initialCatalogVisible
    this.isSettingsOpen = false
    this.activePreviewCode = initialCatalogPreviewCode

    this.statsPanel = createStatsPanel({
      x: width - 18,
      y: height - 114,
      stats: playerStats,
    })
    this.playerHealthBar = createPlayerHealthBar({
      x: width - 18,
      y: height - 16,
      health: playerHealth.current,
      maxHealth: playerHealth.max,
      width: 144,
      align: 'right',
    })

    this.catalogOverlay = createCatalogOverlay({
      x: 0,
      y: 0,
      width,
      height,
      entries,
      onPreviewOpen: (code) => {
        this.activePreviewCode = code
        onPreviewOpen?.(code)
      },
      onPreviewClose: () => {
        this.activePreviewCode = null
        onPreviewClose?.()
      },
      onClose: () => {
        this.onUiClick?.()
        this.catalogOverlay.hide()
        this.isCatalogOpen = false
        this.activePreviewCode = null
        onCatalogClose?.()
      },
    })

    this.settingsOverlay = createSettingsOverlay({
      x: 0,
      y: 0,
      width,
      height,
      state: getSettingsState(),
      onMusicToggle: onMusicToggle,
      onFpsToggle: (enabled) => {
        onFpsToggle?.(enabled)
        this.fpsText.visible = enabled
      },
      onImpactEffectsToggle,
      onAdjustStat: (key, direction) => {
        onAdjustStat?.(key, direction)
        this.refreshSettings()
      },
      onCatalogOpen: () => {
        this.onUiClick?.()
        this.settingsOverlay.hide()
        this.isSettingsOpen = false
        this.catalogOverlay.toggle()
        this.isCatalogOpen = this.catalogOverlay.isVisible()
        if (!this.isCatalogOpen) {
          this.activePreviewCode = null
        }
        onCatalogOpen?.(this.isCatalogOpen)
      },
      onClearData: () => {
        this.onUiClick?.()
        onClearData?.()
      },
      onEnterDebugScene: () => {
        this.onUiClick?.()
        onEnterDebugScene?.()
      },
      onLeave: () => {
        this.onUiClick?.()
        onLeave?.()
      },
      onClose: () => {
        this.onUiClick?.()
        this.settingsOverlay.hide()
        this.isSettingsOpen = false
      },
    })

    this.fpsText = new PIXI.Text({
      text: '帧率 0',
      style: FPS_TEXT_STYLE,
    })
    this.fpsText.position.set(14, 18)
    this.fpsText.visible = initialFpsVisible

    this.settingsButton = createSettingsButton({
      x: width - 48,
      y: 14,
      onTap: () => {
        this.onUiClick?.()
        this.settingsOverlay.toggle()
        this.isSettingsOpen = this.settingsOverlay.isVisible()
        this.settingsOverlay.update(getSettingsState())
      },
    })

    if (this.isCatalogOpen) {
      this.catalogOverlay.show()
      if (this.activePreviewCode) {
        this.catalogOverlay.openPreviewByCode(this.activePreviewCode)
      }
    }

    gameLayer.addChild(this.fpsText)
    gameLayer.addChild(this.settingsButton.container)
    gameLayer.addChild(this.playerHealthBar.container)
    gameLayer.addChild(this.statsPanel.container)
    gameLayer.addChild(this.catalogOverlay.container)
    gameLayer.addChild(this.settingsOverlay.container)
  }

  getBounds() {
    return {
      catalogBounds: this.catalogOverlay.bounds,
      settingsBounds: this.settingsOverlay.bounds,
      settingsButtonBounds: this.settingsButton.bounds,
    }
  }

  isPaused() {
    return this.isCatalogOpen || this.isSettingsOpen
  }

  isCatalogVisible() {
    return this.isCatalogOpen
  }

  getActivePreviewCode() {
    return this.activePreviewCode
  }

  setFpsText(text) {
    this.fpsText.text = text
  }

  setFpsVisible(visible) {
    this.fpsText.visible = visible
  }

  updateStats(stats) {
    this.statsPanel.update(stats)
  }

  updateHealth(current, max) {
    this.playerHealthBar.update(current, max)
  }

  updatePreview(deltaSeconds) {
    this.catalogOverlay.update(deltaSeconds)
  }

  refreshSettings() {
    const settingsState = this.getSettingsState()
    this.statsPanel.update(settingsState)
    this.settingsOverlay.update(settingsState)
  }

  syncFromState({ isCatalogVisible, activeCatalogPreviewCode, isFpsVisible, settingsState }) {
    this.isCatalogOpen = isCatalogVisible === true
    this.activePreviewCode = activeCatalogPreviewCode
    this.fpsText.visible = isFpsVisible
    if (this.isCatalogOpen) {
      this.catalogOverlay.show()
      if (activeCatalogPreviewCode) {
        this.catalogOverlay.openPreviewByCode(activeCatalogPreviewCode)
      }
    } else {
      this.catalogOverlay.hide()
    }
    this.settingsOverlay.update(settingsState)
  }

  containsInteractive(logicalX, logicalY) {
    const { catalogBounds, settingsBounds, settingsButtonBounds } = this.getBounds()
    const insideCatalog =
      this.isCatalogOpen &&
      catalogBounds &&
      logicalX >= catalogBounds.left &&
      logicalX <= catalogBounds.right &&
      logicalY >= catalogBounds.top &&
      logicalY <= catalogBounds.bottom
    const insideSettingsButton =
      settingsButtonBounds &&
      logicalX >= settingsButtonBounds.left &&
      logicalX <= settingsButtonBounds.right &&
      logicalY >= settingsButtonBounds.top &&
      logicalY <= settingsButtonBounds.bottom
    const insideSettings =
      this.isSettingsOpen &&
      settingsBounds &&
      logicalX >= settingsBounds.left &&
      logicalX <= settingsBounds.right &&
      logicalY >= settingsBounds.top &&
      logicalY <= settingsBounds.bottom

    return insideCatalog || insideSettingsButton || insideSettings
  }

  destroy() {
    this.settingsButton.container.destroy({ children: true })
    this.playerHealthBar.container.destroy({ children: true })
    this.statsPanel.container.destroy({ children: true })
    this.catalogOverlay.container.destroy({ children: true })
    this.settingsOverlay.container.destroy({ children: true })
    this.fpsText.destroy()
  }
}
