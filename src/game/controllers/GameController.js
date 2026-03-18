import * as PIXI from 'pixi.js'
import { createSynthAudio } from '../audio/createSynthAudio'
import { createBulletSystem } from '../effects/createBulletSystem'
import { CATALOG_ENTRIES } from '../data/catalogEntries'
import { RiftServitorSwarm } from '../enemies/RiftServitorSwarm'
import { SHIP_CATALOG } from '../data/shipCatalog'
import { createExhaustSwitcher } from '../effects/createExhaustSwitcher'
import { createEnemyBulletSystem } from '../effects/createEnemyBulletSystem'
import { createHomingBurstSystem } from '../effects/createHomingBurstSystem'
import { createImpactEffectSystem } from '../effects/createImpactEffectSystem'
import { createShipScene } from '../renderers/createShipScene'
import { createSpaceBackdrop } from '../renderers/createSpaceBackdrop'
import { EXHAUST_PLUGINS } from '../effects/exhaustPlugins'
import { BattleOverlayController } from '../ui/BattleOverlayController'
import { clearGameSettings, loadGameSettings, saveGameSettings } from '../utils/gameSettingsStorage'
import { createKeyboardController } from '../utils/createKeyboardController'
import { createPointerController } from '../utils/createPointerController'
import { createEcsWorld, createEntity } from '../ecs/createEcsWorld'
import { ecsSystemRegistry } from '../ecs/ecsSystemRegistry'

const LOGICAL_WIDTH = 1280
const LOGICAL_HEIGHT = 720
const SHIP_SCALE = 0.42
const EFFECT_SCALE = 0.5
const SHIP_THRUST_DISTANCE = 76 * SHIP_SCALE
const SHIP_MUZZLE_OFFSET = 58 * SHIP_SCALE
const SHIP_MOVE_SPEED = 260
const SHIP_BOUND_HALF_WIDTH = 46 * SHIP_SCALE
const SHIP_BOUND_HALF_HEIGHT = 64 * SHIP_SCALE
const WORLD_INSET = 0
const WORLD_RADIUS = 0
const NORMAL_ENEMY_SPAWN_X = LOGICAL_WIDTH * 0.5
const NORMAL_ENEMY_SPAWN_Y = -92
const PLAYER_MAX_HEALTH = 10
const ENEMY_ATTACK_SPEED = 1
const ENEMY_BULLET_DAMAGE = 5
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
const clampExhaustIndex = (value) =>
  clamp(Number.isFinite(value) ? Math.floor(value) : 0, 0, Math.max(0, EXHAUST_PLUGINS.length - 1))

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

