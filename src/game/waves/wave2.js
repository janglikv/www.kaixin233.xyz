import { WAVE1 } from './wave1'

// 第二波配置：
// - 触发时机：500m
// - 敌机类型：#15（与第一波一致）
// - 尺寸/间距：沿用第一波（scale 与 spacingY）
// - 路线：左右两路斜向直线下行，交叉成 X 路径
export const WAVE2 = {
  triggerMeter: 500, // 到达该里程触发第二波
  enemyId: WAVE1.enemyId, // 与第一波同款敌机
  count: WAVE1.count, // 总量与第一波一致
  spawnY: WAVE1.initialRoute.spawnY, // 出生高度沿用第一波
  spacingY: WAVE1.initialRoute.spacingY, // 敌机纵向间隔沿用第一波
  scale: WAVE1.initialRoute.scale, // 敌机缩放沿用第一波
  lanes: {
    leftStartRatio: 0.22, // 左路起点 x 比例
    rightStartRatio: 0.78, // 右路起点 x 比例
  },
  diagonal: {
    vx: 120, // 水平速度（像素/秒）
    vy: 120, // 垂直速度（像素/秒）
    swayAmplitude: 0, // 设为 0，保证直线轨迹
    swaySpeed: 0,
  },
  formation: {
    spacingX: 34, // 同一路队列的水平错位间距（更明显的斜列）
    spacingY: 44, // 同一路队列的垂直间距（明显拉开）
  },
}

// 判断某敌机是否属于第二波
export const isWave2Enemy = (enemy) => enemy?.__motion?.waveId === 'wave2'

// 生成第二波：
// 1) 按总数一分为二（左右两路）
// 2) 左路从左上往右下，右路从右上往左下
// 3) 两路会在屏幕中部附近交叉，形成 X 形
export const spawnWave2 = ({ spawnEnemyById, stageWidth }) => {
  const leftCount = Math.ceil(WAVE2.count / 2)
  const rightCount = WAVE2.count - leftCount

  const leftStartX = stageWidth * WAVE2.lanes.leftStartRatio
  const rightStartX = stageWidth * WAVE2.lanes.rightStartRatio

  const spawnLane = ({ count, startX, vx }) => {
    const dir = vx >= 0 ? 1 : -1
    for (let i = 0; i < count; i += 1) {
      const xOffset = i * WAVE2.formation.spacingX
      const yOffset = i * WAVE2.formation.spacingY
      const spawnX = startX - dir * xOffset
      spawnEnemyById(WAVE2.enemyId, {
        x: spawnX,
        y: WAVE2.spawnY - yOffset,
        scale: WAVE2.scale,
        motionType: 'diagonal',
        vx,
        vy: WAVE2.diagonal.vy,
        queueOriginX: spawnX, // 关键：每个敌机保留自己的 x 基线，避免下一帧被拉回同列
        swayAmplitude: WAVE2.diagonal.swayAmplitude,
        swaySpeed: WAVE2.diagonal.swaySpeed,
        swayPhase: 0,
        waveId: 'wave2',
      })
    }
  }

  spawnLane({
    count: leftCount,
    startX: leftStartX,
    vx: WAVE2.diagonal.vx,
  })

  spawnLane({
    count: rightCount,
    startX: rightStartX,
    vx: -WAVE2.diagonal.vx,
  })
}
