import * as PIXI from 'pixi.js'

// 能量豆系统：负责掉落物生成、吸附与拾取回调
export const createEnergyOrbSystem = (app) => {
  const container = new PIXI.Container()
  container.zIndex = 3000
  app.stage.addChild(container)

  // 当前所有存活能量豆
  const orbs = []

  // 预制能量豆纹理，减少运行期开销
  const shape = new PIXI.Graphics()
  shape
    .ellipse(10, 7, 8, 6)
    .fill({ color: 0x5cf0ff, alpha: 0.95 })
    .stroke({ color: 0xffffff, width: 1.5, alpha: 0.9 })
  shape.circle(7, 5, 2).fill({ color: 0xffffff, alpha: 0.85 })
  const texture = app.renderer.generateTexture(shape)
  shape.destroy()

  // 在屏幕绝对坐标生成能量豆（不随世界滚动偏移）
  const spawn = (screenX, screenY) => {
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.position.set(screenX, screenY)
    sprite.blendMode = 'add'
    container.addChild(sprite)

    orbs.push({
      sprite,
      attracted: false,
      speed: 0,
      bobPhase: Math.random() * Math.PI * 2,
      baseY: screenY,
    })
  }

  // 每帧更新：先漂浮待机，玩家靠近后触发吸附并加速飞向玩家
  const update = (deltaSeconds, heroGlobalPos, onCollected) => {
    const attractRadius = 160
    const pickupRadius = 18
    const maxSpeed = 900
    const accel = 1800

    for (let i = orbs.length - 1; i >= 0; i -= 1) {
      const orb = orbs[i]
      const { sprite } = orb

      const dx = heroGlobalPos.x - sprite.x
      const dy = heroGlobalPos.y - sprite.y
      const dist = Math.hypot(dx, dy)

      // 待机态：轻微上下浮动 + 小角度摆动
      if (!orb.attracted) {
        orb.bobPhase += deltaSeconds * 5
        sprite.y = orb.baseY + Math.sin(orb.bobPhase) * 2.6
        sprite.rotation = Math.sin(orb.bobPhase * 0.7) * 0.14

        if (dist <= attractRadius) {
          orb.attracted = true
          orb.speed = 160
        }
      }

      // 吸附态：持续加速并朝英雄方向追踪
      if (orb.attracted) {
        if (dist <= pickupRadius) {
          container.removeChild(sprite)
          sprite.destroy()
          orbs.splice(i, 1)
          onCollected()
          continue
        }

        const nx = dist > 1e-5 ? dx / dist : 0
        const ny = dist > 1e-5 ? dy / dist : 0
        orb.speed = Math.min(maxSpeed, orb.speed + accel * deltaSeconds)
        sprite.x += nx * orb.speed * deltaSeconds
        sprite.y += ny * orb.speed * deltaSeconds
      }
    }
  }

  return {
    spawn,
    update,
  }
}
