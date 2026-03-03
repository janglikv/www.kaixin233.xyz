export const WEAPON_IDS = {
  GUN: 'gun',
  MISSILE: 'missile',
}

export const WEAPON_DISPLAY_NAME = {
  [WEAPON_IDS.GUN]: '主炮',
  [WEAPON_IDS.MISSILE]: '追踪导弹',
}

export const FIRE_INTERVAL_BY_LEVEL = {
  1: 0.2667,
  2: 0.16,
  3: 0.1,
}

export const WEAPON_UPGRADE_COST = {
  2: 10,
  3: 50,
}

export const MISSILE_UNLOCK_RULE = {
  enemyId: 15,
  killCount: 20,
}

export const getTracksByLevel = (level) => {
  if (level === 1) return [0]
  if (level === 2) return [-18, 0, 18]
  return [-30, -15, 0, 15, 30]
}
