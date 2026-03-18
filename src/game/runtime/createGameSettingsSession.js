import { clearGameSettings, loadGameSettings, saveGameSettings } from '../utils/gameSettingsStorage'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const clampAttackPower = (value) => clamp(Math.round(value), 1, 999)
const clampAttackSpeed = (value) => clamp(Math.round(value * 10) / 10, 1, 30)
const clampCritChance = (value) => clamp(Math.round(value * 100) / 100, 0, 1)

export const createGameSettingsNormalizer = ({
  shipDefaultItemId,
  exhaustDefaultItemId,
  clampExhaustIndex,
}) => {
  return (settings) => ({
    gameStarted: settings.gameStarted !== false,
    pressureTestEnabled: settings.pressureTestEnabled === true,
    equippedShipItemId:
      typeof settings.equippedShipItemId === 'string' ? settings.equippedShipItemId : shipDefaultItemId,
    equippedExhaustItemId:
      typeof settings.equippedExhaustItemId === 'string'
        ? settings.equippedExhaustItemId
        : exhaustDefaultItemId,
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
        musicEnabled: state.musicEnabled,
        fpsEnabled: state.fpsEnabled,
        impactEffectsEnabled: state.impactEffectsEnabled,
        attackPower: state.attackPower,
        attackSpeed: state.attackSpeed,
        critChance: state.critChance,
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
