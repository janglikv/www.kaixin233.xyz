import { SHIP_CATALOG } from '../data/shipCatalog'
import { PLAYER_STATS } from '../utils/playerStats'

export const LOGICAL_WIDTH = 1280
export const LOGICAL_HEIGHT = 720
export const WORLD_INSET = 0
export const WORLD_RADIUS = 0
export const PLAYER_MAX_HEALTH = 10
export const GAME_OVER_FADE_TIME = 1.2
export const SHIP_DEFAULT_ITEM_ID = 'ship-frame-0'
export const EXHAUST_DEFAULT_ITEM_ID = 'exhaust-0'
export const HOMING_BURST_ITEM_ID = 'tactical-quick-wit'

export const createGameSettingsDefaults = ({ pressureTestEnabled = false } = {}) => ({
  gameStarted: true,
  pressureTestEnabled,
  equippedShipItemId: SHIP_DEFAULT_ITEM_ID,
  equippedExhaustItemId: EXHAUST_DEFAULT_ITEM_ID,
  equippedTacticalItemId: null,
  musicEnabled: true,
  fpsEnabled: true,
  impactEffectsEnabled: true,
  catalogVisible: false,
  attackPower: PLAYER_STATS.attackPower,
  attackSpeed: PLAYER_STATS.attackSpeed,
  critChance: PLAYER_STATS.critChance,
  exhaustIndex: 0,
})

export const getShipThemeByItemId = (itemId) => {
  if (typeof itemId !== 'string') return SHIP_CATALOG[0]?.theme
  const serial = Number(itemId.replace('ship-frame-', ''))
  const shipEntry = SHIP_CATALOG.find((entry) => entry.serial === serial)
  return shipEntry?.theme ?? SHIP_CATALOG[0]?.theme
}

export const getExhaustIndexByItemId = (itemId, clampExhaustIndex) => {
  if (typeof itemId !== 'string') return 0
  const index = Number(itemId.replace('exhaust-', ''))
  return clampExhaustIndex(index)
}
