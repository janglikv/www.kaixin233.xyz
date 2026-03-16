import * as PIXI from 'pixi.js'

const ENEMY_BULLET_SPEED = 210

const createSharedEnemyBulletAsset = (renderer) => {
  const graphic = new PIXI.Graphics()
  graphic
    .circle(0, 0, 6)
    .fill({ color: 0xff243d, alpha: 0.96 })
    .circle(0, 0, 3)
    .fill({ color: 0xff5b6f, alpha: 0.42 })
    .circle(0, 0, 10)
    .fill({ color: 0x7a0014, alpha: 0.24 })

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

export const createEnemyBulletSystem = (parent, options = {}) => {
  const layer = new PIXI.Container()
  const bullets = []
  const pool = []
  const cooldowns = new Map()
  const onHit = options.onHit ?? (() => {})
  const onFire = options.onFire ?? (() => {})
  const asset = createSharedEnemyBulletAsset(options.renderer)

  parent.addChild(layer)

  const acquireBullet = () => {
    const bullet = pool.pop() ?? {
      display: new PIXI.Sprite(asset.texture),
      x: 0,
      y: 0,
      speed: ENEMY_BULLET_SPEED,
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
          releaseBullet(index)
          continue
        }

        if (bullet.y >= maxY) {
          releaseBullet(index)
        }
      }
    },
    destroy() {
      asset.texture.destroy(true)
      layer.destroy({ children: true })
      bullets.length = 0
      pool.length = 0
      cooldowns.clear()
    },
  }
}
