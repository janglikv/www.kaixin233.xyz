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
  patternIntervalSeconds: 5,
}

const runtime = {
  alive: new Set(),
  parked: new Set(),
  pendingDeploy: false,
  deployAt: 0,
}

export const resetWave2Runtime = () => {
  runtime.alive.clear()
  runtime.parked.clear()
  runtime.pendingDeploy = false
  runtime.deployAt = 0
}

export const isWave2Enemy = (enemy) => enemy?.__motion?.waveId === 'wave2'

export const onWave2EnemyDestroyed = (enemy) => {
  runtime.alive.delete(enemy)
  runtime.parked.delete(enemy)
  if (runtime.alive.size === 0) {
    runtime.pendingDeploy = false
    runtime.deployAt = 0
  }
}

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
      parked: false,
      queueOriginX: enemy.x,
      swayAmplitude: WAVE2.formation.swayAmplitude,
      swaySpeed: WAVE2.formation.swaySpeed,
      swayPhase: index * 0.28,
    }
  })
}

const placeDualQueues = ({ enemies, stageWidth }) => {
  const leftCount = Math.ceil(enemies.length / 2)
  const rightCount = enemies.length - leftCount
  const leftGroup = enemies.slice(0, leftCount) // 右->左
  const rightGroup = enemies.slice(leftCount, leftCount + rightCount) // 左->右

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

const scheduleNextPatternIfReady = (nowSeconds) => {
  if (runtime.alive.size === 0) return
  if (runtime.parked.size !== runtime.alive.size) return
  if (runtime.pendingDeploy) return

  runtime.pendingDeploy = true
  runtime.deployAt = nowSeconds + WAVE2.patternIntervalSeconds
}

const deployNextPattern = (stageWidth) => {
  if (runtime.alive.size === 0) return
  if (runtime.parked.size !== runtime.alive.size) return

  const survivors = Array.from(runtime.alive)
  placeDualQueues({
    enemies: survivors,
    stageWidth,
  })
  runtime.parked.clear()
}

export const spawnWave2 = ({ spawnEnemyById, stageWidth }) => {
  resetWave2Runtime()

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
      runtime.alive.add(enemy)
    }
  }

  placeDualQueues({
    enemies: Array.from(runtime.alive),
    stageWidth,
  })
}

export const recycleWave2Enemy = ({ enemy, stageWidth, stageHeight, nowSeconds }) => {
  if (!isWave2Enemy(enemy)) return false

  const margin = WAVE2.offscreenMargin + enemy.width
  const offLeft = enemy.x < -margin
  const offRight = enemy.x > stageWidth + margin
  const offBottom = enemy.y > stageHeight + enemy.height + WAVE2.offscreenMargin

  if (!offLeft && !offRight && !offBottom) {
    return false
  }

  enemy.visible = false
  if (enemy.__motion) {
    enemy.__motion.parked = true
  }

  runtime.parked.add(enemy)
  scheduleNextPatternIfReady(nowSeconds)
  return true
}

export const updateWave2Pattern = ({ stageWidth, nowSeconds }) => {
  if (!runtime.pendingDeploy) return
  if (nowSeconds < runtime.deployAt) return
  runtime.pendingDeploy = false
  deployNextPattern(stageWidth)
}
