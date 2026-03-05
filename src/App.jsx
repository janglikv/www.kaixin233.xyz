import { useEffect, useRef, useState } from 'react'
import { GameController } from './game/controllers/GameController'

export default function App() {
  const LOGICAL_WIDTH = 1280
  const LOGICAL_HEIGHT = 720
  // Pixi 画布挂载容器
  const containerRef = useRef(null)
  // 游戏主控制器实例（跨渲染周期持有）
  const controllerRef = useRef(null)
  // 资料库 UI 状态（React 侧）
  const [showLibrary, setShowLibrary] = useState(false)
  // 强制重建计数：用于开发态下在任意模块热更新后重启 Pixi 游戏
  const [rebuildVersion, setRebuildVersion] = useState(0)
  // DOM UI 与游戏画面一致的缩放参数
  const [uiViewport, setUiViewport] = useState({ scale: 1, offsetX: 0, offsetY: 0 })

  useEffect(() => {
    const updateUiViewport = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const scale = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT)
      setUiViewport({
        scale,
        offsetX: (width - LOGICAL_WIDTH * scale) * 0.5,
        offsetY: (height - LOGICAL_HEIGHT * scale) * 0.5,
      })
    }

    updateUiViewport()
    window.addEventListener('resize', updateUiViewport)
    return () => {
      window.removeEventListener('resize', updateUiViewport)
    }
  }, [])

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
  }, [rebuildVersion])

  // React 状态变化时，同步给 Pixi 内部资料库面板
  useEffect(() => {
    controllerRef.current?.setLibraryVisible(showLibrary)
  }, [showLibrary])

  return (
    <div className="app-root">
      <div
        className="ui-scale-root"
        style={{
          transform: `translate(${uiViewport.offsetX}px, ${uiViewport.offsetY}px) scale(${uiViewport.scale})`,
        }}
      >
        <button
          type="button"
          className="library-btn"
          onClick={() => {
            setShowLibrary((value) => {
              const next = !value
              controllerRef.current?.setLibraryVisible(next)
              return next
            })
          }}
        >
          {showLibrary ? '关闭资料库' : '资料库'}
        </button>
      </div>
      <div ref={containerRef} className="game-root" />
    </div>
  )
}
