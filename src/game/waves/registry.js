import {
  WAVE1,
  spawnWave1,
} from './wave1'
import {
  WAVE2,
  spawnWave2,
} from './wave2'
import {
  WAVE3,
  spawnWave3,
} from './wave3'

export const WAVE_REGISTRY = [
  {
    config: WAVE1,
    getNextText: () => `${WAVE1.triggerMeter}m -> #${WAVE1.enemyId} x${WAVE1.count} (snake timeline)`,
    getSpawnInfo: () => `${WAVE1.triggerMeter}m:#${WAVE1.enemyId}x${WAVE1.count}(snake timeline)`,
    spawn: spawnWave1,
  },
  {
    config: WAVE2,
    getNextText: () => `${WAVE2.triggerMeter}m -> #${WAVE2.enemyId} x${WAVE2.countPerGroup * 2} (turnback timeline)`,
    getSpawnInfo: () => `${WAVE2.triggerMeter}m:#${WAVE2.enemyId}x${WAVE2.countPerGroup * 2}(turnback timeline)`,
    spawn: spawnWave2,
  },
  {
    config: WAVE3,
    getNextText: () => `${WAVE3.triggerMeter}m -> #${WAVE3.enemyId} x${WAVE3.count} (double snake timeline)`,
    getSpawnInfo: () => `${WAVE3.triggerMeter}m:#${WAVE3.enemyId}x${WAVE3.count}(double snake timeline)`,
    spawn: spawnWave3,
  },
].sort((a, b) => a.config.triggerMeter - b.config.triggerMeter)

export const getNextUntriggeredWave = (triggeredWaves) => (
  WAVE_REGISTRY.find((wave) => !triggeredWaves.has(wave)) ?? null
)

export const isRegisteredWaveEnemy = (enemy) => enemy?.__motion?.managed === true
