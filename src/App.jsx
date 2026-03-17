import { useEffect, useRef, useState } from 'react'
import { EmptySceneController } from './game/controllers/EmptySceneController'
import { GameController } from './game/controllers/GameController'
import { MainSceneController } from './game/controllers/MainSceneController'
import { loadGameSettings } from './game/utils/gameSettingsStorage'

const getSceneState = () => {
  const settings = loadGameSettings({
    gameStarted: false,
    pressureTestEnabled: false,
  })

  return {
    gameStarted: settings.gameStarted === true,
    pressureTestEnabled: settings.pressureTestEnabled === true,
  }
}

let CurrentGameController = GameController
let CurrentMainSceneController = MainSceneController
let CurrentEmptySceneController = EmptySceneController

if (import.meta.hot) {
  import.meta.hot.accept('./game/controllers/GameController', (module) => {
    CurrentGameController = module?.GameController ?? CurrentGameController
  })
  import.meta.hot.accept('./game/controllers/EmptySceneController', (module) => {
    CurrentEmptySceneController = module?.EmptySceneController ?? CurrentEmptySceneController
  })
  import.meta.hot.accept('./game/controllers/MainSceneController', (module) => {
    CurrentMainSceneController = module?.MainSceneController ?? CurrentMainSceneController
  })
}

export default function App() {
  const containerRef = useRef(null)
  const controllerRef = useRef(null)
  const [rebuildVersion, setRebuildVersion] = useState(0)
  const [sceneState, setSceneState] = useState(getSceneState)

  useEffect(() => {
    if (!import.meta.hot) return undefined

    const handleAfterUpdate = (payload) => {
      const shouldRebuild = payload.updates.some((update) =>
        update.path.includes('/src/game/'),
      )

      if (!shouldRebuild) return
      setRebuildVersion((version) => version + 1)
    }

    import.meta.hot.on('vite:afterUpdate', handleAfterUpdate)
    return () => {
      import.meta.hot.off('vite:afterUpdate', handleAfterUpdate)
    }
  }, [])

  useEffect(() => {
    const handleSettingsChanged = (event) => {
      const nextState = {
        gameStarted: event?.detail?.gameStarted === true,
        pressureTestEnabled: event?.detail?.pressureTestEnabled === true,
      }
      setSceneState((currentState) =>
        currentState.gameStarted === nextState.gameStarted &&
        currentState.pressureTestEnabled === nextState.pressureTestEnabled
          ? currentState
          : nextState,
      )
    }

    window.addEventListener('game-settings-changed', handleSettingsChanged)
    return () => {
      window.removeEventListener('game-settings-changed', handleSettingsChanged)
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return undefined

    let ControllerClass = CurrentMainSceneController
    if (sceneState.gameStarted) {
      ControllerClass = sceneState.pressureTestEnabled
        ? CurrentGameController
        : CurrentEmptySceneController
    }
    const controller = new ControllerClass(containerRef.current)
    controllerRef.current = controller

    controller.start().catch((error) => {
      console.error('Pixi boot failed:', error)
    })

    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [rebuildVersion, sceneState])

  return <div ref={containerRef} className="game-root" />
}
