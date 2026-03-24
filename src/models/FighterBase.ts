import * as THREE from 'three'

// 材质定义
export const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#71717a', flatShading: true, roughness: 0.85, metalness: 0.1 })
export const whiteMaterial = new THREE.MeshStandardMaterial({ color: '#e2e8f0', flatShading: true, roughness: 0.8, metalness: 0.1 })
export const orangeMaterial = new THREE.MeshStandardMaterial({ color: '#f97316', flatShading: true, roughness: 0.7, metalness: 0.1 })
export const blueMaterial = new THREE.MeshStandardMaterial({ color: '#3b82f6', emissive: '#1d4ed8', emissiveIntensity: 0.3, flatShading: true })
export const darkMaterial = new THREE.MeshStandardMaterial({ color: '#18181b', flatShading: true, roughness: 0.9 })

export const centerGeometry = (geometry: THREE.BufferGeometry) => {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return geometry
  const center = new THREE.Vector3()
  box.getCenter(center)
  geometry.translate(-center.x, -center.y, -center.z)
  return geometry
}

export interface ExhaustParticleSystem {
  points: THREE.Points
  data: any[]
}

const createGlowTexture = () => {
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); gradient.addColorStop(0.2, 'rgba(255, 235, 128, 1)')
  gradient.addColorStop(0.4, 'rgba(255, 100, 0, 0.8)'); gradient.addColorStop(1, 'rgba(255, 0, 0, 0)')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}
const glowTexture = createGlowTexture()

// 通用发动机粒子创建函数
export const createExhaust = (group: THREE.Group, z: number, exhaustList: ExhaustParticleSystem[]) => {
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.8).rotateZ(Math.PI / 2), darkMaterial)
  engine.position.set(2.2, -0.1, z)
  group.add(engine)

  const particleCount = 60
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(particleCount * 3)
  const colors = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = 2.6; positions[i * 3 + 1] = -0.1; positions[i * 3 + 2] = 0
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({ size: 1.1, map: glowTexture, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  const points = new THREE.Points(geometry, material)
  
  points.position.set(0, 0, z)
  group.add(points)

  const particleData = Array.from({ length: particleCount }, () => ({
    x: 2.6 + Math.random() * 0.6, vy: (Math.random() - 0.5) * 0.015, vz: (Math.random() - 0.5) * 0.015, vx: 0.08 + Math.random() * 0.08, life: Math.random()
  }))
  exhaustList.push({ points, data: particleData })
}
