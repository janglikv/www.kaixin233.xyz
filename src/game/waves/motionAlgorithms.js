const getTurnedXByTravel = ({ baseX, centerX, travelX, direction }) => {
  const toCenter = Math.max(0, (centerX - baseX) * direction)
  const blendHalfWidth = Math.min(90, Math.max(24, toCenter * 0.35))
  const blendStart = Math.max(0, toCenter - blendHalfWidth)
  const blendEnd = toCenter + blendHalfWidth

  if (travelX <= blendStart) return baseX + direction * travelX
  if (travelX >= blendEnd) return centerX - direction * (travelX - toCenter)

  const t = (travelX - blendStart) / Math.max(1e-6, blendEnd - blendStart)
  const p0 = centerX - direction * blendHalfWidth
  const p1 = centerX
  const p2 = centerX - direction * blendHalfWidth
  return (
    (1 - t) * (1 - t) * p0
    + 2 * (1 - t) * t * p1
    + t * t * p2
  )
}

export const updateAssaultMotion = ({
  enemy,
  motion,
  deltaSeconds,
  hero,
  enemySprites,
  elapsedGameTime,
  spawnEnemyBullet,
}) => {
  motion.enterDelay = Math.max(0, (motion.enterDelay ?? 0) - deltaSeconds)
  if (motion.enterDelay > 0 || !hero) return

  const STATE_ADVANCE = 'advance'
  const STATE_SEEK_SLOT = 'seek_slot'
  const STATE_ATTACK_LOCK = 'attack_lock'
  const STATE_REPOSITION = 'reposition'

  const moveSpeed = motion.moveSpeed ?? 96
  const attackRange = motion.attackRange ?? 280
  const holdRadius = motion.holdRadius ?? 24
  const fireCooldown = motion.fireCooldown ?? 1.35
  const bulletSpeed = motion.bulletSpeed ?? 280
  const stopOffsetY = motion.stopOffsetY ?? -32
  const advanceYOffset = motion.advanceYOffset ?? 260
  const advanceTolerance = motion.advanceTolerance ?? 42
  const retargetDelay = motion.retargetDelay ?? 0.5
  const repositionThreshold = motion.repositionThreshold ?? 18
  const formationSize = motion.formationSize ?? 1
  const formationIndex = motion.formationIndex ?? 0
  const formationSpacingX = motion.formationSpacingX ?? 48
  const formationRowGap = motion.formationRowGap ?? 40
  const sideBias = motion.sideBias ?? 1

  const columns = Math.max(1, Math.ceil(Math.sqrt(formationSize)))
  const row = Math.floor(formationIndex / columns)
  const col = formationIndex % columns
  const centeredCol = col - (columns - 1) * 0.5
  const slotX = hero.x + centeredCol * formationSpacingX
  const slotY = hero.y + stopOffsetY - row * formationRowGap
  const advanceX = hero.x + centeredCol * (formationSpacingX * 0.6)
  const advanceY = Math.max(-120, hero.y - advanceYOffset - row * (formationRowGap * 0.5))

  motion.state ??= STATE_ADVANCE
  motion.missedAttackWindow ??= false
  motion.retargetAt ??= 0
  motion.shotFaceTimer = Math.max(0, (motion.shotFaceTimer ?? 0) - deltaSeconds)

  let separationX = 0
  let separationY = 0
  let blockedAhead = 0
  for (const otherEnemy of enemySprites ?? []) {
    if (!otherEnemy || otherEnemy === enemy) continue
    const dx = enemy.x - otherEnemy.x
    const dy = enemy.y - otherEnemy.y
    const distance = Math.hypot(dx, dy)
    const avoidRadius = (enemy.__collisionRadius ?? 18) + (otherEnemy.__collisionRadius ?? 18) + 26
    if (distance <= 1e-6 || distance >= avoidRadius) continue

    const weight = (avoidRadius - distance) / avoidRadius
    separationX += (dx / distance) * weight * 1.6
    separationY += (dy / distance) * weight * 1.2

    const isAhead = otherEnemy.y > enemy.y - 12
      && Math.abs(otherEnemy.x - enemy.x) < avoidRadius * 0.8
    if (isAhead) {
      blockedAhead += weight
    }
  }

  const heroDX = hero.x - enemy.x
  const heroDY = hero.y - enemy.y
  const heroDistance = Math.hypot(heroDX, heroDY)
  const slotDX = slotX - enemy.x
  const slotDY = slotY - enemy.y
  const slotDistance = Math.hypot(slotDX, slotDY)
  const advanceDX = advanceX - enemy.x
  const advanceDY = advanceY - enemy.y
  const advanceDistance = Math.hypot(advanceDX, advanceDY)
  const canAttackFromHere = heroDistance <= attackRange && slotDistance <= holdRadius + 8

  if (!motion.missedAttackWindow && motion.state === STATE_ADVANCE && heroDistance <= attackRange * 1.15) {
    motion.state = STATE_SEEK_SLOT
  }
  if (motion.state === STATE_ATTACK_LOCK && !canAttackFromHere && elapsedGameTime + 1e-6 >= motion.retargetAt) {
    motion.state = STATE_ADVANCE
    motion.missedAttackWindow = true
  }

  let desireX = 0
  let desireY = 0
  if (motion.state === STATE_ADVANCE) {
    if (advanceDistance > advanceTolerance) {
      desireX += advanceDX / Math.max(advanceDistance, 1e-6)
      desireY += Math.max(0.35, advanceDY / Math.max(advanceDistance, 1e-6))
    } else {
      if (!motion.missedAttackWindow) {
        motion.state = STATE_SEEK_SLOT
      }
    }
  }

  if (motion.state === STATE_SEEK_SLOT || motion.state === STATE_REPOSITION) {
    if (slotDistance > holdRadius) {
      desireX += slotDX / Math.max(slotDistance, 1e-6)
      desireY += Math.max(0, slotDY / Math.max(slotDistance, 1e-6))
    }
    if (blockedAhead > 0.08) {
      desireX += sideBias * blockedAhead * 1.15
    }
    if (canAttackFromHere) {
      motion.state = STATE_ATTACK_LOCK
      motion.retargetAt = elapsedGameTime + retargetDelay
    }
  }

  if (motion.state === STATE_ATTACK_LOCK) {
    if (!canAttackFromHere) {
      motion.state = STATE_ADVANCE
      motion.missedAttackWindow = true
    } else if (blockedAhead > repositionThreshold / 100 && slotDistance > holdRadius * 0.8) {
      motion.state = STATE_REPOSITION
    }
  }

  if (motion.state === STATE_REPOSITION) {
    if (slotDistance > holdRadius * 0.55) {
      desireX += slotDX / Math.max(slotDistance, 1e-6)
      desireY += Math.max(0, slotDY / Math.max(slotDistance, 1e-6))
    }
    desireX += sideBias * Math.max(0.45, blockedAhead) * 0.9
    if (canAttackFromHere && blockedAhead < 0.18) {
      motion.state = STATE_ATTACK_LOCK
      motion.retargetAt = elapsedGameTime + retargetDelay
    } else if (heroDistance > attackRange * 1.08) {
      motion.state = STATE_ADVANCE
      motion.missedAttackWindow = true
    }
  }

  let steeringX = desireX + separationX
  let steeringY = Math.max(0, desireY + separationY * 0.45)
  const steeringLength = Math.hypot(steeringX, steeringY)
  if (steeringLength > 1e-6 && motion.state !== STATE_ATTACK_LOCK) {
    const speedFactor = motion.state === STATE_ADVANCE ? 1 : 0.8
    const moveX = (steeringX / steeringLength) * moveSpeed * speedFactor * deltaSeconds
    const moveY = Math.max(0, (steeringY / steeringLength) * moveSpeed * speedFactor * deltaSeconds)
    enemy.x += moveX
    enemy.y += moveY
    if ((moveX * moveX + moveY * moveY) > 1e-6) {
      motion.faceAngle = Math.atan2(moveY, moveX) + Math.PI / 2
    }
  }

  if (motion.state !== STATE_ATTACK_LOCK || !canAttackFromHere) return

  motion.nextShotAt ??= elapsedGameTime + (motion.initialShotDelay ?? 0.25)
  if (elapsedGameTime + 1e-6 < motion.nextShotAt) return

  motion.faceAngle = Math.atan2(heroDY, heroDX) + Math.PI / 2
  motion.shotFaceTimer = motion.shotFaceDuration ?? 0.18

  spawnEnemyBullet?.({
    x: enemy.x,
    y: enemy.y + enemy.height * 0.24,
    targetX: hero.x,
    targetY: hero.y,
    speed: bulletSpeed,
  })
  motion.nextShotAt = elapsedGameTime + fireCooldown
}

export const updateSnakeTimelineMotion = ({ enemy, motion, deltaSeconds }) => {
  const spawnY = motion.spawnY ?? -80
  const speedY = motion.speedY ?? 120
  const amplitude = motion.amplitude ?? 38
  const angularSpeed = motion.angularSpeed ?? 3.8
  const phase = motion.phase ?? 0
  if (motion.laneX == null) {
    motion.laneX = enemy.x
  }

  motion.t = (motion.t ?? 0) + deltaSeconds
  const activeT = Math.max(0, motion.t)
  enemy.y = spawnY + speedY * activeT
  enemy.x = motion.laneX + Math.sin(phase + angularSpeed * activeT) * amplitude
}

export const updateTurnbackTimelineMotion = ({ enemy, motion, deltaSeconds }) => {
  motion.t = (motion.t ?? 0) + deltaSeconds
  const activeT = Math.max(0, motion.t)
  enemy.y = motion.spawnY + motion.speedY * activeT
  const travelX = Math.max(0, enemy.y - motion.spawnY) * motion.xPerY
  enemy.x = getTurnedXByTravel({
    baseX: motion.baseX,
    centerX: motion.centerX,
    travelX,
    direction: motion.direction,
  })
}
