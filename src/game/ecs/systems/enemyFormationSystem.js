import { queryEntities } from '../createEcsWorld'

const syncHitbox = (position, enemy, health, hitbox) => {
  hitbox.left = position.x - enemy.hitboxHalfWidth
  hitbox.right = position.x + enemy.hitboxHalfWidth
  hitbox.top = position.y - enemy.hitboxTopOffset
  hitbox.bottom = position.y + enemy.hitboxBottomOffset
  hitbox.centerX = position.x
  hitbox.centerY = position.y + enemy.hitboxCenterYOffset
  hitbox.health = health.current
}

export const enemyFormationSystem = (world, context) => {
  const { deltaSeconds, bottomLimit } = context

  queryEntities(world, ['position', 'velocity', 'enemy', 'health', 'recycle', 'hitbox']).forEach(
    (entityId) => {
      const position = world.components.position.get(entityId)
      const velocity = world.components.velocity.get(entityId)
      const enemy = world.components.enemy.get(entityId)
      const health = world.components.health.get(entityId)
      const recycle = world.components.recycle.get(entityId)
      const hitbox = world.components.hitbox.get(entityId)

      position.y += velocity.y * deltaSeconds

      if (position.y > bottomLimit) {
        health.current = recycle.resetHealth
        position.y -= recycle.spanY
      }

      syncHitbox(position, enemy, health, hitbox)
    },
  )
}
