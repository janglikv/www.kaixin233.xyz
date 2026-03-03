import { useEffect, useRef, useState } from 'react'
import { GameController } from './game/controllers/GameController'

// HMR 版本号：用于在热更新时强制重建 Pixi 控制器，避免状态脏读
const hmrVersion = (() => {
  if (!import.meta.hot) return 0
  const nextVersion = (import.meta.hot.data.pixiAppVersion ?? 0) + 1
  import.meta.hot.data.pixiAppVersion = nextVersion
  return nextVersion
})()

export default function App() {
  // Pixi 画布挂载容器
  const containerRef = useRef(null)
  // 游戏主控制器实例（跨渲染周期持有）
  const controllerRef = useRef(null)
  // 资料库 UI 状态（React 侧）
  const [showLibrary, setShowLibrary] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return undefined

    // 创建并启动 Pixi 游戏控制器
    const controller = new GameController(containerRef.current, {
      showLibrary,
    })
    controllerRef.current = controller

    controller.start().catch((error) => {
      console.error('Pixi boot failed:', error)
    })

    // 组件卸载或 HMR 重建时销毁控制器，释放事件与 WebGL 资源
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hmrVersion])

  // React 状态变化时，同步给 Pixi 内部资料库面板
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
