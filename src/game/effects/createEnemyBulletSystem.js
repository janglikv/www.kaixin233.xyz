import * as PIXI from 'pixi.js'

const ENEMY_BULLET_SPEED = 420

export const createEnemyBulletSystem = (parent, options = {}) => {
  const layer = new PIXI.Container()
  const bullets = []
  const cooldowns = new Map()
  const onHit = options.onHit ?? (() => {})

  parent.addChild(layer)

  const spawnBullet = (x, y) => {
    const bullet = new PIXI.Graphics()
    bullet
      .roundRect(-2.5, -4, 5, 18, 2)
      .fill({ color: 0xffb36b, alpha: 0.96 })
      .roundRect(-1.5, -8, 3, 8, 2)
      .fill({ color: 0xfff1cf, alpha: 0.92 })
      .ellipse(0, 10, 6, 9)
      .fill({ color: 0xff6b35, alpha: 0.24 })
    bullet.blendMode = 'add'
    bullet.position.set(x, y)
    layer.addChild(bullet)

    bullets.push({
      display: bullet,
      x,
      y,
      speed: ENEMY_BULLET_SPEED,
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
      {
        shooters = [],
        fireInterval = 0.5,
        target = null,
        maxY = 760,
      } = {},
    ) {
      cooldowns.forEach((value, key) => {
        cooldowns.set(key, value - deltaSeconds)
      })

      shooters.forEach((shooter) => {
        const nextCooldown = cooldowns.get(shooter.id) ?? 0
        if (nextCooldown > 0) return

        cooldowns.set(shooter.id, fireInterval)
        spawnBullet(shooter.x, shooter.y)
      })

      for (let index = bullets.length - 1; index >= 0; index -= 1) {
        const bullet = bullets[index]
        bullet.y += bullet.speed * deltaSeconds
        bullet.display.position.set(bullet.x, bullet.y)

        if (
          target &&
          bullet.x >= target.left &&
          bullet.x <= target.right &&
          bullet.y >= target.top &&
          bullet.y <= target.bottom
        ) {
          onHit({ x: bullet.x, y: bullet.y })
          removeBullet(index)
          continue
        }

        if (bullet.y >= maxY) {
          removeBullet(index)
        }
      }
    },
    destroy() {
      layer.destroy({ children: true })
      bullets.length = 0
      cooldowns.clear()
    },
  }
}
