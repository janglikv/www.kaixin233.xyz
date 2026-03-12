import * as PIXI from 'pixi.js'
import { EXHAUST_PLUGINS } from '../effects/exhaustPlugins'

const LOGICAL_WIDTH = 1280
const LOGICAL_HEIGHT = 720
const GRID_COLUMNS = 3
const FORMATION_TOP = 200
const GRID_GAP_X = 320
const GRID_GAP_Y = 190
const EFFECT_SCALE = 0.5
const SHIP_THRUST_DISTANCE = 76 * EFFECT_SCALE

const createShip = () => {
  const ship = new PIXI.Container()
  ship.rotation = -Math.PI / 2

  const flameGlow = new PIXI.Graphics()
  flameGlow.blendMode = 'add'
  flameGlow
    .ellipse(-72, 0, 26, 14)
    .fill({ color: 0xff6a2a, alpha: 0.14 })
    .ellipse(-90, 0, 18, 10)
    .fill({ color: 0xff8d32, alpha: 0.18 })
  ship.addChild(flameGlow)

  const flameCore = new PIXI.Graphics()
  flameCore
    .ellipse(-62, 0, 14, 9)
    .fill({ color: 0xff9828, alpha: 0.82 })
    .ellipse(-84, 0, 22, 7)
    .fill({ color: 0xff5d1f, alpha: 0.72 })
  flameCore.blendMode = 'add'
  ship.addChild(flameCore)

  const flameInner = new PIXI.Graphics()
  flameInner
    .ellipse(-58, 0, 8, 5)
    .fill({ color: 0xffb05a, alpha: 0.5 })
    .ellipse(-74, 0, 13, 4)
    .fill({ color: 0xff8d32, alpha: 0.42 })
  flameInner.blendMode = 'add'
  ship.addChild(flameInner)

  const hull = new PIXI.Graphics()
  hull
    .roundRect(-34, -18, 96, 36, 18)
    .fill({ color: 0xe8f1ff, alpha: 1 })
    .stroke({ color: 0x8fb5ff, width: 2, alpha: 0.8 })
  hull
    .poly([
      62, 0,
      20, -28,
      20, 28,
    ])
    .fill({ color: 0xa7c8ff, alpha: 0.95 })
  hull
    .poly([
      -8, -12,
      -28, -34,
      8, -20,
    ])
    .fill({ color: 0x77aaff, alpha: 0.9 })
  hull
    .poly([
      -8, 12,
      -28, 34,
      8, 20,
    ])
    .fill({ color: 0x77aaff, alpha: 0.9 })
  hull.circle(26, 0, 10).fill({ color: 0x0f1b38, alpha: 0.95 })
  hull.circle(26, 0, 6).fill({ color: 0x7ef7ff, alpha: 0.9 })
  ship.addChild(hull)

  return {
    ship,
    flameGlow,
    flameCore,
    flameInner,
  }
}

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
    background.circle(LOGICAL_WIDTH * 0.2, LOGICAL_HEIGHT * 0.24, 220).fill({
      color: 0x1e2d6d,
      alpha: 0.18,
    })
    background.circle(LOGICAL_WIDTH * 0.82, LOGICAL_HEIGHT * 0.22, 210).fill({
      color: 0x5d2248,
      alpha: 0.12,
    })
    background.circle(LOGICAL_WIDTH * 0.5, LOGICAL_HEIGHT * 0.82, 260).fill({
      color: 0x143848,
      alpha: 0.1,
    })
    gameLayer.addChild(background)

    const starfield = new PIXI.Graphics()
    for (let index = 0; index < 140; index += 1) {
      const x = ((index * 197) % LOGICAL_WIDTH) + ((index % 7) - 3) * 4
      const y = ((index * 149) % LOGICAL_HEIGHT) + ((index % 5) - 2) * 5
      const radius = index % 9 === 0 ? 2 : 1.1
      const alpha = 0.14 + (index % 6) * 0.08
      starfield.circle(x, y, radius).fill({ color: 0xffffff, alpha })
    }
    gameLayer.addChild(starfield)

    const sceneShips = []

    EXHAUST_PLUGINS.forEach((plugin, index) => {
      const column = index % GRID_COLUMNS
      const row = Math.floor(index / GRID_COLUMNS)
      const itemsInRow = Math.min(
        GRID_COLUMNS,
        EXHAUST_PLUGINS.length - row * GRID_COLUMNS,
      )
      const rowWidth = (itemsInRow - 1) * GRID_GAP_X
      const rowStartX = LOGICAL_WIDTH * 0.5 - rowWidth * 0.5
      const laneX = rowStartX + column * GRID_GAP_X
      const laneY = FORMATION_TOP + row * GRID_GAP_Y
      const shipGroup = new PIXI.Container()
      const laneGlow = new PIXI.Graphics()
      laneGlow.circle(0, 0, 88).fill({
        color: column === 1 ? 0x233f7d : 0x1f2d58,
        alpha: 0.11,
      })
      laneGlow.ellipse(0, 104, 54, 18).fill({
        color: 0x7fd6ff,
        alpha: 0.06,
      })
      shipGroup.addChild(laneGlow)

      const runtimeLayer = new PIXI.Container()
      shipGroup.addChild(runtimeLayer)

      const { ship, flameGlow, flameCore, flameInner } = createShip()
      const shipX = laneX
      const shipY = laneY
      ship.position.set(shipX, shipY)
      ship.scale.set(EFFECT_SCALE)
      shipGroup.addChild(ship)

      const pluginRuntime = plugin.createRuntime(PIXI, runtimeLayer)
      gameLayer.addChild(shipGroup)

      sceneShips.push({
        shipX,
        shipY,
        flameGlow,
        flameCore,
        flameInner,
        pluginRuntime,
      })
    })

    const frame = new PIXI.Graphics()
    frame
      .roundRect(24, 24, LOGICAL_WIDTH - 48, LOGICAL_HEIGHT - 48, 24)
      .stroke({ color: 0x5b6b8d, width: 2, alpha: 0.9 })
    gameLayer.addChild(frame)

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
      const deltaSeconds = ticker.deltaMS / 1000
      elapsedSeconds += deltaSeconds

      sceneShips.forEach((card, index) => {
        const pulse = 0.82 + Math.sin(elapsedSeconds * (14 + index * 1.4) + index) * 0.18

        card.flameGlow.scale.set(0.94 + pulse * 0.18, 0.86 + pulse * 0.12)
        card.flameCore.scale.set(0.92 + pulse * 0.4, 0.8 + pulse * 0.26)
        card.flameInner.scale.set(0.84 + pulse * 0.26, 0.74 + pulse * 0.18)
        card.flameGlow.alpha = 0.24 + pulse * 0.08
        card.flameCore.alpha = 0.46 + pulse * 0.14
        card.flameInner.alpha = 0.2 + pulse * 0.1

        card.pluginRuntime.update(deltaSeconds, elapsedSeconds, {
          originX: card.shipX,
          originY: card.shipY + SHIP_THRUST_DISTANCE,
          directionX: 0,
          directionY: -1,
          pulse,
          scale: EFFECT_SCALE,
        })
      })
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

      sceneShips.forEach((card) => {
        card.pluginRuntime.destroy()
      })

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
