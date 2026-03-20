import * as PIXI from 'pixi.js'

const createStarPoints = (outerRadius, innerRadius, pointCount = 5) => {
  const points = []
  const step = Math.PI / pointCount
  const startAngle = -Math.PI / 2

  for (let index = 0; index < pointCount * 2; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    const angle = startAngle + step * index
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius)
  }

  return points
}

export const createCoinDisplay = () => {
  const root = new PIXI.Container()
  const shadow = new PIXI.Graphics()
  const front = new PIXI.Container()
  const edge = new PIXI.Graphics()
  const rim = new PIXI.Graphics()
  const face = new PIXI.Graphics()
  const embossShadow = new PIXI.Graphics()
  const star = new PIXI.Graphics()
  const topSheen = new PIXI.Graphics()
  const rimSpark = new PIXI.Graphics()
  const starPoints = createStarPoints(6.7, 3.6)

  shadow.position.set(0, 2.6)
  shadow
    .ellipse(0, 0, 9.8, 3.8)
    .fill({ color: 0x8f5700, alpha: 0.18 })

  edge.position.set(0, 0.1)
  edge
    .roundRect(-3.4, -10.6, 6.8, 21.2, 3.1)
    .fill({ color: 0xcf8400, alpha: 0.98 })
    .stroke({ color: 0xa25d00, width: 1.3, alpha: 0.86 })
  edge
    .roundRect(-1.35, -9.4, 2.7, 18.8, 1.2)
    .fill({ color: 0xf8d068, alpha: 0.7 })
  edge
    .roundRect(1.65, -9.1, 0.95, 18.2, 0.4)
    .fill({ color: 0xa55f00, alpha: 0.4 })

  rim
    .ellipse(0, 0, 12, 12)
    .fill({ color: 0xf0a400, alpha: 1 })
    .stroke({ color: 0xb96b00, width: 1.8, alpha: 0.98 })
  rim
    .ellipse(0, 0.2, 10.3, 10.3)
    .stroke({ color: 0xffd45a, width: 1.3, alpha: 0.95 })
  rim
    .ellipse(0, 1.1, 11.1, 10.4)
    .stroke({ color: 0xcc7f00, width: 1, alpha: 0.38 })

  face
    .ellipse(0, 0, 9.4, 9.2)
    .fill({ color: 0xffd43e, alpha: 1 })
  face
    .ellipse(0, -1.2, 8.6, 6.2)
    .fill({ color: 0xffef8a, alpha: 0.58 })
  face
    .ellipse(0, 2.6, 8.8, 5.2)
    .fill({ color: 0xe39a00, alpha: 0.22 })

  embossShadow.position.set(0.5, 1.1)
  embossShadow
    .poly(starPoints)
    .fill({ color: 0xc47a00, alpha: 0.75 })

  star.position.set(0, -0.1)
  star
    .poly(starPoints)
    .fill({ color: 0xffbf1f, alpha: 1 })
    .stroke({ color: 0xe09600, width: 1.1, alpha: 0.8, join: 'round' })
  star
    .ellipse(0, -2.1, 3.8, 1.7)
    .fill({ color: 0xfff3a2, alpha: 0.42 })

  topSheen.position.set(-2.8, -3.1)
  topSheen
    .ellipse(0, 0, 3.8, 5.4)
    .fill({ color: 0xfff8d6, alpha: 0.55 })
  topSheen
    .ellipse(3.6, 0.4, 1.3, 3.1)
    .fill({ color: 0xfff1a8, alpha: 0.32 })

  rimSpark
    .circle(-5.8, -6.2, 1)
    .fill({ color: 0xffffff, alpha: 0.62 })
  rimSpark
    .ellipse(4.8, 5.2, 1.8, 1.1)
    .fill({ color: 0xe18d00, alpha: 0.28 })

  root.addChild(shadow)
  root.addChild(edge)
  root.addChild(front)
  front.addChild(rim)
  front.addChild(face)
  front.addChild(embossShadow)
  front.addChild(star)
  front.addChild(topSheen)
  front.addChild(rimSpark)

  root.runtime = {
    shadow,
    front,
    edge,
    rim,
    face,
    embossShadow,
    star,
    topSheen,
    rimSpark,
  }

  return root
}

export const animateCoinDisplay = (coin, flip, { pulse = 1, tilt = 0 } = {}) => {
  const runtime = coin?.runtime
  if (!runtime) return

  const faceAmount = Math.abs(flip)
  const sideAmount = 1 - faceAmount
  const frontWidth = 0.08 + faceAmount * 0.92
  const edgeWidth = 0.22 + sideAmount * 1.2

  coin.scale.set(pulse, pulse)
  coin.rotation = tilt

  runtime.front.scale.x = frontWidth
  runtime.front.scale.y = 1 - sideAmount * 0.03
  runtime.front.alpha = 0.2 + faceAmount * 0.8

  runtime.edge.scale.x = edgeWidth
  runtime.edge.scale.y = 0.98 + sideAmount * 0.16
  runtime.edge.alpha = 0.14 + sideAmount * 0.86

  runtime.front.y = -sideAmount * 0.9
  runtime.edge.y = sideAmount * 0.45

  runtime.shadow.scale.x = 0.46 + faceAmount * 0.54
  runtime.shadow.scale.y = 0.82 + sideAmount * 0.18
  runtime.shadow.alpha = 0.16 + sideAmount * 0.14
  runtime.shadow.y = 2.9 + sideAmount * 0.45
}
