import * as PIXI from 'pixi.js'

const DEFAULT_THEME = {
  wingBase: 0xeaf7ff,
  wingAccent: 0x8cd8ff,
  podBase: 0xbfe8ff,
  hullBase: 0xf1f2f5,
  hullAccent: 0x18c0f4,
  hullHighlight: 0xffffff,
  cockpitBase: 0x03298d,
  cockpitGlow: 0x97ecff,
  cockpitAccent: 0x37d1ff,
  nozzleBase: 0x0079e8,
  nozzleAccent: 0x12c5ff,
  nozzleGlow: 0x96efff,
  outline: 0x0a2d8e,
}

export const createShip = (theme = {}) => {
  const colors = { ...DEFAULT_THEME, ...theme }
  const ship = new PIXI.Container()

  const leftWing = new PIXI.Graphics()
  leftWing
    .poly([
      -22, -10,
      -86, 18,
      -92, 28,
      -38, 62,
      -8, 16,
    ])
    .fill({ color: colors.wingBase, alpha: 1 })
    .stroke({ color: colors.outline, width: 3, alpha: 1 })
  leftWing
    .poly([
      -28, 4,
      -76, 23,
      -82, 31,
      -40, 54,
    ])
    .fill({ color: colors.wingAccent, alpha: 0.95 })
  ship.addChild(leftWing)

  const rightWing = new PIXI.Graphics()
  rightWing
    .poly([
      22, -10,
      86, 18,
      92, 28,
      38, 62,
      8, 16,
    ])
    .fill({ color: colors.wingBase, alpha: 1 })
    .stroke({ color: colors.outline, width: 3, alpha: 1 })
  rightWing
    .poly([
      28, 4,
      76, 23,
      82, 31,
      40, 54,
    ])
    .fill({ color: colors.wingAccent, alpha: 0.95 })
  ship.addChild(rightWing)

  const sidePods = new PIXI.Graphics()
  sidePods
    .roundRect(-52, 6, 18, 38, 10)
    .fill({ color: colors.podBase, alpha: 1 })
    .stroke({ color: colors.outline, width: 3, alpha: 1 })
  sidePods
    .roundRect(34, 6, 18, 38, 10)
    .fill({ color: colors.podBase, alpha: 1 })
    .stroke({ color: colors.outline, width: 3, alpha: 1 })
  ship.addChild(sidePods)

  const hull = new PIXI.Graphics()
  hull
    .poly([
      -12, -60,
      -22, -48,
      -26, 2,
      -20, 42,
      -12, 60,
      10, 58,
      20, 42,
      26, 2,
      22, -48,
      12, -60,
    ])
    .fill({ color: colors.hullBase, alpha: 1 })
    .stroke({ color: colors.outline, width: 3, alpha: 1 })
  hull
    .poly([
      -6, -54,
      -12, -42,
      -14, 6,
      -10, 42,
      10, 42,
      14, 6,
      12, -42,
      6, -54,
    ])
    .fill({ color: colors.hullAccent, alpha: 0.95 })
  hull
    .poly([
      -5, -54,
      -14, -36,
      -6, 36,
      -16, 16,
    ])
    .fill({ color: colors.hullHighlight, alpha: 0.75 })
  ship.addChild(hull)

  const cockpit = new PIXI.Graphics()
  cockpit
    .roundRect(-22, -54, 44, 58, 18)
    .fill({ color: colors.cockpitBase, alpha: 1 })
    .stroke({ color: colors.outline, width: 3, alpha: 1 })
  cockpit
    .ellipse(-2, -30, 10, 18)
    .fill({ color: colors.cockpitGlow, alpha: 0.9 })
  cockpit
    .ellipse(-6, -38, 5, 8)
    .fill({ color: colors.hullHighlight, alpha: 0.7 })
  cockpit
    .ellipse(8, -2, 14, 6)
    .fill({ color: colors.cockpitAccent, alpha: 0.95 })
  ship.addChild(cockpit)

  const nozzle = new PIXI.Graphics()
  nozzle
    .roundRect(-26, 44, 52, 34, 16)
    .fill({ color: colors.nozzleBase, alpha: 1 })
    .stroke({ color: colors.outline, width: 4, alpha: 1 })
  nozzle
    .roundRect(-18, 50, 36, 22, 11)
    .fill({ color: colors.nozzleAccent, alpha: 0.96 })
  nozzle
    .ellipse(0, 60, 16, 6)
    .fill({ color: colors.nozzleGlow, alpha: 0.82 })
  ship.addChild(nozzle)

  const flameGlow = new PIXI.Graphics()
  flameGlow.blendMode = 'add'
  flameGlow
    .ellipse(0, 86, 14, 24)
    .fill({ color: 0xff7e2d, alpha: 0.12 })
    .ellipse(0, 104, 8, 16)
    .fill({ color: 0xffa23e, alpha: 0.16 })
  ship.addChild(flameGlow)

  const flameCore = new PIXI.Graphics()
  flameCore
    .ellipse(0, 78, 7, 14)
    .fill({ color: 0xff9828, alpha: 0.78 })
    .ellipse(0, 96, 5, 20)
    .fill({ color: 0xff651f, alpha: 0.7 })
  flameCore.blendMode = 'add'
  ship.addChild(flameCore)

  const flameInner = new PIXI.Graphics()
  flameInner
    .ellipse(0, 76, 4, 7)
    .fill({ color: 0xffb05a, alpha: 0.42 })
    .ellipse(0, 89, 3, 10)
    .fill({ color: 0xff8d32, alpha: 0.34 })
  flameInner.blendMode = 'add'
  ship.addChild(flameInner)

  return {
    ship,
    flameGlow,
    flameCore,
    flameInner,
  }
}
