import { updateSnakeTimelineMotion } from './motionAlgorithms'

// 第一波：中路蛇形纵队
export const WAVE1 = {
  triggerMeter: 0,
  enemyId: 15,
  count: 28,
  route: {
    laneRatio: 0.5,
    spawnY: -80,
    scale: 0.165,
    speedY: 120,
    startDelayStep: 0.13,
    motion: {
      amplitude: 28,
      angularSpeed: 1.1,
      phase: 0,
    },
  },
}

export const spawnWave1 = ({ spawnEnemyById, stageWidth }) => {
  const laneX = stageWidth * WAVE1.route.laneRatio

  for (let i = 0; i < WAVE1.count; i += 1) {
    spawnEnemyById(WAVE1.enemyId, {
      x: laneX,
      y: WAVE1.route.spawnY,
      scale: WAVE1.route.scale,
      motion: {
        update: updateSnakeTimelineMotion,
        t: -i * WAVE1.route.startDelayStep,
        spawnY: WAVE1.route.spawnY,
        speedY: WAVE1.route.speedY,
        laneX,
        amplitude: WAVE1.route.motion.amplitude,
        angularSpeed: WAVE1.route.motion.angularSpeed,
        phase: WAVE1.route.motion.phase,
      },
    })
  }
}
