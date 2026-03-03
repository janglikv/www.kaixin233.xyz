// 第二波配置：500m 触发，敌机 #10，双队列斜向下行
export const WAVE2 = {
  triggerMeter: 500,
  enemyId: 10,
  groupSize: 15,
  scale: 0.3,
  spawnY: -100,
  speedX: 210,
  speedY: 112,
  offscreenMargin: 48,
  formation: {
    spacingX: 14,
    spacingY: 26,
    swayAmplitude: 16,
    swaySpeed: 3.4,
  },
}

// 波次敌机识别：用于主循环在越界时做统一处理
export const isWave2Enemy = (enemy) => enemy?.__motion?.waveId === 'wave2'

// 把一组敌机摆成斜向队列，并注入 diagonal 运动参数
const placeQueueGroup = ({ enemies, startX, vx }) => {
  const dir = vx > 0 ? 1 : -1
  enemies.forEach((enemy, index) => {
    const row = index
    const yOffset = row * WAVE2.formation.spacingY
    const xOffset = row * WAVE2.formation.spacingX
    enemy.visible = true
    enemy.x = startX - dir * xOffset
    enemy.y = WAVE2.spawnY - yOffset
    enemy.__motion = {
      type: 'diagonal',
      vx,
      vy: WAVE2.speedY,
      waveId: 'wave2',
      queueOriginX: enemy.x,
      swayAmplitude: WAVE2.formation.swayAmplitude,
      swaySpeed: WAVE2.formation.swaySpeed,
      swayPhase: index * 0.28,
    }
  })
}

// 把全部敌机拆成左右两路编队：
// 左队从右向左、右队从左向右
const placeDualQueues = ({ enemies, stageWidth }) => {
  const leftCount = Math.ceil(enemies.length / 2)
  const rightCount = enemies.length - leftCount
  const leftGroup = enemies.slice(0, leftCount)
  const rightGroup = enemies.slice(leftCount, leftCount + rightCount)

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

// 生成第二波：先创建全部敌机，再套双队列布局
export const spawnWave2 = ({ spawnEnemyById, stageWidth }) => {
  const enemies = []

  for (let i = 0; i < WAVE2.groupSize * 2; i += 1) {
    const enemy = spawnEnemyById(WAVE2.enemyId, {
      x: stageWidth + WAVE2.offscreenMargin,
      y: WAVE2.spawnY,
      scale: WAVE2.scale,
      motionType: 'diagonal',
      vx: -WAVE2.speedX,
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
