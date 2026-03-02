export const WAVE1 = {
  triggerMeter: 100,
  enemyId: 15,
  count: 20,
  initialRoute: {
    laneRatio: 0.5,
    spawnY: -80,
    spacingY: 16,
    scale: 0.165,
    motion: {
      type: 'snake',
      amplitude: 128,
      angularSpeed: 3.1,
      phase: 0,
      frequency: 0.036,
      segmentOffsetStep: 0.36,
    },
  },
  recycleRoute: {
    laneRatios: [0.28, 0.72],
    phaseShift: Math.PI * 0.6,
    respawnRandomTop: 80,
  },
}

export const spawnWave1 = ({ spawnEnemyById, stageWidth }) => {
  const centerX = stageWidth * WAVE1.initialRoute.laneRatio

  for (let i = 0; i < WAVE1.count; i += 1) {
    spawnEnemyById(WAVE1.enemyId, {
      x: centerX,
      y: WAVE1.initialRoute.spawnY - i * WAVE1.initialRoute.spacingY,
      scale: WAVE1.initialRoute.scale,
      motionType: WAVE1.initialRoute.motion.type,
      laneX: centerX,
      amplitude: WAVE1.initialRoute.motion.amplitude,
      angularSpeed: WAVE1.initialRoute.motion.angularSpeed,
      phase: WAVE1.initialRoute.motion.phase,
      frequency: WAVE1.initialRoute.motion.frequency,
      segmentOffset: i * WAVE1.initialRoute.motion.segmentOffsetStep,
      recycleLaneIndex: i % WAVE1.recycleRoute.laneRatios.length,
      waveId: 'wave1',
    })
  }
}

export const recycleWave1Enemy = ({ enemy, stageWidth }) => {
  const motion = enemy.__motion
  if (!motion || motion.waveId !== 'wave1') return false

  const laneCount = WAVE1.recycleRoute.laneRatios.length
  const nextLane = ((motion.recycleLaneIndex ?? 0) + 1) % laneCount
  motion.recycleLaneIndex = nextLane
  motion.laneX = stageWidth * WAVE1.recycleRoute.laneRatios[nextLane]
  motion.phase += WAVE1.recycleRoute.phaseShift

  enemy.y = -enemy.height - Math.random() * WAVE1.recycleRoute.respawnRandomTop
  return true
}
