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

export const updateSnakeTimelineMotion = ({ enemy, motion, deltaSeconds }) => {
  motion.t = (motion.t ?? 0) + deltaSeconds
  const activeT = Math.max(0, motion.t)
  enemy.y = motion.spawnY + motion.speedY * activeT
  enemy.x = motion.laneX + Math.sin((motion.phase ?? 0) + motion.angularSpeed * activeT) * motion.amplitude
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
