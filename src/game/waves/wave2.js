// 第二波拆分为两个组（同里程同时触发）：
// - wave2-left：左组 30 架，向右收拢到中线
// - wave2-right：右组 30 架，向左收拢到中线
// x 由 getWave2XFromY() 按 y 位置推导

const WAVE2_BASE = {
  triggerMeter: 500, // 到达该里程触发第二波
  enemyId: 15, // 使用敌机雪碧图编号 #15
  countPerGroup: 30, // 每组数量
  spawnY: -80, // 出生高度
  scale: 0.165, // 敌机缩放
  route: {
    vy: 170, // 纵向速度（像素/秒）
  },
  formation: {
    spacingX: 0, // 基础版：同组保持同一列
    spacingY: 44, // 同一路队列的垂直间距
  },
}

export const WAVE2_LEFT = {
  ...WAVE2_BASE,
  id: 'wave2-left',
  lanes: {
    startRatio: 0,
  },
}

export const WAVE2_RIGHT = {
  ...WAVE2_BASE,
  id: 'wave2-right',
  lanes: {
    startRatio: 1,
  },
}

// 判断某敌机是否属于第二波（任意组）
export const isWave2Enemy = (enemy) => String(enemy?.__motion?.waveId ?? '').startsWith('wave2-')
export const isWave2LeftEnemy = (enemy) => enemy?.__motion?.waveId === WAVE2_LEFT.id
export const isWave2RightEnemy = (enemy) => enemy?.__motion?.waveId === WAVE2_RIGHT.id

const quadraticBezier = (p0, p1, p2, t) => (
  (1 - t) * (1 - t) * p0
  + 2 * (1 - t) * t * p1
  + t * t * p2
)

const getTurnedXByTravel = ({ baseX, centerX, travelX, direction }) => {
  const toCenter = Math.max(0, (centerX - baseX) * direction)
  const blendHalfWidth = Math.min(90, Math.max(24, toCenter * 0.35))
  const blendStart = Math.max(0, toCenter - blendHalfWidth)
  const blendEnd = toCenter + blendHalfWidth

  if (travelX <= blendStart) return baseX + direction * travelX
  if (travelX >= blendEnd) return centerX - direction * (travelX - toCenter)

  // 在折返点附近用二次贝塞尔平滑连接“入弯线段”和“出弯线段”
  const t = (travelX - blendStart) / Math.max(1e-6, blendEnd - blendStart)
  const p0 = centerX - direction * blendHalfWidth
  const p1 = centerX
  const p2 = centerX - direction * blendHalfWidth
  return quadraticBezier(p0, p1, p2, t)
}

// 左组：随 y 增大先向右收拢，触达中线后折返向左
export const getWave2LeftXFromY = ({ y, baseX, centerX }) => {
  const adjustedCenterX = centerX + 12
  const yProgress = Math.max(0, y - WAVE2_BASE.spawnY)
  const xPerY = 1.2 // 每下落 1px 在 x 方向推进的像素
  const travelX = yProgress * xPerY
  return getTurnedXByTravel({
    baseX,
    centerX: adjustedCenterX,
    travelX,
    direction: 1,
  })
}

// 右组：随 y 增大先向左收拢，触达中线后折返向右
export const getWave2RightXFromY = ({ y, baseX, centerX }) => {
  const adjustedCenterX = centerX - 12
  const yProgress = Math.max(0, y - WAVE2_BASE.spawnY)
  const xPerY = 1.2 // 每下落 1px 在 x 方向推进的像素
  const travelX = yProgress * xPerY
  return getTurnedXByTravel({
    baseX,
    centerX: adjustedCenterX,
    travelX,
    direction: -1,
  })
}

// 根据 y 反推该敌机在当前帧的 x（按组分发）
export const getWave2XFromY = ({ y, baseX, centerX, waveId }) => {
  if (waveId === WAVE2_LEFT.id) return getWave2LeftXFromY({ y, baseX, centerX })
  if (waveId === WAVE2_RIGHT.id) return getWave2RightXFromY({ y, baseX, centerX })
  return baseX
}

// 更新第二波敌机位移（双路直线下落）
// 返回 true 表示已处理该敌机本帧运动
export const updateWave2EnemyMotion = ({ enemy, deltaSeconds }) => {
  if (!isWave2Enemy(enemy)) return false

  const nextY = enemy.y + enemy.__motion.vy * deltaSeconds
  enemy.x = getWave2XFromY({
    y: nextY,
    baseX: enemy.__motion.baseX,
    centerX: enemy.__motion.centerX,
    waveId: enemy.__motion.waveId,
  })
  enemy.y = nextY

  return true
}

const spawnWave2Group = ({
  wave,
  spawnEnemyById,
  stageWidth,
  xOffsetDir,
}) => {
  const startX = stageWidth * wave.lanes.startRatio
  const centerX = stageWidth * 0.5

  for (let i = 0; i < wave.countPerGroup; i += 1) {
    const xOffset = i * wave.formation.spacingX
    const yOffset = i * wave.formation.spacingY
    const spawnX = startX + xOffsetDir * xOffset
    spawnEnemyById(wave.enemyId, {
      x: spawnX,
      y: wave.spawnY - yOffset,
      scale: wave.scale,
      motionType: 'diagonal',
      vx: 0,
      vy: wave.route.vy,
      baseX: spawnX,
      centerX,
      waveId: wave.id,
    })
  }
}

export const spawnWave2Left = ({ spawnEnemyById, stageWidth }) => {
  spawnWave2Group({
    wave: WAVE2_LEFT,
    spawnEnemyById,
    stageWidth,
    xOffsetDir: 1,
  })
}

export const spawnWave2Right = ({ spawnEnemyById, stageWidth }) => {
  spawnWave2Group({
    wave: WAVE2_RIGHT,
    spawnEnemyById,
    stageWidth,
    xOffsetDir: -1,
  })
}
