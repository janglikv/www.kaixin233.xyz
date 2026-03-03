// 第二波配置：
// - 触发时机：500m
// - 敌机类型：#10
// - 编队：两组队列（总计 30 架）
// - 运动：斜向下行 + 小幅横向摆动
export const WAVE2 = {
  triggerMeter: 500, // 到达该里程后触发
  enemyId: 10, // 使用敌机 #10
  groupSize: 15, // 每组数量（两组共 30）
  scale: 0.3, // 敌机缩放
  spawnY: -100, // 出生基准 y（屏幕上方）
  speedX: 210, // 横向速度（像素/秒）
  speedY: 112, // 纵向速度（像素/秒）
  offscreenMargin: 48, // 队列起始放在屏幕外的边距
  formation: {
    spacingX: 14, // 队列沿 x 方向间距
    spacingY: 26, // 队列沿 y 方向间距
    swayAmplitude: 16, // 横向摆动振幅
    swaySpeed: 3.4, // 横向摆动速度
  },
}

// 波次敌机识别：
// 主循环据此判断“属于第二波”的敌机，从而套用波次清理策略
export const isWave2Enemy = (enemy) => enemy?.__motion?.waveId === 'wave2'

// 布置单组队列，并写入 diagonal 运动参数
// 参数说明：
// - startX: 该组从哪侧开始进入屏幕
// - vx: 该组横向运动方向与速度
const placeQueueGroup = ({ enemies, startX, vx }) => {
  const dir = vx > 0 ? 1 : -1 // 编队方向（向右 1，向左 -1）
  enemies.forEach((enemy, index) => {
    const row = index // 当前敌机在队列中的行号
    const yOffset = row * WAVE2.formation.spacingY // 行间垂直偏移
    const xOffset = row * WAVE2.formation.spacingX // 行间水平偏移
    enemy.visible = true
    enemy.x = startX - dir * xOffset // 沿方向逐行错位，形成“斜列”
    enemy.y = WAVE2.spawnY - yOffset // 纵向逐行排开
    enemy.__motion = {
      type: 'diagonal', // 主循环按 diagonal 分支更新
      vx, // 基础横向速度
      vy: WAVE2.speedY, // 基础纵向速度
      waveId: 'wave2', // 波次归属标记
      queueOriginX: enemy.x, // 队列基准 x（用于叠加横向摆动）
      swayAmplitude: WAVE2.formation.swayAmplitude, // 摆动振幅
      swaySpeed: WAVE2.formation.swaySpeed, // 摆动速度
      swayPhase: index * 0.28, // 按序号错开相位，避免全体同相
    }
  })
}

// 把全部敌机拆成左右两路编队：
// 左队从右向左、右队从左向右
const placeDualQueues = ({ enemies, stageWidth }) => {
  const leftCount = Math.ceil(enemies.length / 2) // 左队数量（向左飞）
  const rightCount = enemies.length - leftCount // 右队数量（向右飞）
  const leftGroup = enemies.slice(0, leftCount) // 从右到左
  const rightGroup = enemies.slice(leftCount, leftCount + rightCount) // 从左到右

  placeQueueGroup({
    enemies: leftGroup,
    startX: stageWidth + WAVE2.offscreenMargin,
    vx: -WAVE2.speedX,
  })
  placeQueueGroup({
    enemies: rightGroup,
    startX: -WAVE2.offscreenMargin,
    vx: WAVE2.speedX,
  })
}

// 生成第二波：
// 1) 批量创建敌机对象
// 2) 统一套用双队列排阵
export const spawnWave2 = ({ spawnEnemyById, stageWidth }) => {
  const enemies = [] // 暂存成功生成的敌机，后续统一排阵

  for (let i = 0; i < WAVE2.groupSize * 2; i += 1) {
    const enemy = spawnEnemyById(WAVE2.enemyId, {
      x: stageWidth + WAVE2.offscreenMargin,
      y: WAVE2.spawnY,
      scale: WAVE2.scale,
      motionType: 'diagonal',
      vx: -WAVE2.speedX, // 先给默认值，排阵后会按组重置
      vy: WAVE2.speedY,
      waveId: 'wave2',
    })

    if (enemy) {
      enemies.push(enemy)
    }
  }

  placeDualQueues({
    enemies,
    stageWidth,
  })
}
