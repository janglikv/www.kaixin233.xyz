import {
  WAVE1,
  isWave1Enemy,
  spawnWave1,
} from './wave1'
import {
  WAVE2_LEFT,
  WAVE2_RIGHT,
  isWave2LeftEnemy,
  isWave2RightEnemy,
  spawnWave2Left,
  spawnWave2Right,
} from './wave2'
import {
  WAVE3,
  isWave3Enemy,
  spawnWave3,
} from './wave3'

// 波次注册表：主控制器只依赖这个表，不直接耦合具体 wave 文件
// 新增第三波/第四波时，按同结构追加一项即可
export const WAVE_REGISTRY = [
  {
    id: 'wave1',
    config: WAVE1,
    getNextText: () => `${WAVE1.triggerMeter}m -> #${WAVE1.enemyId} x${WAVE1.count} (snake)`,
    getSpawnInfo: () => `${WAVE1.triggerMeter}m:#${WAVE1.enemyId}x${WAVE1.count}(snake)`,
    spawn: spawnWave1,
    isEnemy: isWave1Enemy,
  },
  {
    id: WAVE2_LEFT.id,
    config: WAVE2_LEFT,
    getNextText: () => `${WAVE2_LEFT.triggerMeter}m -> #${WAVE2_LEFT.enemyId} x${WAVE2_LEFT.countPerGroup} (down left-group)`,
    getSpawnInfo: () => `${WAVE2_LEFT.triggerMeter}m:#${WAVE2_LEFT.enemyId}x${WAVE2_LEFT.countPerGroup}(down left-group)`,
    spawn: spawnWave2Left,
    isEnemy: isWave2LeftEnemy,
  },
  {
    id: WAVE2_RIGHT.id,
    config: WAVE2_RIGHT,
    getNextText: () => `${WAVE2_RIGHT.triggerMeter}m -> #${WAVE2_RIGHT.enemyId} x${WAVE2_RIGHT.countPerGroup} (down right-group)`,
    getSpawnInfo: () => `${WAVE2_RIGHT.triggerMeter}m:#${WAVE2_RIGHT.enemyId}x${WAVE2_RIGHT.countPerGroup}(down right-group)`,
    spawn: spawnWave2Right,
    isEnemy: isWave2RightEnemy,
  },
  {
    id: 'wave3',
    config: WAVE3,
    getNextText: () => `${WAVE3.triggerMeter}m -> #${WAVE3.enemyId} x${WAVE3.count} (snake left+right)`,
    getSpawnInfo: () => `${WAVE3.triggerMeter}m:#${WAVE3.enemyId}x${WAVE3.count}(snake left+right)`,
    spawn: spawnWave3,
    isEnemy: isWave3Enemy,
  },
].sort((a, b) => a.config.triggerMeter - b.config.triggerMeter)

// 根据已触发波次集合，返回下一波（用于 HUD 和 / 跳关键）
export const getNextUntriggeredWave = (triggeredWaveIds) => (
  WAVE_REGISTRY.find((wave) => !triggeredWaveIds.has(wave.id)) ?? null
)

// 判断敌机是否属于注册波次（用于越界清理策略）
export const isRegisteredWaveEnemy = (enemy) => WAVE_REGISTRY.some((wave) => wave.isEnemy(enemy))
