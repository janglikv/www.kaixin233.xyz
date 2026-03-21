import { clearGameSettings, loadGameSettings, saveGameSettings } from '../utils/gameSettingsStorage'
import {
  clampAttackPower,
  clampAttackSpeed,
  clampCritChance,
  clampPlayerMaxHealth,
} from '../utils/playerStats'

const clampDebugStageStartAt = (value) =>
  Math.max(0, Math.round(Number.isFinite(value) ? value : 0))

export const createGameSettingsNormalizer = ({
  shipDefaultItemId,
  exhaustDefaultItemId,
  tacticalDefaultItemId = null,
  clampExhaustIndex,
}) => {
  return (settings) => ({
    gameStarted: settings.gameStarted !== false,
    pressureTestEnabled: settings.pressureTestEnabled === true,
    debugSceneMode: typeof settings.debugSceneMode === 'string' ? settings.debugSceneMode : null,
    equippedShipItemId:
      typeof settings.equippedShipItemId === 'string' ? settings.equippedShipItemId : shipDefaultItemId,
    equippedExhaustItemId:
      typeof settings.equippedExhaustItemId === 'string'
        ? settings.equippedExhaustItemId
        : exhaustDefaultItemId,
    equippedTacticalItemId:
      typeof settings.equippedTacticalItemId === 'string'
        ? settings.equippedTacticalItemId
        : tacticalDefaultItemId,
    musicEnabled: Boolean(settings.musicEnabled),
    fpsEnabled: settings.fpsEnabled !== false,
    impactEffectsEnabled: settings.impactEffectsEnabled !== false,
    catalogVisible: settings.catalogVisible === true,
    catalogPreviewCode: typeof settings.catalogPreviewCode === 'string' ? settings.catalogPreviewCode : null,
    attackPower: clampAttackPower(settings.attackPower),
    attackSpeed: clampAttackSpeed(settings.attackSpeed),
    critChance: clampCritChance(settings.critChance),
    playerMaxHealth: clampPlayerMaxHealth(settings.playerMaxHealth),
    debugStageStartAt: clampDebugStageStartAt(settings.debugStageStartAt),
    exhaustIndex: clampExhaustIndex(settings.exhaustIndex),
    coinCount: Number.isFinite(settings.coinCount) ? Math.max(0, Math.floor(settings.coinCount)) : 0,
  })
}

export const createGameSettingsSession = ({
  defaults,
  normalize,
  getExhaustIndexByItemId,
}) => {
  let state = normalize(loadGameSettings(defaults))

  return {
    getState() {
      return state
    },
    getOverlayState() {
      return {
        pressureTestEnabled: state.pressureTestEnabled,
        debugSceneMode: state.debugSceneMode,
        musicEnabled: state.musicEnabled,
        fpsEnabled: state.fpsEnabled,
        impactEffectsEnabled: state.impactEffectsEnabled,
        attackPower: state.attackPower,
        attackSpeed: state.attackSpeed,
        critChance: state.critChance,
        playerMaxHealth: state.playerMaxHealth,
        debugStageStartAt: state.debugStageStartAt,
        coinCount: state.coinCount,
      }
    },
    getCurrentExhaustIndex() {
      return getExhaustIndexByItemId(state.equippedExhaustItemId)
    },
    patch(patch) {
      state = normalize({
        ...state,
        ...patch,
      })
      return state
    },
    persist(patch = {}) {
      state = normalize({
        ...state,
        ...patch,
      })
      saveGameSettings(state)
      return state
    },
    reload() {
      state = normalize(
        loadGameSettings({
          ...defaults,
          exhaustIndex: this.getCurrentExhaustIndex(),
        }),
      )
      return state
    },
    clear() {
      clearGameSettings()
    },
  }
}
