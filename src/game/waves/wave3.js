// 第三波配置：
// - 触发时机：900m
// - 敌机类型：#15
// - 运动参数：独立配置（与第一波当前一致）
// - 队形：由“中间一组”改为“左右各一组”
export const WAVE3 = {
  triggerMeter: 900, // 到达该里程后触发第三波
  enemyId: 15, // 使用敌机雪碧图编号 #15
  count: 56, // 第三波总数（左右两组平分）
  initialRoute: {
    spawnY: -80, // 出生高度（屏幕上方）
    spacingY: 16, // 同组纵向间距
    scale: 0.165, // 敌机缩放
    leftLaneRatio: 0.28, // 左组蛇形中心线比例（0~1）
    rightLaneRatio: 0.72, // 右组蛇形中心线比例（0~1）
    motion: {
      amplitude: 56, // 蛇形振幅
      angularSpeed: 2.1, // 相位变化速度
      phase: 0, // 初始相位
      frequency: 0.066, // 频率
      segmentOffsetStep: 0.66, // 相邻敌机相位偏移步长
    },
  },
}

// 判断某敌机是否属于第三波
export const isWave3Enemy = (enemy) => String(enemy?.__motion?.waveId ?? '').startsWith('wave3-')

// 更新第三波敌机位移（蛇形下行）
// 返回 true 表示已处理该敌机本帧运动
export const updateWave3EnemyMotion = ({ enemy, deltaSeconds, moveSpeed }) => {
  if (!isWave3Enemy(enemy)) return false

  enemy.__motion.phase += enemy.__motion.angularSpeed * deltaSeconds
  const wave = enemy.y * enemy.__motion.frequency + enemy.__motion.phase - enemy.__motion.segmentOffset
  enemy.x = enemy.__motion.laneX + Math.sin(wave) * enemy.__motion.amplitude
  enemy.y += moveSpeed * deltaSeconds

  return true
}

// 生成第三波敌机：
// - 同时生成左右两组（总数等于 count）
export const spawnWave3 = ({ spawnEnemyById, stageWidth }) => {
  const leftLaneX = stageWidth * WAVE3.initialRoute.leftLaneRatio
  const rightLaneX = stageWidth * WAVE3.initialRoute.rightLaneRatio
  const leftCount = Math.ceil(WAVE3.count / 2)
  const rightCount = WAVE3.count - leftCount

  const spawnGroup = ({ laneX, groupCount, waveId }) => {
    for (let i = 0; i < groupCount; i += 1) {
      spawnEnemyById(WAVE3.enemyId, {
        x: laneX,
        y: WAVE3.initialRoute.spawnY - i * WAVE3.initialRoute.spacingY,
        scale: WAVE3.initialRoute.scale,
        motionType: 'snake',
        laneX,
        amplitude: WAVE3.initialRoute.motion.amplitude,
        angularSpeed: WAVE3.initialRoute.motion.angularSpeed,
        phase: WAVE3.initialRoute.motion.phase,
        frequency: WAVE3.initialRoute.motion.frequency,
        segmentOffset: i * WAVE3.initialRoute.motion.segmentOffsetStep,
        waveId,
      })
    }
  }

  spawnGroup({
    laneX: leftLaneX,
    groupCount: leftCount,
    waveId: 'wave3-left',
  })

  spawnGroup({
    laneX: rightLaneX,
    groupCount: rightCount,
    waveId: 'wave3-right',
  })
}
