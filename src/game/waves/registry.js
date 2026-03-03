import {
  WAVE1,
  isWave1Enemy,
  spawnWave1,
} from './wave1'
import {
  WAVE2,
  isWave2Enemy,
  spawnWave2,
} from './wave2'

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
    id: 'wave2',
    config: WAVE2,
    getNextText: () => `${WAVE2.triggerMeter}m -> #${WAVE2.enemyId} x${WAVE2.count} (x-diagonal)`,
    getSpawnInfo: () => `${WAVE2.triggerMeter}m:#${WAVE2.enemyId}x${WAVE2.count}(x-diagonal)`,
    spawn: spawnWave2,
    isEnemy: isWave2Enemy,
  },
].sort((a, b) => a.config.triggerMeter - b.config.triggerMeter)

// 根据已触发波次集合，返回下一波（用于 HUD 和 / 跳关键）
export const getNextUntriggeredWave = (triggeredWaveIds) => (
  WAVE_REGISTRY.find((wave) => !triggeredWaveIds.has(wave.id)) ?? null
)

// 判断敌机是否属于注册波次（用于越界清理策略）
export const isRegisteredWaveEnemy = (enemy) => WAVE_REGISTRY.some((wave) => wave.isEnemy(enemy))
