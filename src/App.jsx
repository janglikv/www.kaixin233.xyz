import { useEffect, useRef, useState } from 'react'
import { GameController } from './game/controllers/GameController'
import { MainSceneController } from './game/controllers/MainSceneController'
import { loadGameSettings } from './game/utils/gameSettingsStorage'

const getPressureTestSceneEnabled = () =>
  loadGameSettings({
    pressureTestEnabled: true,
  }).pressureTestEnabled !== false

let CurrentGameController = GameController
let CurrentMainSceneController = MainSceneController

if (import.meta.hot) {
  import.meta.hot.accept('./game/controllers/GameController', (module) => {
    CurrentGameController = module?.GameController ?? CurrentGameController
  })
  import.meta.hot.accept('./game/controllers/MainSceneController', (module) => {
    CurrentMainSceneController = module?.MainSceneController ?? CurrentMainSceneController
  })
}

export default function App() {
  const containerRef = useRef(null)
  const controllerRef = useRef(null)
  const [rebuildVersion, setRebuildVersion] = useState(0)
  const [isPressureTestSceneEnabled, setIsPressureTestSceneEnabled] = useState(
    getPressureTestSceneEnabled,
  )

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
      const nextEnabled = event?.detail?.pressureTestEnabled !== false
      setIsPressureTestSceneEnabled((currentEnabled) =>
        currentEnabled === nextEnabled ? currentEnabled : nextEnabled,
      )
    }

    window.addEventListener('game-settings-changed', handleSettingsChanged)
    return () => {
      window.removeEventListener('game-settings-changed', handleSettingsChanged)
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return undefined

    const ControllerClass = isPressureTestSceneEnabled
      ? CurrentGameController
      : CurrentMainSceneController
    const controller = new ControllerClass(containerRef.current)
    controllerRef.current = controller

    controller.start().catch((error) => {
      console.error('Pixi boot failed:', error)
    })

    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [rebuildVersion, isPressureTestSceneEnabled])

  return <div ref={containerRef} className="game-root" />
}
