import * as PIXI from 'pixi.js'
import { createSynthAudio } from '../audio/createSynthAudio'
import { CATALOG_ENTRIES } from '../data/catalogEntries'
import { RiftServitorSwarm } from '../enemies/RiftServitorSwarm'
import { SHIP_CATALOG } from '../data/shipCatalog'
import { createImpactEffectSystem } from '../effects/createImpactEffectSystem'
import { createSpaceBackdrop } from '../renderers/createSpaceBackdrop'
import { createGameSceneRuntime } from '../runtime/createGameSceneRuntime'
import { clampExhaustIndex, createPlayerCombatRuntime } from '../runtime/createPlayerCombatRuntime'
import { BattleOverlayController } from '../ui/BattleOverlayController'
import { GameOverOverlayController } from '../ui/GameOverOverlayController'
import { clearGameSettings, loadGameSettings, saveGameSettings } from '../utils/gameSettingsStorage'
import { createKeyboardController } from '../utils/createKeyboardController'
import { createPointerController } from '../utils/createPointerController'

const LOGICAL_WIDTH = 1280
const LOGICAL_HEIGHT = 720
const WORLD_INSET = 0
const WORLD_RADIUS = 0
const NORMAL_ENEMY_SPAWN_X = LOGICAL_WIDTH * 0.5
const NORMAL_ENEMY_SPAWN_Y = -92
const PLAYER_MAX_HEALTH = 10
const GAME_OVER_FADE_TIME = 1.2
const PLAYER_STATS = {
  attackPower: 1,
  attackSpeed: 2,
  critChance: 1,
}
const SHIP_DEFAULT_ITEM_ID = 'ship-frame-0'
const EXHAUST_0_ITEM_ID = 'exhaust-0'
const GAME_SETTINGS_DEFAULTS = {
  gameStarted: true,
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
  exhaustIndex: 0,
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const clampAttackPower = (value) => clamp(Math.round(value), 1, 999)
const clampAttackSpeed = (value) => clamp(Math.round(value * 10) / 10, 1, 30)
const clampCritChance = (value) => clamp(Math.round(value * 100) / 100, 0, 1)
const getShipThemeByItemId = (itemId) => {
  if (typeof itemId !== 'string') return SHIP_CATALOG[0]?.theme
  const serial = Number(itemId.replace('ship-frame-', ''))
  const shipEntry = SHIP_CATALOG.find((entry) => entry.serial === serial)
  return shipEntry?.theme ?? SHIP_CATALOG[0]?.theme
}

const getExhaustIndexByItemId = (itemId) => {
  if (typeof itemId !== 'string') return 0
  const index = Number(itemId.replace('exhaust-', ''))
  return clampExhaustIndex(index)
}

const normalizeGameSettings = (settings) => ({
  gameStarted: settings.gameStarted !== false,
  pressureTestEnabled: settings.pressureTestEnabled === true,
  equippedShipItemId:
    typeof settings.equippedShipItemId === 'string' ? settings.equippedShipItemId : SHIP_DEFAULT_ITEM_ID,
  equippedExhaustItemId:
    typeof settings.equippedExhaustItemId === 'string'
      ? settings.equippedExhaustItemId
      : EXHAUST_0_ITEM_ID,
  musicEnabled: Boolean(settings.musicEnabled),
  fpsEnabled: settings.fpsEnabled !== false,
  impactEffectsEnabled: settings.impactEffectsEnabled !== false,
  catalogVisible: settings.catalogVisible === true,
  catalogPreviewCode: typeof settings.catalogPreviewCode === 'string' ? settings.catalogPreviewCode : null,
  attackPower: clampAttackPower(settings.attackPower),
  attackSpeed: clampAttackSpeed(settings.attackSpeed),
  critChance: clampCritChance(settings.critChance),
  exhaustIndex: clampExhaustIndex(settings.exhaustIndex),
})

const createEmptyEnemyFormation = () => ({
  getHitboxes() {
    return []
  },
  getShooters() {
    return []
  },
  applyDamage() {
    return null
  },
  update() {},
  destroy() {},
})

export class GameController {
  constructor(container) {
    this.container = container
    this.pluginIndex = 0
    this.spawnEnemies = true
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

    const persistedSettings = normalizeGameSettings(
      loadGameSettings({
        ...GAME_SETTINGS_DEFAULTS,
        exhaustIndex: clampExhaustIndex(this.pluginIndex),
      }),
    )
    const audio = createSynthAudio()
    audio.setMusicEnabled(persistedSettings.musicEnabled)
    audio.resetRunState()
    const playerShipTheme = getShipThemeByItemId(persistedSettings.equippedShipItemId)
    const initialEquippedExhaustIndex = getExhaustIndexByItemId(
      persistedSettings.equippedExhaustItemId,
    )
    const sceneRuntime = createGameSceneRuntime({
      app,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      worldInset: WORLD_INSET,
      worldRadius: WORLD_RADIUS,
    })
    const { gameLayer, worldLayer, gameOverLayer } = sceneRuntime
    const playerHealth = {
      current: PLAYER_MAX_HEALTH,
      max: PLAYER_MAX_HEALTH,
    }
    let gameOver = false
    let gameOverFadeProgress = 0
    const playerStats = {
      attackPower: persistedSettings.attackPower,
      attackSpeed: persistedSettings.attackSpeed,
      critChance: persistedSettings.critChance,
    }

    const spaceBackdrop = createSpaceBackdrop({
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    })
    worldLayer.addChild(spaceBackdrop)
    const enemyFormation = this.spawnEnemies
      ? new RiftServitorSwarm({
          parent: worldLayer,
          columns: 4,
          rows: 3,
          spawnX: NORMAL_ENEMY_SPAWN_X,
          spawnY: NORMAL_ENEMY_SPAWN_Y,
          spawnInterval: 1.08,
          worldHeight: LOGICAL_HEIGHT,
        })
      : createEmptyEnemyFormation()
    const impactEffectSystem = createImpactEffectSystem(worldLayer)
    const gameOverOverlay = new GameOverOverlayController({
      parent: gameOverLayer,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    })

    const triggerGameOver = () => {
      if (gameOver) return
      gameOver = true
      playerCombat.setShipVisible(false)
      audio.playExplosion({ large: true })
      audio.playGameOver()
      const playerPosition = playerCombat.getPosition()
      spawnImpact(playerPosition.x, playerPosition.y, {
        scale: 3.2,
        flashOuterColor: 0xff4c39,
        flashInnerColor: 0xffd2a6,
        sparkColors: [0xff3b30, 0xff7a45, 0xffc15a],
      })
    }
    let overlayController = null
    let isImpactEffectsEnabled = persistedSettings.impactEffectsEnabled
    const spawnImpact = (x, y, options = {}) => {
      if (!isImpactEffectsEnabled && options.force !== true) return
      impactEffectSystem.spawn(x, y, options)
    }
    const playerCombat = createPlayerCombatRuntime({
      PIXI,
      parent: worldLayer,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      renderer: app.renderer,
      audio,
      shipTheme: playerShipTheme,
      initialExhaustIndex: initialEquippedExhaustIndex,
      initialStats: playerStats,
      initialHealth: playerHealth,
      spawnImpact,
      getEnemyFormation: () => enemyFormation,
      onHealthChange: (currentHealth, maxHealth) => {
        playerHealth.current = currentHealth
        overlayController?.updateHealth(currentHealth, maxHealth)
      },
      onPlayerDepleted: () => {
        if (!gameOver) {
          triggerGameOver()
        }
      },
    })
    const keyboard = createKeyboardController()
    let isCatalogVisible = persistedSettings.catalogVisible === true
    let activeCatalogPreviewCode = persistedSettings.catalogPreviewCode
    let isPressureTestEnabled = persistedSettings.pressureTestEnabled
    let isFpsVisible = persistedSettings.fpsEnabled
    let currentExhaustIndex = initialEquippedExhaustIndex
    const buildSettingsSnapshot = (overrides = {}) =>
      normalizeGameSettings({
        gameStarted: true,
        pressureTestEnabled: isPressureTestEnabled,
        equippedShipItemId: persistedSettings.equippedShipItemId,
        equippedExhaustItemId: `exhaust-${currentExhaustIndex}`,
        musicEnabled: audio.isMusicEnabled(),
        fpsEnabled: isFpsVisible,
        impactEffectsEnabled: isImpactEffectsEnabled,
        attackPower: playerStats.attackPower,
        attackSpeed: playerStats.attackSpeed,
        critChance: playerStats.critChance,
        exhaustIndex: currentExhaustIndex,
        catalogVisible: isCatalogVisible,
        catalogPreviewCode: activeCatalogPreviewCode,
        ...overrides,
      })
    const syncFromStorage = () => {
      const nextSettings = normalizeGameSettings(
        loadGameSettings({
          ...GAME_SETTINGS_DEFAULTS,
          exhaustIndex: currentExhaustIndex,
        }),
      )
      isPressureTestEnabled = nextSettings.pressureTestEnabled
      isFpsVisible = nextSettings.fpsEnabled
      isImpactEffectsEnabled = nextSettings.impactEffectsEnabled
      currentExhaustIndex = getExhaustIndexByItemId(nextSettings.equippedExhaustItemId)
      isCatalogVisible = nextSettings.catalogVisible === true
      activeCatalogPreviewCode = nextSettings.catalogPreviewCode
      playerStats.attackPower = nextSettings.attackPower
      playerStats.attackSpeed = nextSettings.attackSpeed
      playerStats.critChance = nextSettings.critChance
      audio.setMusicEnabled(nextSettings.musicEnabled)
      playerCombat.syncSettings({
        attackPower: playerStats.attackPower,
        attackSpeed: playerStats.attackSpeed,
        critChance: playerStats.critChance,
        exhaustIndex: currentExhaustIndex,
      })
      overlayController?.updateStats(playerStats)
      overlayController?.syncFromState({
        isCatalogVisible,
        activeCatalogPreviewCode,
        isFpsVisible,
        settingsState: getSettingsOverlayState(),
      })
    }
    const persistSettings = () => {
      saveGameSettings(buildSettingsSnapshot())
    }
    const getSettingsOverlayState = () => ({
      pressureTestEnabled: isPressureTestEnabled,
      musicEnabled: audio.isMusicEnabled(),
      fpsEnabled: isFpsVisible,
      impactEffectsEnabled: isImpactEffectsEnabled,
      attackPower: playerStats.attackPower,
      attackSpeed: playerStats.attackSpeed,
      critChance: playerStats.critChance,
    })
    const unlockAudio = () => {
      audio.unlock()
    }
    app.canvas.addEventListener('pointerdown', unlockAudio, { passive: true })
    const pointer = createPointerController(app.canvas, {
      shouldStart: (event) => {
        const rect = app.canvas.getBoundingClientRect()
        const point = sceneRuntime.toLogicalPoint(event.clientX, event.clientY, rect)
        return !overlayController.containsInteractive(point.x, point.y)
      },
    })

    overlayController = new BattleOverlayController({
      gameLayer,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      entries: CATALOG_ENTRIES,
      playerStats,
      playerHealth,
      initialCatalogVisible: isCatalogVisible,
      initialCatalogPreviewCode: activeCatalogPreviewCode,
      initialFpsVisible: isFpsVisible,
      getSettingsState: getSettingsOverlayState,
      onUiClick: (options) => audio.playUiClick(options),
      onPreviewOpen: (code) => {
        activeCatalogPreviewCode = code
        persistSettings()
      },
      onPreviewClose: () => {
        activeCatalogPreviewCode = null
        persistSettings()
      },
      onCatalogClose: () => {
        isCatalogVisible = false
        activeCatalogPreviewCode = null
        persistSettings()
      },
      onMusicToggle: (enabled) => {
        audio.setMusicEnabled(enabled)
        if (enabled) {
          audio.playUiClick({ high: true })
        }
        persistSettings()
      },
      onFpsToggle: (enabled) => {
        audio.playUiClick({ high: enabled })
        isFpsVisible = enabled
        persistSettings()
      },
      onImpactEffectsToggle: (enabled) => {
        audio.playUiClick({ high: enabled })
        isImpactEffectsEnabled = enabled
        persistSettings()
      },
      onAdjustStat: (key, direction) => {
        audio.playUiClick({ high: direction > 0 })
        if (key === 'attackPower') {
          playerStats.attackPower = clampAttackPower(playerStats.attackPower + direction)
        }
        if (key === 'attackSpeed') {
          playerStats.attackSpeed = clampAttackSpeed(playerStats.attackSpeed + direction * 0.5)
        }
        if (key === 'critChance') {
          playerStats.critChance = clampCritChance(playerStats.critChance + direction * 0.05)
        }
        playerCombat.syncSettings({
          attackPower: playerStats.attackPower,
          attackSpeed: playerStats.attackSpeed,
          critChance: playerStats.critChance,
          exhaustIndex: currentExhaustIndex,
        })
        overlayController.updateStats(playerStats)
        persistSettings()
      },
      onCatalogOpen: (visible) => {
        isCatalogVisible = visible
        if (!visible) {
          activeCatalogPreviewCode = null
        }
        persistSettings()
      },
      onClearData: () => {
        clearGameSettings()
      },
      onEnterDebugScene: () => {
        saveGameSettings(buildSettingsSnapshot({
          gameStarted: true,
          pressureTestEnabled: true,
        }))
      },
      onLeave: () => {
        saveGameSettings(buildSettingsSnapshot({
          gameStarted: false,
        }))
      },
    })
    window.addEventListener('game-settings-changed', syncFromStorage)

    let elapsedSeconds = 0
    let fpsSampleElapsed = 0
    let fpsFrameCount = 0

    const tick = (ticker) => {
      const rawDeltaSeconds = ticker.deltaMS / 1000
      fpsSampleElapsed += rawDeltaSeconds
      fpsFrameCount += 1
      if (fpsSampleElapsed >= 0.2) {
        overlayController.setFpsText(`帧率 ${Math.round(fpsFrameCount / fpsSampleElapsed)}`)
        fpsSampleElapsed = 0
        fpsFrameCount = 0
      }
      overlayController.updatePreview(rawDeltaSeconds)
      if (overlayController.isPaused()) return
      const deltaSeconds = rawDeltaSeconds
      elapsedSeconds += deltaSeconds
      if (gameOver) {
        gameOverFadeProgress = Math.min(
          1,
          gameOverFadeProgress + deltaSeconds / GAME_OVER_FADE_TIME,
        )
      }
      spaceBackdrop.update?.(deltaSeconds)
      const axis = gameOver ? { horizontal: 0, vertical: 0 } : keyboard.getAxis()
      playerCombat.update(deltaSeconds, elapsedSeconds, {
        axis,
        shouldFire: pointer.isFiring(),
        gameOver,
      })
      const { x: playerX, y: playerY } = playerCombat.getPosition()
      enemyFormation.update(deltaSeconds, { x: playerX, y: playerY }, ({ x, y, damage }) => {
        audio.playExplosion({ large: true })
        spawnImpact(x, y, {
          force: true,
          scale: 2.8,
          flashOuterColor: 0xff5a36,
          flashInnerColor: 0xffd8b0,
          sparkColors: [0xff4f32, 0xff8554, 0xffd494],
        })
        if (gameOver) return
        playerCombat.applyIncomingDamage({ damage, x, y })
      })
      impactEffectSystem.update(deltaSeconds)
      gameOverOverlay.setProgress(gameOverFadeProgress)
    }

    app.renderer.on('resize', sceneRuntime.layout)
    app.ticker.add(tick)
    sceneRuntime.layout()

    this.cleanupFn = () => {
      if (disposed) return
      disposed = true

      if (this.app === app) {
        this.app = null
      }

      app.renderer.off('resize', sceneRuntime.layout)
      app.ticker.remove(tick)
      app.canvas.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('game-settings-changed', syncFromStorage)

      impactEffectSystem.destroy()
      enemyFormation.destroy()
      keyboard.destroy()
      pointer.destroy()
      playerCombat.destroy()
      overlayController?.destroy()
      gameOverOverlay.destroy()
      audio.destroy()

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
