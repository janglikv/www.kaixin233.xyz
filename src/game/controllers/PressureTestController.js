import { createPressureTestEnemyFormation } from '../enemies/createPressureTestEnemyFormation'
import { createGameSettingsDefaults, DEBUG_SCENE_PRESSURE_TEST } from '../runtime/gameConfig'
import { GameController } from './GameController'

export class PressureTestController extends GameController {
  constructor(container, options = {}) {
    super(container, {
      ...options,
      settingsDefaults: {
        ...createGameSettingsDefaults({
          pressureTestEnabled: true,
          debugSceneMode: DEBUG_SCENE_PRESSURE_TEST,
        }),
        ...(options.settingsDefaults ?? {}),
      },
      enemyFormationFactory: createPressureTestEnemyFormation,
      gameOverTitle: '游戏结束',
    })
  }
}
