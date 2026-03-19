import * as PIXI from 'pixi.js'

export const createGameSceneRuntime = ({
  app,
  width,
  height,
  worldInset = 0,
  worldRadius = 0,
}) => {
  let layoutScale = 1
  let layoutOffsetX = 0
  let layoutOffsetY = 0

  const gameLayer = new PIXI.Container()
  const worldLayer = new PIXI.Container()
  const gameOverLayer = new PIXI.Container()
  const worldMask = new PIXI.Graphics()

  worldMask
    .roundRect(
      worldInset,
      worldInset,
      width - worldInset * 2,
      height - worldInset * 2,
      worldRadius,
    )
    .fill(0xffffff)

  worldLayer.mask = worldMask

  gameLayer.addChild(worldLayer)
  gameLayer.addChild(worldMask)
  gameLayer.addChild(gameOverLayer)
  app.stage.addChild(gameLayer)

  const layout = () => {
    layoutScale = Math.min(app.renderer.width / width, app.renderer.height / height)
    layoutOffsetX = (app.renderer.width - width * layoutScale) * 0.5
    layoutOffsetY = (app.renderer.height - height * layoutScale) * 0.5
    gameLayer.scale.set(layoutScale)
    gameLayer.position.set(layoutOffsetX, layoutOffsetY)
  }

  return {
    gameLayer,
    worldLayer,
    gameOverLayer,
    layout,
    toLogicalPoint(clientX, clientY, rect) {
      return {
        x: (clientX - rect.left - layoutOffsetX) / layoutScale,
        y: (clientY - rect.top - layoutOffsetY) / layoutScale,
      }
    },
    toViewportRect(logicalX, logicalY, logicalWidth, logicalHeight, rect) {
      return {
        left: rect.left + layoutOffsetX + logicalX * layoutScale,
        top: rect.top + layoutOffsetY + logicalY * layoutScale,
        width: logicalWidth * layoutScale,
        height: logicalHeight * layoutScale,
      }
    },
    destroy() {
      gameLayer.destroy({ children: true })
    },
  }
}
