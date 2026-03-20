import * as PIXI from 'pixi.js'
import { createSynthAudio } from '../audio/createSynthAudio'
import { CATALOG_ENTRIES } from '../data/catalogEntries'
import { RiftServitorSwarm } from '../enemies/RiftServitorSwarm'
import { createImpactEffectSystem } from '../effects/createImpactEffectSystem'
import { createBattleFlowRuntime } from '../runtime/createBattleFlowRuntime'
import {
  createGameSettingsDefaults,
  EXHAUST_DEFAULT_ITEM_ID,
  GAME_OVER_FADE_TIME,
  getExhaustIndexByItemId,
  getShipThemeByItemId,
  HOMING_BURST_ITEM_ID,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  PLAYER_MAX_HEALTH,
  SHIP_DEFAULT_ITEM_ID,
  WORLD_INSET,
  WORLD_RADIUS,
} from '../runtime/gameConfig'
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

const NORMAL_ENEMY_SPAWN_X = LOGICAL_WIDTH * 0.5
const NORMAL_ENEMY_SPAWN_Y = -92

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

const createDefaultEnemyFormation = ({ parent, onEnemyDeath }) =>
  new RiftServitorSwarm({
    parent,
    columns: 4,
    rows: 3,
    spawnX: NORMAL_ENEMY_SPAWN_X,
    spawnY: NORMAL_ENEMY_SPAWN_Y,
    spawnInterval: 1.08,
    worldHeight: LOGICAL_HEIGHT,
    onEnemyDeath,
  })

export class GameController {
  constructor(container, options = {}) {
    this.container = container
    this.pluginIndex = options.pluginIndex ?? 0
    this.spawnEnemies = options.spawnEnemies !== false
    this.settingsDefaults = {
      ...createGameSettingsDefaults(),
      ...(options.settingsDefaults ?? {}),
    }
    this.enemyFormationFactory = options.enemyFormationFactory ?? createDefaultEnemyFormation
    this.gameOverTitle = options.gameOverTitle
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
      exhaustDefaultItemId: EXHAUST_DEFAULT_ITEM_ID,
      tacticalDefaultItemId: null,
      clampExhaustIndex,
    })
    const settingsSession = createGameSettingsSession({
      defaults: {
        ...this.settingsDefaults,
        exhaustIndex: clampExhaustIndex(this.pluginIndex),
      },
      normalize: normalizeGameSettings,
      getExhaustIndexByItemId: (itemId) => getExhaustIndexByItemId(itemId, clampExhaustIndex),
    })
    const persistedSettings = settingsSession.getState()
    const audio = createSynthAudio()
    audio.setMusicEnabled(persistedSettings.musicEnabled)
    audio.resetRunState()
    const playerShipTheme = getShipThemeByItemId(persistedSettings.equippedShipItemId)
    const initialEquippedExhaustIndex = getExhaustIndexByItemId(
      persistedSettings.equippedExhaustItemId,
      clampExhaustIndex,
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
    const playerCoins = {
      current: persistedSettings.coinCount ?? 0,
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
    const coinWorldLayer = new PIXI.Container()
    worldLayer.addChild(spaceBackdrop)
    worldLayer.addChild(coinWorldLayer)
    let playerCombat = null
    const enemyFormation = this.spawnEnemies
      ? this.enemyFormationFactory({
          PIXI,
          parent: worldLayer,
          renderer: app.renderer,
          width: LOGICAL_WIDTH,
          height: LOGICAL_HEIGHT,
          onEnemyDeath: ({ x, y }) => {
            playerCombat?.spawnCoinDrop?.(x, y)
          },
        })
      : createEmptyEnemyFormation()
    const impactEffectSystem = createImpactEffectSystem(worldLayer)
    const gameOverOverlay = new GameOverOverlayController({
      parent: gameOverLayer,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      title: this.gameOverTitle,
    })
    let overlayController = null
    let isImpactEffectsEnabled = persistedSettings.impactEffectsEnabled
    const spawnImpact = (x, y, options = {}) => {
      if (!isImpactEffectsEnabled && options.force !== true) return
      impactEffectSystem.spawn(x, y, options)
    }
    playerCombat = createPlayerCombatRuntime({
      PIXI,
      parent: worldLayer,
      coinParent: coinWorldLayer,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      renderer: app.renderer,
      audio,
      shipTheme: playerShipTheme,
      initialExhaustIndex: initialEquippedExhaustIndex,
      initialStats: playerStats,
      initialHealth: playerHealth,
      initialCoinCount: playerCoins.current,
      spawnImpact,
      getEnemyFormation: () => enemyFormation,
      onHealthChange: (currentHealth, maxHealth) => {
        playerHealth.current = currentHealth
        overlayController?.updateHealth(currentHealth, maxHealth)
      },
      onCoinCountChange: (currentCoins) => {
        playerCoins.current = currentCoins
        overlayController?.setCoinCount(currentCoins)
        settingsSession.persist({
          coinCount: currentCoins,
        })
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
      initialCoinCount: playerCoins.current,
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
