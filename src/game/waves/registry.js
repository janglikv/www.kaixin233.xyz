import {
  WAVE1,
  isWave1Enemy,
  onWave1EnemyDestroyed,
  recycleWave1Enemy,
  resetWave1Runtime,
  spawnWave1,
  updateWave1Regroup,
} from './wave1'
import {
  WAVE2,
  isWave2Enemy,
  onWave2EnemyDestroyed,
  recycleWave2Enemy,
  resetWave2Runtime,
  spawnWave2,
  updateWave2Pattern,
} from './wave2'

export const WAVE_REGISTRY = [
  {
    id: 'wave1',
    config: WAVE1,
    getNextText: () => `${WAVE1.triggerMeter}m -> #${WAVE1.enemyId} x${WAVE1.count} (snake)`,
    getSpawnInfo: () => `${WAVE1.triggerMeter}m:#${WAVE1.enemyId}x${WAVE1.count}(snake)`,
    reset: resetWave1Runtime,
    spawn: spawnWave1,
    isEnemy: isWave1Enemy,
    onEnemyDestroyed: onWave1EnemyDestroyed,
    recycle: recycleWave1Enemy,
    update: updateWave1Regroup,
  },
  {
    id: 'wave2',
    config: WAVE2,
    getNextText: () => `${WAVE2.triggerMeter}m -> #${WAVE2.enemyId} x${WAVE2.groupSize * 2} (diag-loop)`,
    getSpawnInfo: () => `${WAVE2.triggerMeter}m:#${WAVE2.enemyId}x${WAVE2.groupSize * 2}(diag-loop)`,
    reset: resetWave2Runtime,
    spawn: spawnWave2,
    isEnemy: isWave2Enemy,
    onEnemyDestroyed: onWave2EnemyDestroyed,
    recycle: recycleWave2Enemy,
    update: updateWave2Pattern,
  },
].sort((a, b) => a.config.triggerMeter - b.config.triggerMeter)

export const getNextUntriggeredWave = (triggeredWaveIds) => (
  WAVE_REGISTRY.find((wave) => !triggeredWaveIds.has(wave.id)) ?? null
)

export const isRegisteredWaveEnemy = (enemy) => WAVE_REGISTRY.some((wave) => wave.isEnemy(enemy))
