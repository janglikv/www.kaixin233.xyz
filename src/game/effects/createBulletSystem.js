import * as PIXI from 'pixi.js'

export const createBulletSystem = (parent, options = {}) => {
  const layer = new PIXI.Container()
  const bullets = []
  let cooldown = 0
  const onHit = options.onHit ?? (() => {})

  parent.addChild(layer)

  const spawnBullet = (x, y) => {
    const bullet = new PIXI.Graphics()
    bullet
      .roundRect(-3, -18, 6, 24, 3)
      .fill({ color: 0x9ee9ff, alpha: 0.96 })
      .roundRect(-2, -24, 4, 10, 2)
      .fill({ color: 0xffffff, alpha: 0.92 })
      .ellipse(0, 8, 7, 10)
      .fill({ color: 0x2d7dff, alpha: 0.24 })
    bullet.blendMode = 'add'
    bullet.position.set(x, y)
    layer.addChild(bullet)

    bullets.push({
      display: bullet,
      x,
      y,
      speed: 780,
    })
  }

  const removeBullet = (index) => {
    const bullet = bullets[index]
    layer.removeChild(bullet.display)
    bullet.display.destroy()
    bullets.splice(index, 1)
  }

  return {
    update(
      deltaSeconds,
      { shouldFire, originX, originY, minY = -40, targets = [], fireInterval = 0.09 },
    ) {
      cooldown -= deltaSeconds

      if (shouldFire && cooldown <= 0) {
        cooldown = fireInterval
        spawnBullet(originX, originY)
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
          removeBullet(index)
          continue
        }

        if (bullet.y <= minY) {
          removeBullet(index)
        }
      }
    },
    destroy() {
      layer.destroy({ children: true })
      bullets.length = 0
    },
  }
}
