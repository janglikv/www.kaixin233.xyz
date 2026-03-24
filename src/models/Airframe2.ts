import * as THREE from 'three'
import { 
  bodyMaterial, whiteMaterial, orangeMaterial, blueMaterial, 
  centerGeometry, createExhaust
} from './FighterBase'
import type { ExhaustParticleSystem } from './FighterBase'

// 机体 2: 三角翼拦截机
export const createAirframe2 = () => {
  const fighter = new THREE.Group()
  const exhaustParticles: ExhaustParticleSystem[] = []

  // 机身: 更流线型的长机身
  const fuselage = new THREE.Mesh(centerGeometry(new THREE.BoxGeometry(5.0, 0.7, 1.0)), bodyMaterial)
  fighter.add(fuselage)

  // 机头: 更尖锐
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.8, 4).rotateZ(Math.PI / 2).rotateX(Math.PI / 4), whiteMaterial)
  nose.position.set(-3.0, 0, 0); fighter.add(nose)
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 4).rotateZ(Math.PI / 2).rotateX(Math.PI / 4), orangeMaterial)
  tip.position.set(-4.0, 0, 0); fighter.add(tip)

  // 座舱: 更靠后，双座舱感
  const cockpit = new THREE.Mesh(centerGeometry(new THREE.BoxGeometry(1.8, 0.3, 0.6)), blueMaterial)
  cockpit.position.set(-0.2, 0.4, 0); fighter.add(cockpit)

  // 机翼: 巨大的三角翼
  const deltaWingShape = new THREE.Shape()
  deltaWingShape.moveTo(-1.0, 0)      // 前点
  deltaWingShape.lineTo(1.8, 3.2)     // 翼尖
  deltaWingShape.lineTo(2.4, 3.2)     // 翼尖后缘
  deltaWingShape.lineTo(2.0, 0)       // 后点
  
  const wingGeom = new THREE.ExtrudeGeometry(deltaWingShape, { depth: 0.1, bevelEnabled: false }).rotateX(Math.PI / 2)
  const createW = (z: number) => {
    const wGroup = new THREE.Group()
    wGroup.add(new THREE.Mesh(wingGeom, bodyMaterial))
    // 翼尖橙色
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.8), orangeMaterial)
    t.position.set(2.1, 0.01, 3.0); wGroup.add(t)
    wGroup.position.set(0, 0, z); if (z < 0) wGroup.scale.z = -1; fighter.add(wGroup)
  }
  createW(0.4); createW(-0.4)

  // 发动机: 巨大单发
  createExhaust(fighter, 0, exhaustParticles)

  return { fighter, exhaustParticles }
}
