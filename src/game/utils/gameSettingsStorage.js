const LEGACY_STORAGE_KEY = 'kaixin233-game-settings'
const STORAGE_KEY_PREFIX = 'kaixin233-game-setting'
const STORAGE_KEYS = {
  gameStarted: `${STORAGE_KEY_PREFIX}:gameStarted`,
  pressureTestEnabled: `${STORAGE_KEY_PREFIX}:pressureTestEnabled`,
  equippedShipItemId: `${STORAGE_KEY_PREFIX}:equippedShipItemId`,
  equippedExhaustItemId: `${STORAGE_KEY_PREFIX}:equippedExhaustItemId`,
  equippedTacticalItemId: `${STORAGE_KEY_PREFIX}:equippedTacticalItemId`,
  musicEnabled: `${STORAGE_KEY_PREFIX}:musicEnabled`,
  fpsEnabled: `${STORAGE_KEY_PREFIX}:fpsEnabled`,
  impactEffectsEnabled: `${STORAGE_KEY_PREFIX}:impactEffectsEnabled`,
  catalogVisible: `${STORAGE_KEY_PREFIX}:catalogVisible`,
  catalogPreviewCode: `${STORAGE_KEY_PREFIX}:catalogPreviewCode`,
  attackPower: `${STORAGE_KEY_PREFIX}:attackPower`,
  attackSpeed: `${STORAGE_KEY_PREFIX}:attackSpeed`,
  critChance: `${STORAGE_KEY_PREFIX}:critChance`,
  exhaustIndex: `${STORAGE_KEY_PREFIX}:exhaustIndex`,
}

const readLegacySettings = () => {
  const rawValue = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!rawValue) return {}

  try {
    const parsed = JSON.parse(rawValue)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const parseStoredValue = (rawValue) => {
  if (rawValue == null) return undefined

  try {
    return JSON.parse(rawValue)
  } catch {
    return undefined
  }
}

const readStoredGameSettings = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {}
  }

  const legacySettings = readLegacySettings()
  const storedSettings = {}

  Object.entries(STORAGE_KEYS).forEach(([settingKey, storageKey]) => {
    const rawValue = window.localStorage.getItem(storageKey)
    const parsedValue = parseStoredValue(rawValue)
    if (parsedValue !== undefined) {
      storedSettings[settingKey] = parsedValue
      return
    }

    if (legacySettings[settingKey] !== undefined) {
      storedSettings[settingKey] = legacySettings[settingKey]
    }
  })

  return storedSettings
}

const dispatchSettingsChanged = () => {
  window.dispatchEvent(
    new CustomEvent('game-settings-changed', {
      detail: readStoredGameSettings(),
    }),
  )
}

export const loadGameSettings = (fallbackSettings = {}) => {
  const storedSettings = readStoredGameSettings()

  if (!fallbackSettings || typeof fallbackSettings !== 'object') {
    return storedSettings
  }

  return {
    ...fallbackSettings,
    ...storedSettings,
  }
}

export const saveGameSettings = (settings) => {
  if (
    typeof window === 'undefined' ||
    !window.localStorage ||
    !settings ||
    typeof settings !== 'object'
  ) {
    return
  }

  try {
    Object.entries(settings).forEach(([settingKey, value]) => {
      const storageKey = STORAGE_KEYS[settingKey]
      if (!storageKey) return

      if (value === undefined) {
        window.localStorage.removeItem(storageKey)
        return
      }

      window.localStorage.setItem(storageKey, JSON.stringify(value))
    })
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    dispatchSettingsChanged()
  } catch {
    // Ignore write failures and keep the game playable.
  }
}

export const clearGameSettings = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    Object.values(STORAGE_KEYS).forEach((storageKey) => {
      window.localStorage.removeItem(storageKey)
    })
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    dispatchSettingsChanged()
  } catch {
    // Ignore write failures and keep the game playable.
  }
}
