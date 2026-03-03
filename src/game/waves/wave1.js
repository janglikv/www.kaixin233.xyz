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

const runtime = {
  alive: new Set(),
  parked: new Set(),
  nextPattern: 'sides', // 初始中间已出场，下一轮先双侧
  pendingRegroup: false,
  regroupAt: 0,
  regroupDelaySeconds: 5,
}

export const resetWave1Runtime = () => {
  runtime.alive.clear()
  runtime.parked.clear()
  runtime.nextPattern = 'sides'
  runtime.pendingRegroup = false
  runtime.regroupAt = 0
  runtime.regroupDelaySeconds = 5
}

const applySnakeMotion = (enemy, laneX, orderIndex, phaseShift = 0) => {
  enemy.__motion = {
    type: 'snake',
    laneX,
    amplitude: WAVE1.initialRoute.motion.amplitude,
    angularSpeed: WAVE1.initialRoute.motion.angularSpeed,
    phase: WAVE1.initialRoute.motion.phase + phaseShift,
    frequency: WAVE1.initialRoute.motion.frequency,
    segmentOffset: orderIndex * WAVE1.initialRoute.motion.segmentOffsetStep,
    parked: false,
    waveId: 'wave1',
  }
}

const deployCenterFormation = (enemies, stageWidth) => {
  const laneX = stageWidth * WAVE1.initialRoute.laneRatio
  enemies.forEach((enemy, index) => {
    enemy.visible = true
    enemy.x = laneX
    enemy.y = WAVE1.initialRoute.spawnY - index * WAVE1.initialRoute.spacingY
    applySnakeMotion(enemy, laneX, index)
  })
}

const deploySideFormation = (enemies, stageWidth) => {
  const leftLaneX = stageWidth * WAVE1.recycleRoute.laneRatios[0]
  const rightLaneX = stageWidth * WAVE1.recycleRoute.laneRatios[1]
  const half = Math.ceil(enemies.length / 2)
  const leftGroup = enemies.slice(0, half)
  const rightGroup = enemies.slice(half)

  leftGroup.forEach((enemy, index) => {
    enemy.visible = true
    enemy.x = leftLaneX
    enemy.y = WAVE1.initialRoute.spawnY - index * WAVE1.initialRoute.spacingY
    applySnakeMotion(enemy, leftLaneX, index, WAVE1.recycleRoute.phaseShift)
  })

  rightGroup.forEach((enemy, index) => {
    enemy.visible = true
    enemy.x = rightLaneX
    enemy.y = WAVE1.initialRoute.spawnY - index * WAVE1.initialRoute.spacingY
    applySnakeMotion(enemy, rightLaneX, index)
  })
}

const regroupIfReady = () => {
  if (runtime.alive.size === 0) return
  if (runtime.parked.size !== runtime.alive.size) return
  if (runtime.pendingRegroup) return

  runtime.pendingRegroup = true
}

const deployRegroup = (stageWidth) => {
  if (runtime.alive.size === 0) return
  if (runtime.parked.size !== runtime.alive.size) return

  const survivors = Array.from(runtime.alive)
  if (runtime.nextPattern === 'sides') {
    deploySideFormation(survivors, stageWidth)
    runtime.nextPattern = 'center'
  } else {
    deployCenterFormation(survivors, stageWidth)
    runtime.nextPattern = 'sides'
  }

  runtime.parked.clear()
}

export const spawnWave1 = ({ spawnEnemyById, stageWidth }) => {
  resetWave1Runtime()

  const centerX = stageWidth * WAVE1.initialRoute.laneRatio

  for (let i = 0; i < WAVE1.count; i += 1) {
    const enemy = spawnEnemyById(WAVE1.enemyId, {
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

    if (enemy) {
      runtime.alive.add(enemy)
    }
  }
}

export const isWave1Enemy = (enemy) => enemy?.__motion?.waveId === 'wave1'

export const onWave1EnemyDestroyed = (enemy) => {
  runtime.alive.delete(enemy)
  runtime.parked.delete(enemy)
  if (runtime.alive.size === 0) {
    runtime.pendingRegroup = false
    runtime.regroupAt = 0
  }
}

export const recycleWave1Enemy = ({ enemy, stageWidth, stageHeight, nowSeconds }) => {
  if (!isWave1Enemy(enemy)) return false
  if (typeof stageHeight === 'number' && enemy.y <= stageHeight + enemy.height) {
    return false
  }

  enemy.visible = false
  enemy.y = -enemy.height - WAVE1.recycleRoute.respawnRandomTop
  if (enemy.__motion) {
    enemy.__motion.parked = true
  }

  runtime.parked.add(enemy)
  const wasPending = runtime.pendingRegroup
  regroupIfReady()
  if (!wasPending && runtime.pendingRegroup) {
    runtime.regroupAt = nowSeconds + runtime.regroupDelaySeconds
    runtime.regroupDelaySeconds = Math.min(30, runtime.regroupDelaySeconds + 5)
  }

  // 如果这一帧已经超过等待时间，允许立即出发
  if (runtime.pendingRegroup && nowSeconds >= runtime.regroupAt) {
    runtime.pendingRegroup = false
    deployRegroup(stageWidth)
  }

  return true
}

export const updateWave1Regroup = ({ stageWidth, nowSeconds }) => {
  if (!runtime.pendingRegroup) return
  if (nowSeconds < runtime.regroupAt) return
  runtime.pendingRegroup = false
  deployRegroup(stageWidth)
}
