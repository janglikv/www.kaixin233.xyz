import {
  WAVE1,
  spawnWave1,
} from './wave1'

export const WAVE_REGISTRY = [
  {
    config: WAVE1,
    getNextText: () => `${WAVE1.triggerMeter}m -> #${WAVE1.enemyId} x${WAVE1.count} (snake timeline)`,
    getSpawnInfo: () => `${WAVE1.triggerMeter}m:#${WAVE1.enemyId}x${WAVE1.count}(snake timeline)`,
    spawn: spawnWave1,
  },
].sort((a, b) => a.config.triggerMeter - b.config.triggerMeter)

export const getNextUntriggeredWave = (triggeredWaves) => (
  WAVE_REGISTRY.find((wave) => !triggeredWaves.has(wave)) ?? null
)

export const isRegisteredWaveEnemy = (enemy) => enemy?.__motion?.managed === true
