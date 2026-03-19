import * as PIXI from 'pixi.js'
import { createSynthAudio } from '../audio/createSynthAudio'
import { CATALOG_ENTRIES } from '../data/catalogEntries'
import { RiftServitorSwarm } from '../enemies/RiftServitorSwarm'
import { SHIP_CATALOG } from '../data/shipCatalog'
import { createImpactEffectSystem } from '../effects/createImpactEffectSystem'
import { createBattleFlowRuntime } from '../runtime/createBattleFlowRuntime'
import { createSpaceBackdrop } from '../renderers/createSpaceBackdrop'
import { createGameSceneRuntime } from '../runtime/createGameSceneRuntime'
import { createGameSessionCoordinator } from '../runtime/createGameSessionCoordinator'
import {
  createGameSettingsNormalizer,
  createGameSettingsSession,
} from '../runtime/createGameSettingsSession'
import { clampExhaustIndex, createPlayerCombatRuntime } from '../runtime/createPlayerCombatRuntime'
import { BattleOverlayController } from '../ui/BattleOverlayController'
import { GameOverOverlayController } from '../ui/GameOverOverlayController'
import { createKeyboardController } from '../utils/createKeyboardController'
import { createPointerController } from '../utils/createPointerController'
import { PLAYER_STATS } from '../utils/playerStats'

const LOGICAL_WIDTH = 1280
const LOGICAL_HEIGHT = 720
const WORLD_INSET = 0
const WORLD_RADIUS = 0
const NORMAL_ENEMY_SPAWN_X = LOGICAL_WIDTH * 0.5
const NORMAL_ENEMY_SPAWN_Y = -92
const PLAYER_MAX_HEALTH = 10
const GAME_OVER_FADE_TIME = 1.2
const SHIP_DEFAULT_ITEM_ID = 'ship-frame-0'
const EXHAUST_0_ITEM_ID = 'exhaust-0'
const HOMING_BURST_ITEM_ID = 'tactical-quick-wit'
const GAME_SETTINGS_DEFAULTS = {
  gameStarted: true,
  pressureTestEnabled: false,
  equippedShipItemId: SHIP_DEFAULT_ITEM_ID,
  equippedExhaustItemId: EXHAUST_0_ITEM_ID,
  equippedTacticalItemId: null,
  musicEnabled: true,
  fpsEnabled: true,
  impactEffectsEnabled: true,
  catalogVisible: false,
  attackPower: PLAYER_STATS.attackPower,
  attackSpeed: PLAYER_STATS.attackSpeed,
  critChance: PLAYER_STATS.critChance,
  exhaustIndex: 0,
}
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

    const normalizeGameSettings = createGameSettingsNormalizer({
      shipDefaultItemId: SHIP_DEFAULT_ITEM_ID,
      exhaustDefaultItemId: EXHAUST_0_ITEM_ID,
      tacticalDefaultItemId: null,
      clampExhaustIndex,
    })
    const settingsSession = createGameSettingsSession({
      defaults: {
        ...GAME_SETTINGS_DEFAULTS,
        exhaustIndex: clampExhaustIndex(this.pluginIndex),
      },
      normalize: normalizeGameSettings,
      getExhaustIndexByItemId,
    })
    const persistedSettings = settingsSession.getState()
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
    const playerStats = {
      attackPower: persistedSettings.attackPower,
      attackSpeed: persistedSettings.attackSpeed,
      critChance: persistedSettings.critChance,
      hasHomingBurst: persistedSettings.equippedTacticalItemId === HOMING_BURST_ITEM_ID,
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
        battleFlow?.triggerGameOver()
      },
    })
    let battleFlow = null
    const keyboard = createKeyboardController()
    const sessionCoordinator = createGameSessionCoordinator({
      normalizeGameSettings,
      settingsSession,
      audio,
      playerStats,
      playerCombat,
      initialExhaustIndex: initialEquippedExhaustIndex,
      onImpactEffectsChange: (enabled) => {
        isImpactEffectsEnabled = enabled
      },
      onOverlayStatsChange: (stats) => {
        overlayController?.updateStats(stats)
      },
    })
    const unlockAudio = () => {
      audio.unlock()
    }
    app.canvas.addEventListener('pointerdown', unlockAudio, { passive: true })
    const pointer = createPointerController(app.canvas, {
      shouldStart: (event) => {
        const rect = app.canvas.getBoundingClientRect()
        const point = sceneRuntime.toLogicalPoint(event.clientX, event.clientY, rect)
        return !overlayController?.containsInteractive(point.x, point.y)
      },
    })

    overlayController = new BattleOverlayController({
      gameLayer,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      entries: CATALOG_ENTRIES,
      playerStats,
      playerHealth,
      initialCatalogVisible: persistedSettings.catalogVisible === true,
      initialCatalogPreviewCode: persistedSettings.catalogPreviewCode,
      initialFpsVisible: persistedSettings.fpsEnabled,
      getSettingsState: () => sessionCoordinator.getSettingsOverlayState(),
      getDomRect: ({ x, y, width, height }) => {
        const rect = app.canvas.getBoundingClientRect()
        return sceneRuntime.toViewportRect(x, y, width, height, rect)
      },
      ...sessionCoordinator.createOverlayHandlers(),
    })
    sessionCoordinator.setOverlayController(overlayController)
    battleFlow = createBattleFlowRuntime({
      spaceBackdrop,
      playerCombat,
      enemyFormation,
      impactEffectSystem,
      gameOverOverlay,
      keyboard,
      pointer,
      audio,
      spawnImpact,
      gameOverFadeTime: GAME_OVER_FADE_TIME,
    })
    const handleSettingsChanged = () => {
      sessionCoordinator.syncFromStorage()
    }
    window.addEventListener('game-settings-changed', handleSettingsChanged)

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
      battleFlow.update(rawDeltaSeconds)
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
      window.removeEventListener('game-settings-changed', handleSettingsChanged)

      keyboard.destroy()
      pointer.destroy()
      overlayController?.destroy()
      battleFlow?.destroy()
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
