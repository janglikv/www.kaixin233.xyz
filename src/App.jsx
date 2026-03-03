import { useEffect, useRef, useState } from 'react'
import { GameController } from './game/controllers/GameController'

const hmrVersion = (() => {
  if (!import.meta.hot) return 0
  const nextVersion = (import.meta.hot.data.pixiAppVersion ?? 0) + 1
  import.meta.hot.data.pixiAppVersion = nextVersion
  return nextVersion
})()

export default function App() {
  const containerRef = useRef(null)
  const controllerRef = useRef(null)
  const [showLibrary, setShowLibrary] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return undefined

    const controller = new GameController(containerRef.current, {
      showLibrary,
    })
    controllerRef.current = controller

    controller.start().catch((error) => {
      console.error('Pixi boot failed:', error)
    })

    return () => {
      controller.destroy()
      controllerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hmrVersion])

  useEffect(() => {
    controllerRef.current?.setLibraryVisible(showLibrary)
  }, [showLibrary])

  return (
    <div className="app-root">
      <button
        type="button"
        className="library-btn"
        onClick={() => setShowLibrary((value) => !value)}
      >
        {showLibrary ? '关闭资料库' : '资料库'}
      </button>
      <div ref={containerRef} className="game-root" />
    </div>
  )
}
