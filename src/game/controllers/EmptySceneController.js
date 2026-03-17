import { GameController } from './GameController'

export class EmptySceneController extends GameController {
  constructor(container) {
    super(container, { spawnEnemies: false })
  }
}
