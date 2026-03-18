import { queryEntities } from '../createEcsWorld'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export const playerMovementSystem = (world, context) => {
  const { deltaSeconds, axis, speed, clampRect } = context

  queryEntities(world, ['position', 'bounds', 'playerControlled']).forEach((entityId) => {
    const position = world.components.position.get(entityId)
    const bounds = world.components.bounds.get(entityId)
    const { horizontal, vertical } = axis
    const movementLength = Math.hypot(horizontal, vertical) || 1
    const velocityX = (horizontal / movementLength) * speed
    const velocityY = (vertical / movementLength) * speed

    position.x = clamp(
      position.x + velocityX * deltaSeconds,
      clampRect.left + bounds.halfWidth,
      clampRect.right - bounds.halfWidth,
    )
    position.y = clamp(
      position.y + velocityY * deltaSeconds,
      clampRect.top + bounds.halfHeight,
      clampRect.bottom - bounds.halfHeight,
    )
  })
}
