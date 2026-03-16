import * as PIXI from 'pixi.js'

const ENEMY_BULLET_SPEED = 210

export const createEnemyBulletSystem = (parent, options = {}) => {
  const layer = new PIXI.Container()
  const bullets = []
  const cooldowns = new Map()
  const onHit = options.onHit ?? (() => {})
  const onFire = options.onFire ?? (() => {})

  parent.addChild(layer)

  const spawnBullet = (x, y) => {
    const bullet = new PIXI.Graphics()
    bullet
      .circle(0, 0, 6)
      .fill({ color: 0xff243d, alpha: 0.96 })
      .circle(0, 0, 3)
      .fill({ color: 0xff5b6f, alpha: 0.42 })
      .circle(0, 0, 10)
      .fill({ color: 0x7a0014, alpha: 0.24 })
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
        onFire({ x: shooter.x, y: shooter.y, shooter })
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
