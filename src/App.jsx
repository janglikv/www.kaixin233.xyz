import { useEffect, useRef, useState } from 'react'
import { GameController } from './game/controllers/GameController'

export default function App() {
  const containerRef = useRef(null)
  const controllerRef = useRef(null)
  const [rebuildVersion, setRebuildVersion] = useState(0)

  useEffect(() => {
    if (!import.meta.hot) return undefined

    const handleBeforeUpdate = () => {
      setRebuildVersion((version) => version + 1)
    }

    import.meta.hot.on('vite:beforeUpdate', handleBeforeUpdate)
    return () => {
      import.meta.hot.off('vite:beforeUpdate', handleBeforeUpdate)
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return undefined

    const controller = new GameController(containerRef.current)
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
