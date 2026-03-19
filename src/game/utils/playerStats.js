const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export const PLAYER_STATS = {
  attackPower: 1,
  attackSpeed: 2,
  critChance: 1,
}

export const clampAttackPower = (value) => clamp(Math.round(value), 1, 999)

export const clampAttackSpeed = (value) => Math.max(1, Math.round(value * 10) / 10)

export const clampCritChance = (value) => clamp(Math.round(value * 100) / 100, 0, 1)
