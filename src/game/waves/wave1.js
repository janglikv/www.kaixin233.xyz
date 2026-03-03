// 第一波配置：100m 触发，敌机 #15，一次性 20 架蛇形下行
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
}

// 生成第一波敌机：从中路纵向列队，按蛇形参数运动
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
      waveId: 'wave1',
    })
  }
}

// 波次敌机识别函数：统一靠 motion.waveId 判断归属
export const isWave1Enemy = (enemy) => enemy?.__motion?.waveId === 'wave1'
