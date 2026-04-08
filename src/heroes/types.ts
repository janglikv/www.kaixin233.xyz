import * as THREE from 'three'

export interface HeroController {
  group: THREE.Group
  collisionRadius: number
  moveSpeed: number
  aimAt(target: THREE.Vector3): void
  tryFire(target: THREE.Vector3): boolean
  update(deltaMs: number): void
}
