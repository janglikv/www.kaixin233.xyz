import { updateSnakeTimelineMotion } from './motionAlgorithms'

// 第三波：左右双蛇形纵队
export const WAVE3 = {
  triggerMeter: 900,
  enemyId: 15,
  count: 56,
  route: {
    spawnY: -80,
    scale: 0.165,
    speedY: 120,
    startDelayStep: 0.13,
    leftLaneRatio: 0.28,
    rightLaneRatio: 0.72,
    motion: {
      amplitude: 56,
      angularSpeed: 2.1,
      phase: 0,
    },
  },
}

export const spawnWave3 = ({ spawnEnemyById, stageWidth }) => {
  const leftLaneX = stageWidth * WAVE3.route.leftLaneRatio
  const rightLaneX = stageWidth * WAVE3.route.rightLaneRatio
  const leftCount = Math.ceil(WAVE3.count / 2)
  const rightCount = WAVE3.count - leftCount

  const spawnGroup = ({ laneX, groupCount }) => {
    for (let i = 0; i < groupCount; i += 1) {
      spawnEnemyById(WAVE3.enemyId, {
        x: laneX,
        y: WAVE3.route.spawnY,
        scale: WAVE3.route.scale,
        motion: {
          update: updateSnakeTimelineMotion,
          t: -i * WAVE3.route.startDelayStep,
          spawnY: WAVE3.route.spawnY,
          speedY: WAVE3.route.speedY,
          laneX,
          amplitude: WAVE3.route.motion.amplitude,
          angularSpeed: WAVE3.route.motion.angularSpeed,
          phase: WAVE3.route.motion.phase,
        },
      })
    }
  }

  spawnGroup({
    laneX: leftLaneX,
    groupCount: leftCount,
  })

  spawnGroup({
    laneX: rightLaneX,
    groupCount: rightCount,
  })
}
