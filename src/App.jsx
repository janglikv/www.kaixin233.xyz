import { useEffect, useRef, useState } from 'react'
import { GameController } from './game/controllers/GameController'
import { FixedTargetDebugController } from './game/controllers/FixedTargetDebugController'
import { HomeController } from './game/controllers/HomeController'
import { PressureTestController } from './game/controllers/PressureTestController'
import { DEBUG_SCENE_FIXED_TARGET } from './game/runtime/gameConfig'
import { loadGameSettings } from './game/utils/gameSettingsStorage'

const getSceneState = () => {
  const settings = loadGameSettings({
    gameStarted: false,
    pressureTestEnabled: false,
    debugSceneMode: null,
  })

  return {
    gameStarted: settings.gameStarted === true,
    pressureTestEnabled: settings.pressureTestEnabled === true,
    debugSceneMode: typeof settings.debugSceneMode === 'string' ? settings.debugSceneMode : null,
  }
}

let CurrentGameController = GameController
let CurrentFixedTargetDebugController = FixedTargetDebugController
let CurrentHomeController = HomeController
let CurrentPressureTestController = PressureTestController

if (import.meta.hot) {
  import.meta.hot.accept('./game/controllers/GameController', (module) => {
    CurrentGameController = module?.GameController ?? CurrentGameController
  })
  import.meta.hot.accept('./game/controllers/PressureTestController', (module) => {
    CurrentPressureTestController =
      module?.PressureTestController ?? CurrentPressureTestController
  })
  import.meta.hot.accept('./game/controllers/FixedTargetDebugController', (module) => {
    CurrentFixedTargetDebugController =
      module?.FixedTargetDebugController ?? CurrentFixedTargetDebugController
  })
  import.meta.hot.accept('./game/controllers/HomeController', (module) => {
    CurrentHomeController = module?.HomeController ?? CurrentHomeController
  })
}

export default function App() {
  const containerRef = useRef(null)
  const controllerRef = useRef(null)
  const [rebuildVersion, setRebuildVersion] = useState(0)
  const [sceneState, setSceneState] = useState(getSceneState)

  useEffect(() => {
    if (!import.meta.hot) return undefined

    const isGameModulePath = (path) =>
      typeof path === 'string' && /(^|\/)src\/game\//.test(path)
    const isEcsModulePath = (path) =>
      typeof path === 'string' && /(^|\/)src\/game\/ecs\//.test(path)
    const collectUpdatePaths = (update) =>
      [update?.path, update?.acceptedPath].filter((path) => typeof path === 'string')

    const handleAfterUpdate = (payload) => {
      const rebuildPaths = payload.updates.flatMap(collectUpdatePaths).filter((path) => {
        return isGameModulePath(path) && !isEcsModulePath(path)
      })
      const shouldRebuild = rebuildPaths.length > 0

      if (!shouldRebuild) return
      console.info('[hmr] rebuild controller for:', rebuildPaths)
      setRebuildVersion((version) => version + 1)
    }

    import.meta.hot.on('vite:afterUpdate', handleAfterUpdate)
    return () => {
      import.meta.hot.off('vite:afterUpdate', handleAfterUpdate)
    }
  }, [])

  useEffect(() => {
    const handleSettingsChanged = () => {
      const nextState = getSceneState()
      setSceneState((currentState) =>
        currentState.gameStarted === nextState.gameStarted &&
        currentState.pressureTestEnabled === nextState.pressureTestEnabled &&
        currentState.debugSceneMode === nextState.debugSceneMode
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

    let ControllerClass = CurrentHomeController
    if (sceneState.gameStarted) {
      ControllerClass =
        sceneState.debugSceneMode === DEBUG_SCENE_FIXED_TARGET
          ? CurrentFixedTargetDebugController
          : sceneState.pressureTestEnabled
            ? CurrentPressureTestController
            : CurrentGameController
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
