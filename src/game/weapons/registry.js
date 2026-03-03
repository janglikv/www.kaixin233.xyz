// 武器 ID 常量，避免在业务代码里散落字符串
export const WEAPON_IDS = {
  GUN: 'gun',
  MISSILE: 'missile',
}

// HUD 用的武器显示名
export const WEAPON_DISPLAY_NAME = {
  [WEAPON_IDS.GUN]: '主炮',
  [WEAPON_IDS.MISSILE]: '追踪导弹',
}

// 各等级发射间隔（秒）
// 数值越小，射速越快
export const FIRE_INTERVAL_BY_LEVEL = {
  1: 0.2667,
  2: 0.16,
  3: 0.1,
}

// 武器升级花费（能量豆）
export const WEAPON_UPGRADE_COST = {
  2: 10,
  3: 50,
}

// 导弹武器解锁规则：击杀指定敌机达到数量后掉落卡片
export const MISSILE_UNLOCK_RULE = {
  enemyId: 15,
  killCount: 20,
}

// 根据武器等级返回弹道横向偏移（单位：像素）
// Lv1 单发；Lv2 三发；Lv3 五发
export const getTracksByLevel = (level) => {
  if (level === 1) return [0]
  if (level === 2) return [-18, 0, 18]
  return [-30, -15, 0, 15, 30]
}
