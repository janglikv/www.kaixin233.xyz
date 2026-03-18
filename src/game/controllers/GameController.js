import * as PIXI from 'pixi.js'
import { createSynthAudio } from '../audio/createSynthAudio'
import { CATALOG_ENTRIES } from '../data/catalogEntries'
import { RiftServitorSwarm } from '../enemies/RiftServitorSwarm'
import { SHIP_CATALOG } from '../data/shipCatalog'
import { createImpactEffectSystem } from '../effects/createImpactEffectSystem'
import { createBattleFlowRuntime } from '../runtime/createBattleFlowRuntime'
import { createSpaceBackdrop } from '../renderers/createSpaceBackdrop'
import { createGameSceneRuntime } from '../runtime/createGameSceneRuntime'
import {
  createGameSettingsNormalizer,
  createGameSettingsSession,
} from '../runtime/createGameSettingsSession'
import { clampExhaustIndex, createPlayerCombatRuntime } from '../runtime/createPlayerCombatRuntime'
import { BattleOverlayController } from '../ui/BattleOverlayController'
import { GameOverOverlayController } from '../ui/GameOverOverlayController'
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
    let currentExhaustIndex = initialEquippedExhaustIndex
    const syncFromStorage = () => {
      const nextSettings = settingsSession.reload()
      isImpactEffectsEnabled = nextSettings.impactEffectsEnabled
      currentExhaustIndex = getExhaustIndexByItemId(nextSettings.equippedExhaustItemId)
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
        isCatalogVisible: nextSettings.catalogVisible === true,
        activeCatalogPreviewCode: nextSettings.catalogPreviewCode,
        isFpsVisible: nextSettings.fpsEnabled,
        settingsState: settingsSession.getOverlayState(),
      })
    }
    const persistSettings = (patch = {}) =>
      settingsSession.persist({
        gameStarted: true,
        musicEnabled: audio.isMusicEnabled(),
        impactEffectsEnabled: isImpactEffectsEnabled,
        attackPower: playerStats.attackPower,
        attackSpeed: playerStats.attackSpeed,
        critChance: playerStats.critChance,
        equippedExhaustItemId: `exhaust-${currentExhaustIndex}`,
        ...patch,
      })
    const getSettingsOverlayState = () => settingsSession.getOverlayState()
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
      initialCatalogVisible: persistedSettings.catalogVisible === true,
      initialCatalogPreviewCode: persistedSettings.catalogPreviewCode,
      initialFpsVisible: persistedSettings.fpsEnabled,
      getSettingsState: getSettingsOverlayState,
      onUiClick: (options) => audio.playUiClick(options),
      onPreviewOpen: (code) => {
        persistSettings({
          catalogVisible: true,
          catalogPreviewCode: code,
        })
      },
      onPreviewClose: () => {
        persistSettings({
          catalogPreviewCode: null,
        })
      },
      onCatalogClose: () => {
        persistSettings({
          catalogVisible: false,
          catalogPreviewCode: null,
        })
      },
      onMusicToggle: (enabled) => {
        audio.setMusicEnabled(enabled)
        if (enabled) {
          audio.playUiClick({ high: true })
        }
        persistSettings({
          musicEnabled: enabled,
        })
      },
      onFpsToggle: (enabled) => {
        audio.playUiClick({ high: enabled })
        persistSettings({
          fpsEnabled: enabled,
        })
      },
      onImpactEffectsToggle: (enabled) => {
        audio.playUiClick({ high: enabled })
        isImpactEffectsEnabled = enabled
        persistSettings({
          impactEffectsEnabled: enabled,
        })
      },
      onAdjustStat: (key, direction) => {
        audio.playUiClick({ high: direction > 0 })
        if (key === 'attackPower') {
          playerStats.attackPower = normalizeGameSettings({
            attackPower: playerStats.attackPower + direction,
          }).attackPower
        }
        if (key === 'attackSpeed') {
          playerStats.attackSpeed = normalizeGameSettings({
            attackSpeed: playerStats.attackSpeed + direction * 0.5,
          }).attackSpeed
        }
        if (key === 'critChance') {
          playerStats.critChance = normalizeGameSettings({
            critChance: playerStats.critChance + direction * 0.05,
          }).critChance
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
        persistSettings({
          catalogVisible: visible,
          catalogPreviewCode: visible ? settingsSession.getState().catalogPreviewCode : null,
        })
      },
      onClearData: () => {
        settingsSession.clear()
      },
      onEnterDebugScene: () => {
        persistSettings({
          gameStarted: true,
          pressureTestEnabled: true,
        })
      },
      onLeave: () => {
        persistSettings({
          gameStarted: false,
        })
      },
    })
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
    window.addEventListener('game-settings-changed', syncFromStorage)

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
      window.removeEventListener('game-settings-changed', syncFromStorage)

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
