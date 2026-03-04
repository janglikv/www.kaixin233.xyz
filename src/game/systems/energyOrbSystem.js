import * as PIXI from 'pixi.js'

// 能量豆系统：负责掉落物生成、吸附与拾取回调
export const createEnergyOrbSystem = (app, worldLayer) => {
  const container = new PIXI.Container()
  // 保持在世界层较低层级：低于敌机/子弹，但高于星空底板
  container.zIndex = -90
  worldLayer.addChild(container)

  // 当前所有存活能量豆
  const orbs = []

  // 预制能量豆纹理：core(实体点) + glow(外发光)
  const coreShape = new PIXI.Graphics()
  coreShape.circle(7, 7, 5).fill({ color: 0xffdf6b, alpha: 0.98 })
  coreShape.circle(5.4, 5.2, 1.6).fill({ color: 0xffffff, alpha: 0.95 })
  const coreTexture = app.renderer.generateTexture(coreShape)
  coreShape.destroy()

  const glowShape = new PIXI.Graphics()
  glowShape.circle(14, 14, 13).fill({ color: 0xffb300, alpha: 0.16 })
  glowShape.circle(14, 14, 9).fill({ color: 0xffd54f, alpha: 0.34 })
  const glowTexture = app.renderer.generateTexture(glowShape)
  glowShape.destroy()

  // 在屏幕绝对坐标生成能量豆（不随世界滚动偏移）
  const spawn = (screenX, screenY) => {
    const node = new PIXI.Container()
    node.position.set(screenX, screenY)

    const glow = new PIXI.Sprite(glowTexture)
    glow.anchor.set(0.5)
    glow.alpha = 1
    glow.scale.set(1.28)
    glow.blendMode = 'add'
    node.addChild(glow)

    const core = new PIXI.Sprite(coreTexture)
    core.anchor.set(0.5)
    core.scale.set(1.15)
    core.blendMode = 'add'
    node.addChild(core)

    container.addChild(node)

    orbs.push({
      node,
      core,
      glow,
      attracted: false,
      speed: 0,
      bobPhase: Math.random() * Math.PI * 2,
      baseY: screenY,
      pulsePhase: Math.random() * Math.PI * 2,
      baseCoreScale: 1.15,
      baseGlowScale: 1.28,
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
      const { node, core, glow } = orb

      const dx = heroGlobalPos.x - node.x
      const dy = heroGlobalPos.y - node.y
      const dist = Math.hypot(dx, dy)

      // 待机态：轻微上下浮动 + 小角度摆动
      if (!orb.attracted) {
        orb.bobPhase += deltaSeconds * 5
        orb.pulsePhase += deltaSeconds * 10.5
        node.y = orb.baseY + Math.sin(orb.bobPhase) * 2.6
        node.rotation = Math.sin(orb.bobPhase * 0.7) * 0.14
        const pulse = (Math.sin(orb.pulsePhase) + 1) * 0.5
        const neon = (Math.sin(orb.pulsePhase * 1.35 + 1.1) + 1) * 0.5
        glow.alpha = 0.62 + pulse * 1.05
        glow.scale.set(orb.baseGlowScale * (0.9 + pulse * 0.42))
        core.alpha = 0.9 + pulse * 0.14
        core.scale.set(orb.baseCoreScale * (0.94 + pulse * 0.16))
        glow.tint = neon > 0.5 ? 0xff7a00 : 0xffe35c
        core.tint = neon > 0.5 ? 0xffcf5a : 0xfff3a8

        if (dist <= attractRadius) {
          orb.attracted = true
          orb.speed = 160
        }
      }

      // 吸附态：持续加速并朝英雄方向追踪
      if (orb.attracted) {
        if (dist <= pickupRadius) {
          container.removeChild(node)
          node.destroy({ children: true })
          orbs.splice(i, 1)
          onCollected()
          continue
        }

        const nx = dist > 1e-5 ? dx / dist : 0
        const ny = dist > 1e-5 ? dy / dist : 0
        orb.speed = Math.min(maxSpeed, orb.speed + accel * deltaSeconds)
        node.x += nx * orb.speed * deltaSeconds
        node.y += ny * orb.speed * deltaSeconds
        glow.alpha = 1
        core.alpha = 1
        glow.tint = 0xffa000
        core.tint = 0xffef8c
      }
    }
  }

  return {
    spawn,
    update,
  }
}
