import * as PIXI from 'pixi.js'

const LOGICAL_WIDTH = 1280
const LOGICAL_HEIGHT = 720

export class GameController {
  constructor(container) {
    this.container = container
    this.app = null
    this.cleanupFn = null
    this.started = false
    this.destroyed = false
  }

  async start() {
    if (this.started || !this.container) return

    this.started = true
    this.destroyed = false

    let disposed = false
    let initialized = false

    const app = new PIXI.Application()
    this.app = app

    await app.init({
      background: '#060913',
      antialias: true,
      resizeTo: this.container,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    initialized = true
    if (disposed || this.destroyed || !this.container) {
      app.destroy(true, { children: true })
      return
    }

    this.container.appendChild(app.canvas)

    const gameLayer = new PIXI.Container()
    app.stage.addChild(gameLayer)

    const background = new PIXI.Graphics()
    background.rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT).fill(0x0b1020)
    gameLayer.addChild(background)

    const frame = new PIXI.Graphics()
    frame
      .roundRect(24, 24, LOGICAL_WIDTH - 48, LOGICAL_HEIGHT - 48, 24)
      .stroke({ color: 0x5b6b8d, width: 2, alpha: 0.9 })
    gameLayer.addChild(frame)

    const titleText = new PIXI.Text({
      text: 'New Game Scaffold',
      style: {
        fill: 0xf4f7fb,
        fontFamily: 'IBM Plex Sans, Noto Sans SC, sans-serif',
        fontSize: 44,
        fontWeight: '700',
      },
    })
    titleText.anchor.set(0.5)
    titleText.position.set(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 24)
    gameLayer.addChild(titleText)

    const statusText = new PIXI.Text({
      text: 'elapsed: 0.0s',
      style: {
        fill: 0x9fb0d1,
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 18,
      },
    })
    statusText.anchor.set(0.5)
    statusText.position.set(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 28)
    gameLayer.addChild(statusText)

    let elapsedSeconds = 0

    const layout = () => {
      const scale = Math.min(
        app.renderer.width / LOGICAL_WIDTH,
        app.renderer.height / LOGICAL_HEIGHT,
      )
      const offsetX = (app.renderer.width - LOGICAL_WIDTH * scale) * 0.5
      const offsetY = (app.renderer.height - LOGICAL_HEIGHT * scale) * 0.5

      gameLayer.scale.set(scale)
      gameLayer.position.set(offsetX, offsetY)
    }

    const tick = (ticker) => {
      elapsedSeconds += ticker.deltaMS / 1000
      statusText.text = `elapsed: ${elapsedSeconds.toFixed(1)}s`
    }

    app.renderer.on('resize', layout)
    app.ticker.add(tick)
    layout()

    this.cleanupFn = () => {
      if (disposed) return
      disposed = true

      if (this.app === app) {
        this.app = null
      }

      app.renderer.off('resize', layout)
      app.ticker.remove(tick)

      if (initialized) {
        app.destroy(true, { children: true })
      }
    }
  }

  destroy() {
    this.destroyed = true
    this.started = false
    this.cleanupFn?.()
    this.cleanupFn = null
  }
}
