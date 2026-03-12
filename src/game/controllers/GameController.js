import * as PIXI from 'pixi.js'
import { createExhaustSwitcher } from '../effects/createExhaustSwitcher'
import { createFlameSwitchButton } from '../renderers/createFlameSwitchButton'
import { createShipScene } from '../renderers/createShipScene'
import { createSpaceBackdrop } from '../renderers/createSpaceBackdrop'
import { createKeyboardController } from '../utils/createKeyboardController'

const LOGICAL_WIDTH = 1280
const LOGICAL_HEIGHT = 720
const SHIP_SCALE = 0.42
const EFFECT_SCALE = 0.5
const SHIP_THRUST_DISTANCE = 76 * SHIP_SCALE
const SHIP_MOVE_SPEED = 260

export class GameController {
  constructor(container, options = {}) {
    this.container = container
    this.pluginIndex = options.pluginIndex ?? 0
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

    gameLayer.addChild(
      createSpaceBackdrop({
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
      }),
    )

    const shipScene = createShipScene({
      x: LOGICAL_WIDTH * 0.5,
      y: LOGICAL_HEIGHT * 0.72,
      shipScale: SHIP_SCALE,
    })
    const keyboard = createKeyboardController()
    const exhaustSwitcher = createExhaustSwitcher({
      PIXI,
      runtimeLayer: shipScene.runtimeLayer,
      initialIndex: this.pluginIndex,
    })

    const buttonContainer = createFlameSwitchButton({
      x: 52,
      y: LOGICAL_HEIGHT - 108,
      onTap: () => {
        exhaustSwitcher.switchNext()
      },
    })
    gameLayer.addChild(buttonContainer)
    gameLayer.addChild(shipScene.shipGroup)

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
      const { horizontal, vertical } = keyboard.getAxis()
      const movementLength = Math.hypot(horizontal, vertical) || 1
      const velocityX = (horizontal / movementLength) * SHIP_MOVE_SPEED
      const velocityY = (vertical / movementLength) * SHIP_MOVE_SPEED
      const nextShipX = Math.max(
        96,
        Math.min(LOGICAL_WIDTH - 96, shipScene.shipX + velocityX * deltaSeconds),
      )
      const nextShipY = Math.max(
        96,
        Math.min(LOGICAL_HEIGHT - 120, shipScene.shipY + velocityY * deltaSeconds),
      )

      shipScene.setPosition(nextShipX, nextShipY)

      const pulse = 0.82 + Math.sin(elapsedSeconds * 14) * 0.18

      shipScene.flameGlow.scale.set(0.94 + pulse * 0.18, 0.86 + pulse * 0.12)
      shipScene.flameCore.scale.set(0.92 + pulse * 0.4, 0.8 + pulse * 0.26)
      shipScene.flameInner.scale.set(0.84 + pulse * 0.26, 0.74 + pulse * 0.18)
      shipScene.flameGlow.alpha = 0.24 + pulse * 0.08
      shipScene.flameCore.alpha = 0.46 + pulse * 0.14
      shipScene.flameInner.alpha = 0.2 + pulse * 0.1

      exhaustSwitcher.update(deltaSeconds, elapsedSeconds, {
        originX: shipScene.shipX,
        originY: shipScene.shipY + SHIP_THRUST_DISTANCE,
        directionX: 0,
        directionY: -1,
        pulse,
        scale: EFFECT_SCALE,
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

      keyboard.destroy()
      exhaustSwitcher.destroy()

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
