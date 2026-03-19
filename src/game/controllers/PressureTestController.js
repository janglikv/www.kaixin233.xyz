import { createPressureTestEnemyFormation } from '../enemies/createPressureTestEnemyFormation'
import { createGameSettingsDefaults } from '../runtime/gameConfig'
import { GameController } from './GameController'

export class PressureTestController extends GameController {
  constructor(container, options = {}) {
    super(container, {
      ...options,
      settingsDefaults: {
        ...createGameSettingsDefaults({ pressureTestEnabled: true }),
        ...(options.settingsDefaults ?? {}),
      },
      enemyFormationFactory: createPressureTestEnemyFormation,
      gameOverTitle: '游戏结束',
    })
  }
}
