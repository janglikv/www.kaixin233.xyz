import { updateSnakeTimelineMotion } from './motionAlgorithms'

// 第一波：中路蛇形纵队
export const WAVE1 = {
  triggerMeter: 0,
  enemyId: 15,
  count: 6,
}

const WAVE1_SPAWN_CONFIG = {
  laneRatio: 0.5,
  spawnY: -80,
  scale: 0.165,
  startDelayStep: 1,
}

export const spawnWave1 = ({ spawnEnemyById, stageWidth }) => {
  const laneX = stageWidth * WAVE1_SPAWN_CONFIG.laneRatio

  for (let i = 0; i < WAVE1.count; i += 1) {
    spawnEnemyById(WAVE1.enemyId, {
      x: laneX,
      y: WAVE1_SPAWN_CONFIG.spawnY,
      scale: WAVE1_SPAWN_CONFIG.scale,
      motion: {
        update: updateSnakeTimelineMotion,
        t: -i * WAVE1_SPAWN_CONFIG.startDelayStep,
      },
    })
  }
}
