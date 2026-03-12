import { updateAssaultMotion } from './motionAlgorithms'

// 第一波：中路纵队，缓慢推进到射程后停下开火
export const WAVE1 = {
  triggerMeter: 0,
  enemyId: 15,
  count: 6,
}

const WAVE1_SPAWN_CONFIG = {
  laneRatio: 0.5,
  spawnY: -80,
  scale: 0.165,
  spacingY: 54,
  enterDelayStep: 0.28,
}

export const spawnWave1 = ({ spawnEnemyById, stageWidth }) => {
  const laneX = stageWidth * WAVE1_SPAWN_CONFIG.laneRatio

  for (let i = 0; i < WAVE1.count; i += 1) {
    spawnEnemyById(WAVE1.enemyId, {
      x: laneX,
      y: WAVE1_SPAWN_CONFIG.spawnY - i * WAVE1_SPAWN_CONFIG.spacingY,
      scale: WAVE1_SPAWN_CONFIG.scale,
      motion: {
        update: updateAssaultMotion,
        enterDelay: i * WAVE1_SPAWN_CONFIG.enterDelayStep,
        moveSpeed: 88,
        attackRange: 360,
        holdRadius: 32,
        fireCooldown: 1.45,
        bulletSpeed: 300,
        initialShotDelay: 0.35 + i * 0.05,
        stopOffsetY: -150,
        formationIndex: i,
        formationSize: WAVE1.count,
        formationSpacingX: 58,
        formationRowGap: 52,
        sideBias: i % 2 === 0 ? -1 : 1,
      },
    })
  }
}
