import { updateSnakeTimelineMotion } from './motionAlgorithms'

// 第一波：中路蛇形纵队
export const WAVE1 = {
  triggerMeter: 0, // 触发里程（米）
  enemyId: 15, // 敌机图鉴 ID（对应雪碧图切片）
  count: 18, // 本波敌机数量
  route: {
    laneRatio: 0.5, // 轨道中心线 x 比例（0~1）
    spawnY: -80, // 出生 y（屏幕上方）
    scale: 0.165, // 敌机缩放
    speedY: 120, // 纵向下落速度（px/s）
    startDelayStep: 0.23, // 相邻敌机出发时间差（秒）
    motion: {
      amplitude: 38, // 蛇形横向振幅（px）
      angularSpeed: 3.8, // 蛇形角速度（rad/s）
      phase: 0, // 初始相位（rad）
    },
  },
}

export const spawnWave1 = ({ spawnEnemyById, stageWidth }) => {
  const laneX = stageWidth * WAVE1.route.laneRatio

  for (let i = 0; i < WAVE1.count; i += 1) {
    spawnEnemyById(WAVE1.enemyId, {
      x: laneX,
      y: WAVE1.route.spawnY,
      scale: WAVE1.route.scale,
      motion: {
        update: updateSnakeTimelineMotion,
        t: -i * WAVE1.route.startDelayStep,
        spawnY: WAVE1.route.spawnY,
        speedY: WAVE1.route.speedY,
        laneX,
        amplitude: WAVE1.route.motion.amplitude,
        angularSpeed: WAVE1.route.motion.angularSpeed,
        phase: WAVE1.route.motion.phase,
      },
    })
  }
}
