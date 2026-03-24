import * as THREE from 'three'
import { 
  bodyMaterial, orangeMaterial, blueMaterial, 
  centerGeometry, createExhaust
} from './FighterBase'
import type { ExhaustParticleSystem } from './FighterBase'

// 机体 1: 经典战斗机
export const createAirframe1 = () => {
  const fighter = new THREE.Group()
  const exhaustParticles: ExhaustParticleSystem[] = []

  // 机身
  fighter.add(new THREE.Mesh(centerGeometry(new THREE.BoxGeometry(4.2, 0.8, 1.2)), bodyMaterial))
  // 机头
  const nose = new THREE.Mesh(centerGeometry(new THREE.BoxGeometry(1.0, 1.0, 1.0)).rotateY(Math.PI / 4), bodyMaterial)
  nose.position.set(-2.4, 0, 0); nose.scale.set(1.8, 0.75, 0.75); fighter.add(nose)
  // 座舱
  const cockpit = new THREE.Mesh(centerGeometry(new THREE.BoxGeometry(1.6, 0.35, 0.7)), blueMaterial)
  cockpit.position.set(-0.6, 0.45, 0); cockpit.rotation.z = -0.05; fighter.add(cockpit)

  // 进气道
  const i1 = new THREE.Mesh(centerGeometry(new THREE.BoxGeometry(1.4, 0.7, 0.5)), bodyMaterial); i1.position.set(-0.5, -0.1, 0.7); fighter.add(i1)
  const i2 = new THREE.Mesh(centerGeometry(new THREE.BoxGeometry(1.4, 0.7, 0.5)), bodyMaterial); i2.position.set(-0.5, -0.1, -0.7); fighter.add(i2)

  // 机翼
  const wingGeom = new THREE.ExtrudeGeometry(new THREE.Shape().moveTo(0, 0).lineTo(-1.2, 0).lineTo(0.8, 2.8).lineTo(1.8, 2.8).lineTo(1.2, 0), { depth: 0.1, bevelEnabled: false }).rotateX(Math.PI / 2)
  const createW = (z: number) => {
    const wGroup = new THREE.Group()
    wGroup.add(new THREE.Mesh(wingGeom, bodyMaterial))
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 1.0), orangeMaterial)
    t.position.set(1.4, 0.01, 2.6); t.rotation.y = 0.4; wGroup.add(t)
    wGroup.position.set(0.2, 0, z); if (z < 0) wGroup.scale.z = -1; fighter.add(wGroup)
  }
  createW(0.6); createW(-0.6)

  // 尾翼
  const finGeom = new THREE.ExtrudeGeometry(new THREE.Shape().moveTo(0.6, 0).lineTo(-0.6, 0).lineTo(0.2, 1.8).lineTo(0.8, 1.8).lineTo(0.6, 0), { depth: 0.08, bevelEnabled: false })
  const createF = (z: number) => {
    const f = new THREE.Mesh(finGeom, bodyMaterial); f.position.set(1.8, 0.4, z); f.rotation.x = z > 0 ? 0.25 : -0.25
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.12), orangeMaterial); cap.position.set(0.5, 1.75, 0.04); f.add(cap); fighter.add(f)
  }
  createF(0.5); createF(-0.5)
  // 发动机
  createExhaust(fighter, 0.35, exhaustParticles); createExhaust(fighter, -0.35, exhaustParticles)

  return { fighter, exhaustParticles }
}
