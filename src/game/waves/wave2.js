import { updateTurnbackTimelineMotion } from './motionAlgorithms'

// 第二波：左右双列，共用“先向中线收拢再折返”的时间线算法
export const WAVE2 = {
  triggerMeter: 500,
  enemyId: 15,
  countPerGroup: 30,
  route: {
    spawnY: -80,
    scale: 0.165,
    speedY: 170,
    xPerY: 1.2,
    centerOffset: 12,
  },
  formation: {
    spacingY: 44,
  },
}

const spawnGroup = ({ spawnEnemyById, stageWidth, direction }) => {
  const startX = direction > 0 ? 0 : stageWidth
  const centerX = stageWidth * 0.5 + direction * WAVE2.route.centerOffset
  const startDelayStep = WAVE2.formation.spacingY / WAVE2.route.speedY

  for (let i = 0; i < WAVE2.countPerGroup; i += 1) {
    spawnEnemyById(WAVE2.enemyId, {
      x: startX,
      y: WAVE2.route.spawnY,
      scale: WAVE2.route.scale,
      motion: {
        update: updateTurnbackTimelineMotion,
        t: -i * startDelayStep,
        spawnY: WAVE2.route.spawnY,
        speedY: WAVE2.route.speedY,
        xPerY: WAVE2.route.xPerY,
        baseX: startX,
        centerX,
        direction,
      },
    })
  }
}

export const spawnWave2 = ({ spawnEnemyById, stageWidth }) => {
  spawnGroup({ spawnEnemyById, stageWidth, direction: 1 })
  spawnGroup({ spawnEnemyById, stageWidth, direction: -1 })
}
