import { enemyFormationSystem as nextEnemyFormationSystem } from './systems/enemyFormationSystem'
import { playerMovementSystem as nextPlayerMovementSystem } from './systems/playerMovementSystem'

export const ecsSystemRegistry = {
  enemyFormationSystem: nextEnemyFormationSystem,
  playerMovementSystem: nextPlayerMovementSystem,
}

if (import.meta.hot) {
  import.meta.hot.accept('./systems/enemyFormationSystem', (module) => {
    ecsSystemRegistry.enemyFormationSystem =
      module?.enemyFormationSystem ?? ecsSystemRegistry.enemyFormationSystem
  })

  import.meta.hot.accept('./systems/playerMovementSystem', (module) => {
    ecsSystemRegistry.playerMovementSystem =
      module?.playerMovementSystem ?? ecsSystemRegistry.playerMovementSystem
  })
}
