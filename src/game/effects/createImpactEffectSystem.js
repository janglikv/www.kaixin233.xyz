import * as PIXI from 'pixi.js'

export const createImpactEffectSystem = (parent) => {
  const layer = new PIXI.Container()
  const effects = []

  parent.addChild(layer)

  const spawn = (x, y, options = {}) => {
    const scale = options.scale ?? 1
    const flashOuterColor = options.flashOuterColor ?? 0xffd166
    const flashInnerColor = options.flashInnerColor ?? 0xffffff
    const sparkColors = options.sparkColors ?? [0xffb347, 0x8ed7ff]
    const flash = new PIXI.Graphics()
    flash
      .circle(0, 0, 12 * scale)
      .fill({ color: flashOuterColor, alpha: 0.9 })
      .circle(0, 0, 6 * scale)
      .fill({ color: flashInnerColor, alpha: 0.86 })
    flash.blendMode = 'add'
    flash.position.set(x, y)
    layer.addChild(flash)

    const sparks = []
    for (let index = 0; index < 6; index += 1) {
      const spark = new PIXI.Graphics()
      spark
        .roundRect(-1.5, -6, 3, 12, 2)
        .fill({
          color: sparkColors[index % sparkColors.length],
          alpha: 0.92,
        })
      spark.blendMode = 'add'
      spark.position.set(x, y)
      spark.scale.set(scale)
      layer.addChild(spark)
      sparks.push({
        display: spark,
        velocityX: Math.cos((Math.PI * 2 * index) / 6) * (60 + Math.random() * 40),
        velocityY: Math.sin((Math.PI * 2 * index) / 6) * (60 + Math.random() * 40),
      })
    }

    effects.push({
      flash,
      sparks,
      age: 0,
      life: 0.22,
    })
  }

  return {
    spawn,
    update(deltaSeconds) {
      for (let index = effects.length - 1; index >= 0; index -= 1) {
        const effect = effects[index]
        effect.age += deltaSeconds

        if (effect.age >= effect.life) {
          effect.flash.destroy()
          effect.sparks.forEach((spark) => {
            spark.display.destroy()
          })
          effects.splice(index, 1)
          continue
        }

        const progress = effect.age / effect.life
        const fade = 1 - progress

        effect.flash.scale.set(1 + progress * 1.8)
        effect.flash.alpha = fade * 0.9

        effect.sparks.forEach((spark) => {
          spark.display.position.x += spark.velocityX * deltaSeconds
          spark.display.position.y += spark.velocityY * deltaSeconds
          spark.display.alpha = fade
          spark.display.scale.set(1 - progress * 0.35)
        })
      }
    },
    destroy() {
      layer.destroy({ children: true })
      effects.length = 0
    },
  }
}
