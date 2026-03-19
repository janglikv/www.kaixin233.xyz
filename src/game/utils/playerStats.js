const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export const PLAYER_STATS = {
  attackPower: 1,
  attackSpeed: 2,
  critChance: 1,
}

export const clampAttackPower = (value) => clamp(Math.round(value), 1, 999)

export const clampAttackSpeed = (value) => Math.max(1, Math.round(value * 10) / 10)

export const clampCritChance = (value) => clamp(Math.round(value * 100) / 100, 0, 1)

export const parseAttackSpeedInput = (value) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : value
  if (normalizedValue === '') return null

  const nextValue = Number(normalizedValue)
  if (!Number.isFinite(nextValue)) return null

  return clampAttackSpeed(nextValue)
}

export const parseAttackPowerInput = (value) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : value
  if (normalizedValue === '') return null

  const nextValue = Number(normalizedValue)
  if (!Number.isFinite(nextValue)) return null

  return clampAttackPower(nextValue)
}

export const parseCritChanceInput = (value) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : value
  if (normalizedValue === '') return null

  const nextValue = Number(normalizedValue)
  if (!Number.isFinite(nextValue)) return null

  return clampCritChance(nextValue > 1 ? nextValue / 100 : nextValue)
}
