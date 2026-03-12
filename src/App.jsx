import { useEffect, useRef, useState } from 'react'
import { GameController } from './game/controllers/GameController'

let CurrentGameController = GameController

if (import.meta.hot) {
  import.meta.hot.accept('./game/controllers/GameController', (module) => {
    CurrentGameController = module?.GameController ?? CurrentGameController
  })
}

export default function App() {
  const containerRef = useRef(null)
  const controllerRef = useRef(null)
  const [rebuildVersion, setRebuildVersion] = useState(0)

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
    if (!containerRef.current) return undefined

    const controller = new CurrentGameController(containerRef.current)
    controllerRef.current = controller

    controller.start().catch((error) => {
      console.error('Pixi boot failed:', error)
    })

    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [rebuildVersion])

  return <div ref={containerRef} className="game-root" />
}
