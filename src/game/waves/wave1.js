// 第一波配置：
// - 触发时机：100m
// - 敌机类型：#15
// - 出场数量：20
// - 行为：一次性中路纵队，蛇形下行，不重复回场
export const WAVE1 = {
  triggerMeter: 100, // 到达该里程后触发本波
  enemyId: 15, // 使用敌机雪碧图编号 #15
  count: 28, // 本波总敌机数量
  initialRoute: {
    laneRatio: 0.5, // 出生车道比例（0~1，0.5 表示屏幕中线）
    spawnY: -80, // 第一架的初始 Y（在屏幕上方）
    spacingY: 16, // 纵向间隔（值越大，队伍越“长”）
    scale: 0.165, // 敌机缩放
    motion: {
      type: 'snake', // 运动类型：蛇形
      amplitude: 28, // 蛇形左右摆动振幅（像素）
      angularSpeed: 1.1, // 相位变化速度（越大摆动越快）
      phase: 0, // 初始相位
      frequency: 0.066, // y 到波形的频率映射（影响蛇形“密度”）
      segmentOffsetStep: 0.36, // 相邻敌机的相位偏移步长（形成队列层次）
    },
  },
}

// 生成第一波敌机：
// 1) 计算中路 x 坐标
// 2) 按 count 循环生成
// 3) 每架敌机附带 snake 运动参数
export const spawnWave1 = ({ spawnEnemyById, stageWidth }) => {
  const centerX = stageWidth * WAVE1.initialRoute.laneRatio // 中路编队的绝对 X 坐标

  for (let i = 0; i < WAVE1.count; i += 1) {
    spawnEnemyById(WAVE1.enemyId, {
      x: centerX, // 全部从中线出生
      y: WAVE1.initialRoute.spawnY - i * WAVE1.initialRoute.spacingY, // 按索引向上排布形成纵队
      scale: WAVE1.initialRoute.scale, // 第一波缩放比
      motionType: WAVE1.initialRoute.motion.type, // snake
      laneX: centerX, // 蛇形中心线
      amplitude: WAVE1.initialRoute.motion.amplitude, // 蛇形振幅
      angularSpeed: WAVE1.initialRoute.motion.angularSpeed, // 蛇形角速度
      phase: WAVE1.initialRoute.motion.phase, // 初始相位
      frequency: WAVE1.initialRoute.motion.frequency, // 频率
      segmentOffset: i * WAVE1.initialRoute.motion.segmentOffsetStep, // 队列分段偏移
      waveId: 'wave1', // 波次标识（供主循环识别）
    })
  }
}

// 更新第一波敌机位移（蛇形下行）
// 返回 true 表示已处理该敌机本帧运动
export const updateWave1EnemyMotion = ({ enemy, deltaSeconds, moveSpeed }) => {
  if (!isWave1Enemy(enemy)) return false

  enemy.__motion.phase += enemy.__motion.angularSpeed * deltaSeconds
  const wave = enemy.y * enemy.__motion.frequency + enemy.__motion.phase - enemy.__motion.segmentOffset
  enemy.x = enemy.__motion.laneX + Math.sin(wave) * enemy.__motion.amplitude
  enemy.y += moveSpeed * deltaSeconds

  return true
}

// 判断某敌机是否属于第一波
// 主循环用这个标识决定越界清理策略
export const isWave1Enemy = (enemy) => enemy?.__motion?.waveId === 'wave1'
