import * as PIXI from 'pixi.js'

const createSharedBulletAsset = (renderer) => {
  const graphic = new PIXI.Graphics()
  graphic
    .roundRect(-3, -18, 6, 24, 3)
    .fill({ color: 0x9ee9ff, alpha: 0.96 })
    .roundRect(-2, -24, 4, 10, 2)
    .fill({ color: 0xffffff, alpha: 0.92 })
    .ellipse(0, 8, 7, 10)
    .fill({ color: 0x2d7dff, alpha: 0.24 })

  const bounds = graphic.getLocalBounds()
  graphic.position.set(-bounds.x, -bounds.y)

  const wrapper = new PIXI.Container()
  wrapper.addChild(graphic)

  return {
    texture: renderer.generateTexture(wrapper),
    anchorX: -bounds.x / bounds.width,
    anchorY: -bounds.y / bounds.height,
  }
}

export const createBulletSystem = (parent, options = {}) => {
  const layer = new PIXI.Container()
  const bullets = []
  const pool = []
  let cooldown = 0
  const onHit = options.onHit ?? (() => {})
  const onFire = options.onFire ?? (() => {})
  const asset = createSharedBulletAsset(options.renderer)

  parent.addChild(layer)

  const acquireBullet = () => {
    const bullet = pool.pop() ?? {
      display: new PIXI.Sprite(asset.texture),
      x: 0,
      y: 0,
      speed: 780,
    }

    bullet.display.anchor.set(asset.anchorX, asset.anchorY)
    bullet.display.blendMode = 'add'
    bullet.display.visible = true
    if (!bullet.display.parent) {
      layer.addChild(bullet.display)
    }
    return bullet
  }

  const spawnBullet = (x, y) => {
    const bullet = acquireBullet()
    bullet.x = x
    bullet.y = y
    bullet.display.position.set(x, y)
    bullets.push(bullet)
  }

  const releaseBullet = (index) => {
    const bullet = bullets[index]
    bullet.display.visible = false
    bullets.splice(index, 1)
    pool.push(bullet)
  }

  return {
    update(
      deltaSeconds,
      { shouldFire, originX, originY, minY = -40, targets = [], fireInterval = 0.09 },
    ) {
      cooldown -= deltaSeconds

      if (shouldFire && fireInterval > 0) {
        while (cooldown <= 0) {
          cooldown += fireInterval
          spawnBullet(originX, originY)
          onFire({ x: originX, y: originY })
        }
      } else if (!shouldFire) {
        cooldown = Math.min(cooldown, 0)
      }

      if (shouldFire && fireInterval <= 0) {
        cooldown = 0
        spawnBullet(originX, originY)
        onFire({ x: originX, y: originY })
      }

      for (let index = bullets.length - 1; index >= 0; index -= 1) {
        const bullet = bullets[index]
        bullet.y -= bullet.speed * deltaSeconds
        bullet.display.position.set(bullet.x, bullet.y)

        const hitTarget = targets.find((target) => {
          return (
            bullet.x >= target.left &&
            bullet.x <= target.right &&
            bullet.y >= target.top &&
            bullet.y <= target.bottom
          )
        })

        if (hitTarget) {
          onHit({ x: bullet.x, y: bullet.y, target: hitTarget })
          releaseBullet(index)
          continue
        }

        if (bullet.y <= minY) {
          releaseBullet(index)
        }
      }
    },
    destroy() {
      asset.texture.destroy(true)
      layer.destroy({ children: true })
      bullets.length = 0
      pool.length = 0
    },
  }
}
