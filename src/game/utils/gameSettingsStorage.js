const STORAGE_KEY = 'kaixin233-game-settings'

export const loadGameSettings = (fallbackSettings) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...fallbackSettings }
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    if (!rawValue) {
      return { ...fallbackSettings }
    }

    const parsed = JSON.parse(rawValue)
    if (!parsed || typeof parsed !== 'object') {
      return { ...fallbackSettings }
    }

    return {
      ...fallbackSettings,
      ...parsed,
    }
  } catch {
    return { ...fallbackSettings }
  }
}

export const saveGameSettings = (settings) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    window.dispatchEvent(
      new CustomEvent('game-settings-changed', {
        detail: settings,
      }),
    )
  } catch {
    // Ignore write failures and keep the game playable.
  }
}

export const clearGameSettings = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(
      new CustomEvent('game-settings-changed', {
        detail: {},
      }),
    )
  } catch {
    // Ignore write failures and keep the game playable.
  }
}
