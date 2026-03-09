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
  1: 1, // Lv1：1 发/秒
  2: 0.5, // Lv2：2 发/秒
  3: 0.25, // Lv3：4 发/秒
}

// 武器升级花费（能量豆）
export const WEAPON_UPGRADE_COST = {
  1: 20, // Lv1 -> Lv2 消耗
  2: 50, // Lv2 -> Lv3 消耗
  3: 200, // Lv3 -> Lv4 消耗（当前版本未启用）
}

// 导弹武器解锁规则：击杀指定敌机达到数量后掉落卡片
export const MISSILE_UNLOCK_RULE = {
  enemyId: 15, // 计数目标敌机 ID
  killCount: 20, // 累计击杀达标阈值
}
