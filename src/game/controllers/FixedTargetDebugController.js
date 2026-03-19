import { createFixedTargetEnemyFormation } from '../enemies/createFixedTargetEnemyFormation'
import { createGameSettingsDefaults, DEBUG_SCENE_FIXED_TARGET } from '../runtime/gameConfig'
import { GameController } from './GameController'

export class FixedTargetDebugController extends GameController {
  constructor(container, options = {}) {
    super(container, {
      ...options,
      settingsDefaults: {
        ...createGameSettingsDefaults({
          pressureTestEnabled: true,
          debugSceneMode: DEBUG_SCENE_FIXED_TARGET,
        }),
        ...(options.settingsDefaults ?? {}),
      },
      enemyFormationFactory: createFixedTargetEnemyFormation,
      gameOverTitle: '游戏结束',
    })
  }
}
