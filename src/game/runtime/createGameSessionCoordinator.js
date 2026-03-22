import { parseAttackPowerInput, parseAttackSpeedInput, parseCritChanceInput } from '../utils/playerStats'
import { DEBUG_SCENE_FIXED_TARGET, DEBUG_SCENE_PRESSURE_TEST } from './gameConfig'

export const createGameSessionCoordinator = ({
  normalizeGameSettings,
  settingsSession,
  audio,
  playerStats,
  playerCombat,
  initialExhaustIndex,
  clampExhaustIndex,
  onImpactEffectsChange,
  onOverlayStatsChange,
}) => {
  let overlayController = null
  let currentExhaustIndex = initialExhaustIndex
  let impactEffectsEnabled = settingsSession.getState().impactEffectsEnabled

  const syncPlayerCombat = () => {
    playerCombat.syncSettings({
      attackPower: playerStats.attackPower,
      attackSpeed: playerStats.attackSpeed,
      critChance: playerStats.critChance,
      exhaustIndex: currentExhaustIndex,
      hasHomingBurst: playerStats.hasHomingBurst,
    })
  }

  const statAdjusters = {
    attackPower: (value, direction) =>
      normalizeGameSettings({
        attackPower: value + direction,
      }).attackPower,
    attackSpeed: (value, direction) =>
      normalizeGameSettings({
        attackSpeed: value + direction * 0.5,
      }).attackSpeed,
    critChance: (value, direction) =>
      normalizeGameSettings({
        critChance: value + direction * 0.05,
      }).critChance,
    playerMaxHealth: (value, direction) =>
      normalizeGameSettings({
        playerMaxHealth: value + direction,
      }).playerMaxHealth,
    debugStageStartAt: (value, direction) =>
      normalizeGameSettings({
        debugStageStartAt: value + direction,
      }).debugStageStartAt,
  }

  const persistSettings = (patch = {}) =>
    settingsSession.persist({
      gameStarted: true,
      musicEnabled: audio.isMusicEnabled(),
      impactEffectsEnabled,
      attackPower: playerStats.attackPower,
      attackSpeed: playerStats.attackSpeed,
      critChance: playerStats.critChance,
      playerMaxHealth: settingsSession.getState().playerMaxHealth,
      debugStageStartAt: settingsSession.getState().debugStageStartAt,
      equippedTacticalItemId: settingsSession.getState().equippedTacticalItemId,
      equippedExhaustItemId: `exhaust-${currentExhaustIndex}`,
      ...patch,
    })

  return {
    getCurrentExhaustIndex() {
      return currentExhaustIndex
    },
    isImpactEffectsEnabled() {
      return impactEffectsEnabled
    },
    getSettingsOverlayState() {
      return settingsSession.getOverlayState()
    },
    setOverlayController(controller) {
      overlayController = controller
    },
    syncFromStorage() {
      const nextSettings = settingsSession.reload()
      impactEffectsEnabled = nextSettings.impactEffectsEnabled
      currentExhaustIndex = settingsSession.getCurrentExhaustIndex()
      playerStats.attackPower = nextSettings.attackPower
      playerStats.attackSpeed = nextSettings.attackSpeed
      playerStats.critChance = nextSettings.critChance
      playerStats.hasHomingBurst = nextSettings.equippedTacticalItemId === 'tactical-quick-wit'
      audio.setMusicEnabled(nextSettings.musicEnabled)
      onImpactEffectsChange?.(impactEffectsEnabled)
      syncPlayerCombat()
      onOverlayStatsChange?.(playerStats)
      overlayController?.syncFromState({
        isCatalogVisible: nextSettings.catalogVisible === true,
        activeCatalogPreviewCode: nextSettings.catalogPreviewCode,
        isFpsVisible: nextSettings.fpsEnabled,
        settingsState: settingsSession.getOverlayState(),
      })
    },
    createOverlayHandlers() {
      return {
        onUiHover: () => audio.playUiHover(),
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
          impactEffectsEnabled = enabled
          onImpactEffectsChange?.(impactEffectsEnabled)
          persistSettings({
            impactEffectsEnabled: enabled,
          })
        },
        onAdjustStat: (key, direction) => {
          const adjustStat = statAdjusters[key]
          if (!adjustStat) return
          audio.playUiClick({ high: direction > 0 })
          if (key === 'playerMaxHealth') {
            const nextHealth = adjustStat(settingsSession.getState().playerMaxHealth, direction)
            playerCombat.setHealth(nextHealth)
            persistSettings({
              playerMaxHealth: nextHealth,
            })
            overlayController?.refreshSettings()
            return
          }
          playerStats[key] = adjustStat(playerStats[key], direction)
          syncPlayerCombat()
          onOverlayStatsChange?.(playerStats)
          persistSettings()
        },
        onAdjustDebugStageStartAt: (direction) => {
          audio.playUiClick({ high: direction > 0 })
          const currentValue = settingsSession.getState().debugStageStartAt
          const nextValue = statAdjusters.debugStageStartAt(currentValue, direction)
          settingsSession.persist({
            debugStageStartAt: nextValue,
          })
          overlayController?.refreshSettings()
        },
        onSaveDebugStageStartAt: (value) => {
          const nextDebugStageStartAt = Number(value)
          if (!Number.isFinite(nextDebugStageStartAt) || nextDebugStageStartAt < 0) {
            return {
              ok: false,
              error: '请输入有效的非负起始进度',
            }
          }

          const normalizedValue = normalizeGameSettings({
            debugStageStartAt: nextDebugStageStartAt,
          }).debugStageStartAt
          audio.playUiClick({
            high: normalizedValue >= settingsSession.getState().debugStageStartAt,
          })
          settingsSession.persist({
            debugStageStartAt: normalizedValue,
          })
          overlayController?.refreshSettings()

          return { ok: true }
        },
        onSavePlayerMaxHealth: (value) => {
          const nextPlayerMaxHealth = Number(value)
          if (!Number.isFinite(nextPlayerMaxHealth) || nextPlayerMaxHealth < 1) {
            return {
              ok: false,
              error: '请输入有效的生命值',
            }
          }

          const normalizedValue = normalizeGameSettings({
            playerMaxHealth: nextPlayerMaxHealth,
          }).playerMaxHealth
          audio.playUiClick({
            high: normalizedValue >= settingsSession.getState().playerMaxHealth,
          })
          playerCombat.setHealth(normalizedValue)
          persistSettings({
            playerMaxHealth: normalizedValue,
          })
          overlayController?.refreshSettings()

          return { ok: true }
        },
        onCycleExhaust: () => {
          const nextExhaustIndex = clampExhaustIndex(currentExhaustIndex + 1)
          currentExhaustIndex =
            nextExhaustIndex === currentExhaustIndex ? clampExhaustIndex(0) : nextExhaustIndex
          playerCombat.setExhaustIndex(currentExhaustIndex)
          audio.playUiClick({ high: true })
          persistSettings()
        },
        onSaveAttackPower: (value) => {
          const nextAttackPower = parseAttackPowerInput(value)
          if (nextAttackPower == null) {
            return {
              ok: false,
              error: '请输入有效的攻击力数值',
            }
          }

          audio.playUiClick({ high: nextAttackPower >= playerStats.attackPower })
          playerStats.attackPower = nextAttackPower
          syncPlayerCombat()
          onOverlayStatsChange?.(playerStats)
          persistSettings()

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

          audio.playUiClick({ high: nextAttackSpeed >= playerStats.attackSpeed })
          playerStats.attackSpeed = nextAttackSpeed
          syncPlayerCombat()
          onOverlayStatsChange?.(playerStats)
          persistSettings()

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

          audio.playUiClick({ high: nextCritChance >= playerStats.critChance })
          playerStats.critChance = nextCritChance
          syncPlayerCombat()
          onOverlayStatsChange?.(playerStats)
          persistSettings()

          return { ok: true }
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
          persistSettings({
            gameStarted: false,
          })
        },
      }
    },
  }
}
