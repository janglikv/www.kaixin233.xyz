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
const DAMAGE_FLASH_DURATION = 0.26
const DAMAGE_FLASH_BANDS = [
  { width: 44, color: 0x5e0f12, alpha: 0.08 },
  { width: 26, color: 0x8c171c, alpha: 0.14 },
  { width: 12, color: 0xd13a3f, alpha: 0.2 },
]
const DAMAGE_FLASH_OUTLINE_WIDTH = 1
const DAMAGE_FLASH_OUTLINE_COLOR = 0xff0000
const DAMAGE_FLASH_OUTLINE_ALPHA = 0.5

export class BattleOverlayController {
  constructor({
    gameLayer,
    width,
    height,
    entries,
    playerStats,
    playerHealth,
    initialCoinCount = 0,
    initialCatalogVisible = false,
    initialCatalogPreviewCode = null,
    initialFpsVisible = true,
    getSettingsState,
    getDomRect,
    onUiClick,
    onPreviewOpen,
    onPreviewClose,
    onCatalogClose,
    onMusicToggle,
    onFpsToggle,
    onImpactEffectsToggle,
    onAdjustStat,
    onAdjustDebugStageStartAt,
    onSaveDebugStageStartAt,
    onSavePlayerMaxHealth,
    onSaveAttackPower,
    onSaveAttackSpeed,
    onSaveCritChance,
    onCatalogOpen,
    onClearData,
    onEnterPressureTestScene,
    onEnterFixedTargetScene,
    onLeave,
  }) {
    this.getSettingsState = getSettingsState
    this.onUiClick = onUiClick
    this.isCatalogOpen = initialCatalogVisible
    this.isSettingsOpen = false
    this.activePreviewCode = initialCatalogPreviewCode
    this.width = width
    this.height = height
    this.damageFlashElapsed = DAMAGE_FLASH_DURATION
    this.damageFlashOverlay = new PIXI.Graphics()
    this.damageFlashOverlay.visible = false
    this.damageFlashOverlay.eventMode = 'none'
    this.damageFlashOverlay.blendMode = 'normal'

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
    this.coinText = new PIXI.Text({
      text: '',
      style: {
        fill: 0xf5c94a,
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 16,
        fontWeight: '700',
        stroke: { color: 0x08101f, width: 3, join: 'round' },
      },
    })
    this.coinText.anchor.set(0, 1)
    this.coinText.position.set(18, height - 16)
    this.setCoinCount(initialCoinCount)

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
      getDomRect,
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
      onAdjustDebugStageStartAt: (direction) => {
        onAdjustDebugStageStartAt?.(direction)
        this.refreshSettings()
      },
      onSavePlayerMaxHealth: (value) => {
        const result = onSavePlayerMaxHealth?.(value) ?? { ok: true }
        if (result.ok !== false) {
          this.refreshSettings()
        }
        return result
      },
      onSaveDebugStageStartAt: (value) => {
        const result = onSaveDebugStageStartAt?.(value) ?? { ok: true }
        if (result.ok !== false) {
          this.refreshSettings()
        }
        return result
      },
      onSaveAttackPower: (value) => {
        const result = onSaveAttackPower?.(value) ?? { ok: true }
        if (result.ok !== false) {
          this.refreshSettings()
        }
        return result
      },
      onSaveAttackSpeed: (value) => {
        const result = onSaveAttackSpeed?.(value) ?? { ok: true }
        if (result.ok !== false) {
          this.refreshSettings()
        }
        return result
      },
      onSaveCritChance: (value) => {
        const result = onSaveCritChance?.(value) ?? { ok: true }
        if (result.ok !== false) {
          this.refreshSettings()
        }
        return result
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
      onEnterPressureTestScene: () => {
        this.onUiClick?.()
        onEnterPressureTestScene?.()
      },
      onEnterFixedTargetScene: () => {
        this.onUiClick?.()
        onEnterFixedTargetScene?.()
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
    gameLayer.addChild(this.coinText)
    gameLayer.addChild(this.playerHealthBar.container)
    gameLayer.addChild(this.statsPanel.container)
    gameLayer.addChild(this.catalogOverlay.container)
    gameLayer.addChild(this.settingsOverlay.container)
    gameLayer.addChild(this.damageFlashOverlay)
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

  triggerDamageFlash() {
    this.damageFlashElapsed = 0
    this.damageFlashOverlay.visible = true
  }

  setCoinCount(count) {
    const nextCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
    this.coinText.text = `金币 ${nextCount}`
  }

  updatePreview(deltaSeconds) {
    this.catalogOverlay.update(deltaSeconds)
    this.updateDamageFlash(deltaSeconds)
  }

  updateDamageFlash(deltaSeconds) {
    if (this.damageFlashElapsed >= DAMAGE_FLASH_DURATION) {
      if (this.damageFlashOverlay.visible) {
        this.damageFlashOverlay.visible = false
        this.damageFlashOverlay.clear()
      }
      return
    }

    this.damageFlashElapsed = Math.min(DAMAGE_FLASH_DURATION, this.damageFlashElapsed + deltaSeconds)
    const progress = this.damageFlashElapsed / DAMAGE_FLASH_DURATION
    const fade = 1 - progress
    const easedFade = fade * fade
    const width = this.width
    const height = this.height

    if (width <= 0 || height <= 0) return

    this.damageFlashOverlay.visible = true
    this.damageFlashOverlay.clear()

    DAMAGE_FLASH_BANDS.forEach(({ width: bandWidth, color, alpha }) => {
      const bandAlpha = alpha * easedFade
      this.damageFlashOverlay
        .rect(0, 0, width, bandWidth)
        .fill({ color, alpha: bandAlpha })
        .rect(0, height - bandWidth, width, bandWidth)
        .fill({ color, alpha: bandAlpha })
        .rect(0, 0, bandWidth, height)
        .fill({ color, alpha: bandAlpha })
        .rect(width - bandWidth, 0, bandWidth, height)
        .fill({ color, alpha: bandAlpha })
    })

    const outlineAlpha = DAMAGE_FLASH_OUTLINE_ALPHA * easedFade
    this.damageFlashOverlay
      .rect(0, 0, width, DAMAGE_FLASH_OUTLINE_WIDTH)
      .fill({ color: DAMAGE_FLASH_OUTLINE_COLOR, alpha: outlineAlpha })
      .rect(0, height - DAMAGE_FLASH_OUTLINE_WIDTH, width, DAMAGE_FLASH_OUTLINE_WIDTH)
      .fill({ color: DAMAGE_FLASH_OUTLINE_COLOR, alpha: outlineAlpha })
      .rect(0, 0, DAMAGE_FLASH_OUTLINE_WIDTH, height)
      .fill({ color: DAMAGE_FLASH_OUTLINE_COLOR, alpha: outlineAlpha })
      .rect(width - DAMAGE_FLASH_OUTLINE_WIDTH, 0, DAMAGE_FLASH_OUTLINE_WIDTH, height)
      .fill({ color: DAMAGE_FLASH_OUTLINE_COLOR, alpha: outlineAlpha })
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
    this.statsPanel.update(settingsState)
    if (typeof settingsState.coinCount === 'number') {
      this.setCoinCount(settingsState.coinCount)
    }
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
    this.settingsOverlay.destroy?.()
    this.damageFlashOverlay.destroy()
    this.settingsButton.container.destroy({ children: true })
    this.playerHealthBar.container.destroy({ children: true })
    this.statsPanel.container.destroy({ children: true })
    this.catalogOverlay.container.destroy({ children: true })
    this.settingsOverlay.container.destroy({ children: true })
    this.fpsText.destroy()
  }
}
