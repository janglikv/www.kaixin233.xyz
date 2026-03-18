import * as PIXI from 'pixi.js'
import { createSynthAudio } from '../audio/createSynthAudio'
import { createBulletSystem } from '../effects/createBulletSystem'
import { getEnemyCatalogEntryByPluginIndex } from '../data/shipCatalog'
import { CATALOG_ENTRIES } from '../data/catalogEntries'
import { SHIP_CATALOG } from '../data/shipCatalog'
import { createExhaustSwitcher } from '../effects/createExhaustSwitcher'
import { createEnemyBulletSystem } from '../effects/createEnemyBulletSystem'
import { createHomingBurstSystem } from '../effects/createHomingBurstSystem'
import { createImpactEffectSystem } from '../effects/createImpactEffectSystem'
import { createCatalogOverlay } from '../renderers/createCatalogOverlay'
import { createPlayerHealthBar } from '../renderers/createPlayerHealthBar'
import { createSettingsButton } from '../renderers/createSettingsButton'
import { createShip } from '../renderers/createShip'
import { createSettingsOverlay } from '../renderers/createSettingsOverlay'
import { createShipScene } from '../renderers/createShipScene'
import { createSpaceBackdrop } from '../renderers/createSpaceBackdrop'
import { createStatsPanel } from '../renderers/createStatsPanel'
import { EXHAUST_PLUGINS } from '../effects/exhaustPlugins'
import { clearGameSettings, loadGameSettings, saveGameSettings } from '../utils/gameSettingsStorage'
import { createKeyboardController } from '../utils/createKeyboardController'
import { createPointerController } from '../utils/createPointerController'

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
const TEST_ENEMY_COLUMNS = 72
const TEST_ENEMY_ROWS = 40
const TEST_ENEMY_THEME_INDEX = 3
const TEST_ENEMY_SCALE = 0.11
const TEST_ENEMY_HEALTH = 1
const TEST_ENEMY_TOP_Y = -72
const TEST_ENEMY_GAP_Y = 28
const TEST_ENEMY_STAGGER_Y = TEST_ENEMY_GAP_Y * 0.5
const TEST_ENEMY_SPEED_Y = 196
const TEST_ENEMY_SIDE_PADDING = 8
const TEST_ENEMY_RECYCLE_BUFFER = 120
const PLAYER_MAX_HEALTH = 10
const ENEMY_ATTACK_SPEED = 1
const ENEMY_BULLET_DAMAGE = 5
const GAME_OVER_FADE_TIME = 1.2
const PLAYER_STATS = {
  attackPower: 1,
  attackSpeed: 11.5,
  critChance: 1,
}
const SHIP_DEFAULT_ITEM_ID = 'ship-frame-0'
const EXHAUST_0_ITEM_ID = 'exhaust-0'
const GAME_SETTINGS_DEFAULTS = {
  gameStarted: true,
  pressureTestEnabled: true,
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
  pressureTestEnabled: settings.pressureTestEnabled !== false,
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

const createEnemySpriteAsset = ({ PIXI, renderer, shipTheme }) => {
  const { ship, flameGlow, flameCore, flameInner } = createShip(shipTheme)

  flameGlow.visible = false
  flameCore.visible = false
  flameInner.visible = false
  ship.rotation = Math.PI
  ship.scale.set(TEST_ENEMY_SCALE)

  const bounds = ship.getLocalBounds()
  ship.position.set(-bounds.x, -bounds.y)

  const wrapper = new PIXI.Container()
  wrapper.addChild(ship)

  return {
    texture: renderer.generateTexture(wrapper),
    anchorX: -bounds.x / bounds.width,
    anchorY: -bounds.y / bounds.height,
  }
}

const createEnemyFormation = ({ PIXI, renderer, parent }) => {
  const enemies = []
  const activeHitboxes = []
  const enemyCatalogEntry = getEnemyCatalogEntryByPluginIndex(TEST_ENEMY_THEME_INDEX)
  const enemySpriteAsset = createEnemySpriteAsset({
    PIXI,
    renderer,
    shipTheme: enemyCatalogEntry.theme,
  })
  const columnSpacing =
    TEST_ENEMY_COLUMNS > 1
      ? (LOGICAL_WIDTH - TEST_ENEMY_SIDE_PADDING * 2) / (TEST_ENEMY_COLUMNS - 1)
      : 0
  const recycleSpan = TEST_ENEMY_ROWS * TEST_ENEMY_GAP_Y
  const bottomLimit = LOGICAL_HEIGHT + TEST_ENEMY_RECYCLE_BUFFER

  const recycleEnemy = (enemy, steps = 1) => {
    enemy.health = TEST_ENEMY_HEALTH
    enemy.y -= recycleSpan * steps
    enemy.sprite.visible = true
    enemy.hitbox.left = enemy.x - 24
    enemy.hitbox.right = enemy.x + 24
    enemy.hitbox.top = enemy.y - 30
    enemy.hitbox.bottom = enemy.y + 28
    enemy.hitbox.centerX = enemy.x
    enemy.hitbox.centerY = enemy.y + 8
  }

  for (let rowIndex = 0; rowIndex < TEST_ENEMY_ROWS; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < TEST_ENEMY_COLUMNS; columnIndex += 1) {
      const x = TEST_ENEMY_SIDE_PADDING + columnIndex * columnSpacing
      const y =
        TEST_ENEMY_TOP_Y -
        rowIndex * TEST_ENEMY_GAP_Y +
        (columnIndex % 2 === 0 ? 0 : TEST_ENEMY_STAGGER_Y)
      const enemyId = rowIndex * TEST_ENEMY_COLUMNS + columnIndex
      const sprite = new PIXI.Sprite(enemySpriteAsset.texture)
      sprite.anchor.set(enemySpriteAsset.anchorX, enemySpriteAsset.anchorY)
      sprite.position.set(x, y)

      parent.addChild(sprite)
      const hitbox = {
        left: x - 24,
        right: x + 24,
        top: y - 30,
        bottom: y + 28,
        id: enemyId,
        centerX: x,
        centerY: y + 8,
        health: TEST_ENEMY_HEALTH,
      }
      const enemy = {
        id: enemyId,
        health: TEST_ENEMY_HEALTH,
        x,
        y,
        columnIndex,
        sprite,
        hitbox,
      }
      enemies.push(enemy)
      activeHitboxes.push(hitbox)
    }
  }

  return {
    getHitboxes() {
      activeHitboxes.length = 0
      enemies.forEach((enemy) => {
        if (enemy.health > 0) {
          activeHitboxes.push(enemy.hitbox)
        }
      })
      return activeHitboxes
    },
    getShooters() {
      return []
    },
    applyDamage(enemyId, damage) {
      const enemy = enemies.find((item) => item.id === enemyId)
      if (!enemy || enemy.health <= 0) {
        return null
      }

      const previousHealth = enemy.health
      enemy.health = Math.max(0, enemy.health - damage)
      enemy.hitbox.health = enemy.health
      const alive = enemy.health > 0
      const died = previousHealth > 0 && !alive
      if (died) {
        enemy.sprite.visible = false
      }

      const hitResult = {
        id: enemy.id,
        alive,
        died,
        health: enemy.health,
        x: enemy.x,
        y: enemy.y + 8,
      }

      if (died) {
        recycleEnemy(enemy)
        enemy.sprite.position.set(enemy.x, enemy.y)
        enemy.hitbox.health = enemy.health
      }

      return hitResult
    },
    update(deltaSeconds) {
      enemies.forEach((enemy) => {
        enemy.y += TEST_ENEMY_SPEED_Y * deltaSeconds
        if (enemy.y > bottomLimit) {
          recycleEnemy(enemy)
        }
        enemy.sprite.position.set(enemy.x, enemy.y)
        enemy.hitbox.left = enemy.x - 24
        enemy.hitbox.right = enemy.x + 24
        enemy.hitbox.top = enemy.y - 30
        enemy.hitbox.bottom = enemy.y + 28
        enemy.hitbox.centerX = enemy.x
        enemy.hitbox.centerY = enemy.y + 8
        enemy.hitbox.health = enemy.health
      })
    },
    destroy() {
      enemySpriteAsset.texture.destroy(true)
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
  constructor(container, options = {}) {
    this.container = container
    this.pluginIndex = options.pluginIndex ?? 0
    this.spawnEnemies = options.spawnEnemies !== false
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

    worldLayer.addChild(
      createSpaceBackdrop({
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
      }),
    )

    const shipScene = createShipScene({
      x: LOGICAL_WIDTH * 0.5,
      y: LOGICAL_HEIGHT * 0.72,
      shipScale: SHIP_SCALE,
      shipTheme: playerShipTheme,
    })
    const enemyFormation = this.spawnEnemies
      ? createEnemyFormation({
          PIXI,
          renderer: app.renderer,
          parent: worldLayer,
        })
      : createEmptyEnemyFormation()
    const impactEffectSystem = createImpactEffectSystem(worldLayer)
    const fadeOverlay = new PIXI.Graphics()
    fadeOverlay
      .rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
      .fill({ color: 0x000000, alpha: 1 })
    fadeOverlay.alpha = 0

    const gameOverText = new PIXI.Text({
      text: '游戏结束',
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

    const enemyBulletSystem = createEnemyBulletSystem(worldLayer, {
      renderer: app.renderer,
      onFire: () => {
        audio.playEnemyShot()
      },
      onHit: ({ x, y }) => {
        playerHealth.current = Math.max(0, playerHealth.current - ENEMY_BULLET_DAMAGE)
        playerHealthBar.update(playerHealth.current, playerHealth.max)
        audio.playHit()
        spawnImpact(x, y, { scale: 0.5 })
        if (playerHealth.current <= 0) {
          triggerGameOver()
        }
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
    let catalogBounds = null
    let settingsButtonBounds = null
    let settingsBounds = null
    let isCatalogVisible = persistedSettings.catalogVisible === true
    let activeCatalogPreviewCode = persistedSettings.catalogPreviewCode
    let isSettingsVisible = false
    let isPressureTestEnabled = persistedSettings.pressureTestEnabled
    let isFpsVisible = persistedSettings.fpsEnabled
    let isImpactEffectsEnabled = persistedSettings.impactEffectsEnabled
    let equippedShipItemId = persistedSettings.equippedShipItemId
    let currentExhaustIndex = initialEquippedExhaustIndex
    const buildSettingsSnapshot = (overrides = {}) =>
      normalizeGameSettings({
        gameStarted: true,
        pressureTestEnabled: isPressureTestEnabled,
        equippedShipItemId,
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
      equippedShipItemId = nextSettings.equippedShipItemId
      currentExhaustIndex = getExhaustIndexByItemId(nextSettings.equippedExhaustItemId)
      isCatalogVisible = nextSettings.catalogVisible === true
      activeCatalogPreviewCode = nextSettings.catalogPreviewCode
      audio.setMusicEnabled(nextSettings.musicEnabled)
      fpsText.visible = isFpsVisible
      exhaustSwitcher.setIndex(currentExhaustIndex)
      if (isCatalogVisible) {
        catalogOverlay.show()
        if (activeCatalogPreviewCode) {
          catalogOverlay.openPreviewByCode(activeCatalogPreviewCode)
        }
      } else {
        catalogOverlay.hide()
      }
      settingsOverlay.update(getSettingsOverlayState())
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
      if (!isImpactEffectsEnabled) return
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

        const insideCatalog =
          isCatalogVisible &&
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
          isSettingsVisible &&
          settingsBounds &&
          logicalX >= settingsBounds.left &&
          logicalX <= settingsBounds.right &&
          logicalY >= settingsBounds.top &&
          logicalY <= settingsBounds.bottom

        return !(insideCatalog || insideSettingsButton || insideSettings)
      },
    })
    const exhaustSwitcher = createExhaustSwitcher({
      PIXI,
      runtimeLayer: shipScene.runtimeLayer,
      initialIndex: currentExhaustIndex,
    })

    const statsPanel = createStatsPanel({
      x: LOGICAL_WIDTH - 18,
      y: LOGICAL_HEIGHT - 114,
      stats: playerStats,
    })
    const playerHealthBar = createPlayerHealthBar({
      x: LOGICAL_WIDTH - 18,
      y: LOGICAL_HEIGHT - 16,
      health: playerHealth.current,
      maxHealth: playerHealth.max,
      width: 144,
      align: 'right',
    })
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
        audio.playUiClick()
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
    const settingsOverlay = createSettingsOverlay({
      x: 0,
      y: 0,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      state: getSettingsOverlayState(),
      onMusicToggle: (enabled) => {
        audio.setMusicEnabled(enabled)
        if (enabled) {
          audio.playUiClick({ high: true })
        }
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())
      },
      onFpsToggle: (enabled) => {
        audio.playUiClick({ high: enabled })
        isFpsVisible = enabled
        fpsText.visible = isFpsVisible
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())
      },
      onImpactEffectsToggle: (enabled) => {
        audio.playUiClick({ high: enabled })
        isImpactEffectsEnabled = enabled
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())
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
        statsPanel.update(playerStats)
        persistSettings()
        settingsOverlay.update(getSettingsOverlayState())
      },
      onCatalogOpen: () => {
        audio.playUiClick()
        settingsOverlay.hide()
        isSettingsVisible = false
        catalogOverlay.toggle()
        isCatalogVisible = catalogOverlay.isVisible()
        if (!isCatalogVisible) {
          activeCatalogPreviewCode = null
        }
        persistSettings()
      },
      onClearData: () => {
        audio.playUiClick()
        clearGameSettings()
      },
      onEnterDebugScene: () => {
        audio.playUiClick()
        saveGameSettings(buildSettingsSnapshot({
          gameStarted: true,
          pressureTestEnabled: true,
        }))
      },
      onLeave: () => {
        audio.playUiClick()
        saveGameSettings(buildSettingsSnapshot({
          gameStarted: false,
        }))
      },
      onClose: () => {
        audio.playUiClick()
        settingsOverlay.hide()
        isSettingsVisible = false
      },
    })
    const fpsText = new PIXI.Text({
      text: '帧率 0',
      style: {
        fill: 0x7cff72,
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 14,
        fontWeight: '700',
      },
    })
    fpsText.position.set(14, 18)
    fpsText.visible = isFpsVisible
    const settingsButton = createSettingsButton({
      x: LOGICAL_WIDTH - 48,
      y: 14,
      onTap: () => {
        audio.playUiClick()
        settingsOverlay.toggle()
        isSettingsVisible = settingsOverlay.isVisible()
        settingsOverlay.update(getSettingsOverlayState())
      },
    })
    catalogBounds = catalogOverlay.bounds
    settingsBounds = settingsOverlay.bounds
    settingsButtonBounds = settingsButton.bounds
    worldLayer.addChild(shipScene.shipGroup)
    gameOverLayer.addChild(fadeOverlay)
    gameOverLayer.addChild(gameOverText)
    gameOverLayer.addChild(gameOverSubText)

    gameLayer.addChild(worldLayer)
    gameLayer.addChild(worldMask)
    gameLayer.addChild(fpsText)
    gameLayer.addChild(settingsButton.container)
    gameLayer.addChild(playerHealthBar.container)
    gameLayer.addChild(statsPanel.container)
    gameLayer.addChild(catalogOverlay.container)
    gameLayer.addChild(settingsOverlay.container)
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
      const deltaSeconds = ticker.deltaMS / 1000
      elapsedSeconds += deltaSeconds
      fpsSampleElapsed += deltaSeconds
      fpsFrameCount += 1
      if (fpsSampleElapsed >= 0.2) {
        fpsText.text = `帧率 ${Math.round(fpsFrameCount / fpsSampleElapsed)}`
        fpsSampleElapsed = 0
        fpsFrameCount = 0
      }
      if (gameOver) {
        gameOverFadeProgress = Math.min(
          1,
          gameOverFadeProgress + deltaSeconds / GAME_OVER_FADE_TIME,
        )
      }
      const { horizontal, vertical } = gameOver ? { horizontal: 0, vertical: 0 } : keyboard.getAxis()
      const movementLength = Math.hypot(horizontal, vertical) || 1
      const velocityX = (horizontal / movementLength) * SHIP_MOVE_SPEED
      const velocityY = (vertical / movementLength) * SHIP_MOVE_SPEED
      const nextShipX = Math.max(
        WORLD_INSET + SHIP_BOUND_HALF_WIDTH,
        Math.min(
          LOGICAL_WIDTH - WORLD_INSET - SHIP_BOUND_HALF_WIDTH,
          shipScene.shipX + velocityX * deltaSeconds,
        ),
      )
      const nextShipY = Math.max(
        WORLD_INSET + SHIP_BOUND_HALF_HEIGHT,
        Math.min(
          LOGICAL_HEIGHT - WORLD_INSET - SHIP_BOUND_HALF_HEIGHT,
          shipScene.shipY + velocityY * deltaSeconds,
        ),
      )

      shipScene.setPosition(nextShipX, nextShipY)

      const pulse = 0.82 + Math.sin(elapsedSeconds * 14) * 0.18

      shipScene.flameGlow.scale.set(0.94 + pulse * 0.18, 0.86 + pulse * 0.12)
      shipScene.flameCore.scale.set(0.92 + pulse * 0.4, 0.8 + pulse * 0.26)
      shipScene.flameInner.scale.set(0.84 + pulse * 0.26, 0.74 + pulse * 0.18)
      shipScene.flameGlow.alpha = 0.24 + pulse * 0.08
      shipScene.flameCore.alpha = 0.46 + pulse * 0.14
      shipScene.flameInner.alpha = 0.2 + pulse * 0.1

      if (!gameOver) {
        exhaustSwitcher.update(deltaSeconds, elapsedSeconds, {
          originX: shipScene.shipX,
          originY: shipScene.shipY + SHIP_THRUST_DISTANCE,
          directionX: 0,
          directionY: -1,
          pulse,
          scale: EFFECT_SCALE,
        })
      }
      enemyFormation.update(deltaSeconds, elapsedSeconds)
      enemyBulletSystem.update(deltaSeconds, {
        shooters: enemyFormation.getShooters(),
        fireInterval: 1 / ENEMY_ATTACK_SPEED,
        target: gameOver
          ? null
          : {
              left: shipScene.shipX - 22,
              right: shipScene.shipX + 22,
              top: shipScene.shipY - 34,
              bottom: shipScene.shipY + 28,
            },
      })
      bulletSystem.update(deltaSeconds, {
        shouldFire: !gameOver && pointer.isFiring(),
        originX: shipScene.shipX,
        originY: shipScene.shipY - SHIP_MUZZLE_OFFSET,
        targets: enemyFormation.getHitboxes(),
        fireInterval: 1 / playerStats.attackSpeed,
      })
      homingBurstSystem.update(deltaSeconds)
      impactEffectSystem.update(deltaSeconds)
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