const createGameplayWorld = ({ shipScene }) => {
  const world = createEcsWorld()
  const playerEntity = createEntity(world)

  world.components.position.set(playerEntity, {
    x: shipScene.shipX,
    y: shipScene.shipY,
  })
  world.components.bounds.set(playerEntity, {
    halfWidth: SHIP_BOUND_HALF_WIDTH,
    halfHeight: SHIP_BOUND_HALF_HEIGHT,
  })
  world.components.playerControlled.set(playerEntity, { tag: 'player' })
  world.links.shipScene.set(playerEntity, shipScene)

  return {
    world,
    playerEntity,
    syncPlayerRender() {
      const position = world.components.position.get(playerEntity)
      if (!position) return
      shipScene.setPosition(position.x, position.y)
    },
    getPlayerPosition() {
      return world.components.position.get(playerEntity)
    },
    updatePlayer(deltaSeconds, axis) {
      ecsSystemRegistry.playerMovementSystem(world, {
        deltaSeconds,
        axis,
        speed: SHIP_MOVE_SPEED,
        clampRect: {
          left: WORLD_INSET,
          right: LOGICAL_WIDTH - WORLD_INSET,
          top: WORLD_INSET,
          bottom: LOGICAL_HEIGHT - WORLD_INSET,
        },
      })
      this.syncPlayerRender()
    },
  }
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

    const gameLayer = new PIXI.Container()
    app.stage.addChild(gameLayer)
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
    let layoutScale = 1
    let layoutOffsetX = 0
    let layoutOffsetY = 0

    const worldLayer = new PIXI.Container()
    const gameOverLayer = new PIXI.Container()
    const worldMask = new PIXI.Graphics()
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
    worldMask
      .roundRect(
        WORLD_INSET,
        WORLD_INSET,
        LOGICAL_WIDTH - WORLD_INSET * 2,
        LOGICAL_HEIGHT - WORLD_INSET * 2,
        WORLD_RADIUS,
      )
      .fill(0xffffff)
    worldLayer.mask = worldMask

    const spaceBackdrop = createSpaceBackdrop({
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    })
    worldLayer.addChild(spaceBackdrop)

    const shipScene = createShipScene({
      x: LOGICAL_WIDTH * 0.5,
      y: LOGICAL_HEIGHT * 0.72,
      shipScale: SHIP_SCALE,
      shipTheme: playerShipTheme,
    })
    const gameplayWorld = createGameplayWorld({ shipScene })
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
    const fadeOverlay = new PIXI.Graphics()
    fadeOverlay
      .rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
      .fill({ color: 0x000000, alpha: 1 })
    fadeOverlay.alpha = 0

    const gameOverText = new PIXI.Text({
      text: '撤离失败',
      style: {
        fill: 0xd62f3f,
        fontFamily: 'STKaiti, KaiTi, serif',
        fontSize: 62,
        fontWeight: '700',
        letterSpacing: 2,
        dropShadow: {
          alpha: 0.35,
          angle: Math.PI / 2,
          blur: 10,
          color: 0x220205,
          distance: 6,
        },
      },
    })
    gameOverText.anchor.set(0.5)
    gameOverText.position.set(LOGICAL_WIDTH * 0.5, LOGICAL_HEIGHT * 0.475)
    gameOverText.alpha = 0

    const gameOverSubText = new PIXI.Text({
      text: 'GAME OVER',
      style: {
        fill: 0xd62f3f,
        fontFamily: 'Georgia, serif',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 4,
        dropShadow: {
          alpha: 0.22,
          angle: Math.PI / 2,
          blur: 8,
          color: 0x140103,
          distance: 4,
        },
      },
    })
    gameOverSubText.anchor.set(0.5)
    gameOverSubText.position.set(LOGICAL_WIDTH * 0.5, LOGICAL_HEIGHT * 0.535)
    gameOverSubText.alpha = 0

    const triggerGameOver = () => {
      if (gameOver) return
      gameOver = true
      shipScene.shipGroup.visible = false
      audio.playExplosion({ large: true })
      audio.playGameOver()
      spawnImpact(shipScene.shipX, shipScene.shipY, {
        scale: 3.2,
        flashOuterColor: 0xff4c39,
        flashInnerColor: 0xffd2a6,
        sparkColors: [0xff3b30, 0xff7a45, 0xffc15a],
      })
    }
    const updateGameOverOverlay = () => {
      fadeOverlay.alpha = gameOverFadeProgress * 0.66
      gameOverText.alpha = Math.max(0, (gameOverFadeProgress - 0.22) / 0.5)
      gameOverSubText.alpha = Math.max(0, (gameOverFadeProgress - 0.38) / 0.38)
      gameOverText.position.set(
        LOGICAL_WIDTH * 0.5,
        LOGICAL_HEIGHT * 0.475 + (1 - gameOverText.alpha) * 12,
      )
      gameOverSubText.position.set(
        LOGICAL_WIDTH * 0.5,
        LOGICAL_HEIGHT * 0.535 + (1 - gameOverSubText.alpha) * 8,
      )
    }
    let overlayController = null
    const applyPlayerDamage = ({ damage, x, y, impactOptions = null }) => {
      if (gameOver || damage <= 0) return
      playerHealth.current = Math.max(0, playerHealth.current - damage)
      overlayController?.updateHealth(playerHealth.current, playerHealth.max)
      audio.playHit()
      if (impactOptions) {
        spawnImpact(x, y, impactOptions)
      }
      if (playerHealth.current <= 0) {
        triggerGameOver()
      }
    }

    const enemyBulletSystem = createEnemyBulletSystem(worldLayer, {
      renderer: app.renderer,
      onFire: () => {
        audio.playEnemyShot()
      },
      onHit: ({ x, y }) => {
        applyPlayerDamage({
          damage: ENEMY_BULLET_DAMAGE,
          x,
          y,
          impactOptions: { scale: 0.5 },
        })
      },
    })
    const homingBurstSystem = createHomingBurstSystem({
      parent: worldLayer,
      onSpawn: () => {
        audio.playHomingLaunch()
      },
      onImpact: ({ x, y, target }) => {
        const isCrit = Math.random() < playerStats.critChance
        const damagedEnemy = enemyFormation.applyDamage(
          target.id,
          playerStats.attackPower * (isCrit ? 2 : 1),
        )
        audio.playHit({ crit: isCrit })
        spawnImpact(x, y, { scale: isCrit ? 0.56 : 0.34 })
        if (damagedEnemy?.died) {
          audio.playExplosion({ large: true })
          spawnImpact(damagedEnemy.x, damagedEnemy.y, {
            scale: 2.7,
            flashOuterColor: 0xff5a36,
            flashInnerColor: 0xffd0a8,
            sparkColors: [0xff3b30, 0xff7b54, 0xffb347],
          })
        }
        return isCrit
      },
    })
    const bulletSystem = createBulletSystem(worldLayer, {
      renderer: app.renderer,
      onFire: () => {
        audio.playPlayerShot()
      },
      onHit: ({ x, y, target }) => {
        const isCrit = Math.random() < playerStats.critChance
        const damage = playerStats.attackPower * (isCrit ? 2 : 1)
        const damagedEnemy = enemyFormation.applyDamage(target.id, damage)

        audio.playHit({ crit: isCrit })
        spawnImpact(x, y, {
          scale: isCrit ? 0.62 : 0.28 + damage / 260,
        })
        if (damagedEnemy?.died) {
          audio.playExplosion({ large: true })
          spawnImpact(damagedEnemy.x, damagedEnemy.y, {
            scale: 2.7,
            flashOuterColor: 0xff5a36,
            flashInnerColor: 0xffd0a8,
            sparkColors: [0xff3b30, 0xff7b54, 0xffb347],
          })
        }
        if (!isCrit || !damagedEnemy) return

        let followUpTarget = null
        let followUpDistance = Infinity

        enemyFormation.getHitboxes().forEach((enemy) => {
          if (enemy.id === damagedEnemy.id) return
          const distance = Math.hypot(enemy.centerX - damagedEnemy.x, enemy.centerY - damagedEnemy.y)
          if (distance >= followUpDistance) return
          followUpDistance = distance
          followUpTarget = {
            id: enemy.id,
            x: enemy.centerX,
            y: enemy.centerY,
          }
        })

        homingBurstSystem.spawnPair({
          x: shipScene.shipX,
          y: shipScene.shipY - SHIP_MUZZLE_OFFSET,
          target: followUpTarget,
          getTargets: () =>
            enemyFormation.getHitboxes().map((enemy) => ({
              id: enemy.id,
              x: enemy.centerX,
              y: enemy.centerY,
            })),
        })
      },
    })
    const keyboard = createKeyboardController()
    let isCatalogVisible = persistedSettings.catalogVisible === true
    let activeCatalogPreviewCode = persistedSettings.catalogPreviewCode
    let isPressureTestEnabled = persistedSettings.pressureTestEnabled
    let isFpsVisible = persistedSettings.fpsEnabled
    let isImpactEffectsEnabled = persistedSettings.impactEffectsEnabled
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
      exhaustSwitcher.setIndex(currentExhaustIndex)
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
    const spawnImpact = (x, y, options = {}) => {
      if (!isImpactEffectsEnabled && options.force !== true) return
      impactEffectSystem.spawn(x, y, options)
    }
    const unlockAudio = () => {
      audio.unlock()
    }
    app.canvas.addEventListener('pointerdown', unlockAudio, { passive: true })
    const pointer = createPointerController(app.canvas, {
      shouldStart: (event) => {
        const rect = app.canvas.getBoundingClientRect()
        const logicalX = (event.clientX - rect.left - layoutOffsetX) / layoutScale
        const logicalY = (event.clientY - rect.top - layoutOffsetY) / layoutScale
        return !overlayController.containsInteractive(logicalX, logicalY)
      },
    })
    const exhaustSwitcher = createExhaustSwitcher({
      PIXI,
      runtimeLayer: shipScene.runtimeLayer,
      initialIndex: currentExhaustIndex,
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
    worldLayer.addChild(shipScene.shipGroup)
    gameOverLayer.addChild(fadeOverlay)
    gameOverLayer.addChild(gameOverText)
    gameOverLayer.addChild(gameOverSubText)

    gameLayer.addChild(worldLayer)
    gameLayer.addChild(worldMask)
    gameLayer.addChild(gameOverLayer)
    window.addEventListener('game-settings-changed', syncFromStorage)

    let elapsedSeconds = 0
    let fpsSampleElapsed = 0
    let fpsFrameCount = 0

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
      gameplayWorld.updatePlayer(deltaSeconds, axis)
      const playerPosition = gameplayWorld.getPlayerPosition()
      const playerX = playerPosition?.x ?? shipScene.shipX
      const playerY = playerPosition?.y ?? shipScene.shipY

      const pulse = 0.82 + Math.sin(elapsedSeconds * 14) * 0.18

      shipScene.flameGlow.scale.set(0.94 + pulse * 0.18, 0.86 + pulse * 0.12)
      shipScene.flameCore.scale.set(0.92 + pulse * 0.4, 0.8 + pulse * 0.26)
      shipScene.flameInner.scale.set(0.84 + pulse * 0.26, 0.74 + pulse * 0.18)
      shipScene.flameGlow.alpha = 0.24 + pulse * 0.08
      shipScene.flameCore.alpha = 0.46 + pulse * 0.14
      shipScene.flameInner.alpha = 0.2 + pulse * 0.1

      if (!gameOver) {
        exhaustSwitcher.update(deltaSeconds, elapsedSeconds, {
          originX: playerX,
          originY: playerY + SHIP_THRUST_DISTANCE,
          directionX: 0,
          directionY: -1,
          pulse,
          scale: EFFECT_SCALE,
        })
      }
      const playerTarget = gameOver
        ? null
        : {
            left: playerX - 22,
            right: playerX + 22,
            top: playerY - 34,
            bottom: playerY + 28,
          }
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
        applyPlayerDamage({ damage, x, y })
      })
      enemyBulletSystem.update(deltaSeconds, {
        shooters: enemyFormation.getShooters(),
        fireInterval: 1 / ENEMY_ATTACK_SPEED,
        target: playerTarget,
      })
      bulletSystem.update(deltaSeconds, {
        shouldFire: !gameOver && pointer.isFiring(),
        originX: playerX,
        originY: playerY - SHIP_MUZZLE_OFFSET,
        targets: enemyFormation.getHitboxes(),
        fireInterval: 1 / playerStats.attackSpeed,
      })
      homingBurstSystem.update(deltaSeconds)
      impactEffectSystem.update(deltaSeconds)
      updateGameOverOverlay()
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
      app.canvas.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('game-settings-changed', syncFromStorage)

      bulletSystem.destroy()
      enemyBulletSystem.destroy()
      homingBurstSystem.destroy()
      impactEffectSystem.destroy()
      enemyFormation.destroy()
      keyboard.destroy()
      pointer.destroy()
      exhaustSwitcher.destroy()
      overlayController?.destroy()
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
