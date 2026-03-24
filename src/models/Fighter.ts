import * as THREE from 'three'

export const bodyMaterial = new THREE.MeshStandardMaterial({
  color: '#71717a', // 灰色机身
  flatShading: true,
  roughness: 0.85,
  metalness: 0.1,
})

export const whiteMaterial = new THREE.MeshStandardMaterial({
  color: '#e2e8f0', // 白色涂装
  flatShading: true,
  roughness: 0.8,
  metalness: 0.1,
})

export const orangeMaterial = new THREE.MeshStandardMaterial({
  color: '#f97316', // 橙色装饰
  flatShading: true,
  roughness: 0.7,
  metalness: 0.1,
})

export const blueMaterial = new THREE.MeshStandardMaterial({
  color: '#3b82f6', // 蓝色座舱
  emissive: '#1d4ed8',
  emissiveIntensity: 0.3,
  flatShading: true,
})

export const darkMaterial = new THREE.MeshStandardMaterial({
  color: '#18181b', // 深色/发动机
  flatShading: true,
  roughness: 0.9,
})

export const engineMaterial = new THREE.MeshBasicMaterial({
  color: '#fbbf24', // 引擎橙黄光
})

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

export const createFighter = (accentColor: string = '#f97316') => {
  const fighter = new THREE.Group()

  const currentOrangeMaterial = new THREE.MeshStandardMaterial({
    color: accentColor, 
    flatShading: true,
    roughness: 0.7,
    metalness: 0.1,
  })

  // 1. 创建发光粒子贴图 (Canvas generated glow)
  const createGlowTexture = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.2, 'rgba(255, 235, 128, 1)')
    gradient.addColorStop(0.4, 'rgba(255, 100, 0, 0.8)')
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(canvas)
  }
  const glowTexture = createGlowTexture()

  // 2. 机身主体 (Fuselage)
  const fuselage = new THREE.Mesh(
    centerGeometry(new THREE.BoxGeometry(4.2, 0.8, 1.2)),
    bodyMaterial,
  )
  fighter.add(fuselage)

  // 3. 机头 (Nose)
  const noseBase = new THREE.Mesh(
    centerGeometry(new THREE.BoxGeometry(1.0, 1.0, 1.0)).rotateY(Math.PI / 4),
    whiteMaterial,
  )
  noseBase.position.set(-2.4, 0, 0)
  noseBase.scale.set(1.8, 0.75, 0.75)
  fighter.add(noseBase)

  const noseTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.38, 1.2, 4).rotateZ(Math.PI / 2).rotateX(Math.PI / 4),
    currentOrangeMaterial,
  )
  noseTip.position.set(-3.7, 0, 0)
  fighter.add(noseTip)

  // 4. 座舱 (Cockpit) - 调低、调扁
  const cockpit = new THREE.Mesh(
    centerGeometry(new THREE.BoxGeometry(1.6, 0.35, 0.7)), // 变长 1.6, 变矮 0.35
    blueMaterial,
  )
  cockpit.position.set(-0.8, 0.55, 0) // 向下移动并微调位置
  cockpit.rotation.z = 0.05
  fighter.add(cockpit)

  // 5. 进气道 (Intakes)
  const createIntake = (z: number) => {
    const intake = new THREE.Mesh(
      centerGeometry(new THREE.BoxGeometry(1.4, 0.7, 0.5)),
      darkMaterial,
    )
    intake.position.set(-0.5, -0.1, z)
    fighter.add(intake)
  }
  createIntake(0.7)
  createIntake(-0.7)

  // 6. 主机翼 (Main Wings)
  const wingShape = new THREE.Shape()
  wingShape.moveTo(0, 0)
  wingShape.lineTo(-1.2, 0)
  wingShape.lineTo(0.8, 2.8)
  wingShape.lineTo(1.8, 2.8)
  wingShape.lineTo(1.2, 0)

  const wingGeom = new THREE.ExtrudeGeometry(wingShape, { depth: 0.1, bevelEnabled: false })
  wingGeom.rotateX(Math.PI / 2)

  const createWing = (z: number) => {
    const wingGroup = new THREE.Group()
    const wing = new THREE.Mesh(wingGeom, bodyMaterial)
    wingGroup.add(wing)

    const tip = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.12, 1.0),
      currentOrangeMaterial,
    )
    tip.position.set(1.4, 0.01, 2.6)
    tip.rotation.y = 0.4
    wingGroup.add(tip)

    const createMissile = (pos: THREE.Vector3) => {
      const missile = new THREE.Group()
      // 材质改为机身灰色 (bodyMaterial)
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9).rotateZ(Math.PI / 2), bodyMaterial)
      // 修正弹头朝向: 指向 -X 方向
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8).rotateZ(Math.PI / 2), currentOrangeMaterial)
      head.position.x = -0.55 // 紧贴缩短后的主体
      missile.add(body, head)
      missile.position.copy(pos)
      wingGroup.add(missile)
    }
    // 微调挂载点以匹配更短的导弹
    // 内侧 (Z=1.3)
    createMissile(new THREE.Vector3(0.0, -0.2, 1.3))
    // 外侧 (Z=2.1)
    createMissile(new THREE.Vector3(0.6, -0.2, 2.1))

    wingGroup.position.set(0.2, 0, z)
    if (z < 0) wingGroup.scale.z = -1
    fighter.add(wingGroup)
  }
  createWing(0.6)
  createWing(-0.6)

  // 7. 后平尾 (Rear Wings)
  const rearWingGeom = centerGeometry(new THREE.BoxGeometry(0.8, 0.08, 1.4))
  const createRearWing = (z: number) => {
    const rw = new THREE.Mesh(rearWingGeom, bodyMaterial)
    rw.position.set(2.4, -0.1, z)
    fighter.add(rw)
  }
  createRearWing(1.2)
  createRearWing(-1.2)

  // 8. 双垂尾 (Vertical Fins)
  const finShape = new THREE.Shape()
  finShape.moveTo(0.6, 0)
  finShape.lineTo(-0.6, 0)
  finShape.lineTo(0.2, 1.8)
  finShape.lineTo(0.8, 1.8)
  finShape.lineTo(0.6, 0)

  const finGeom = new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: false })
  const createFin = (z: number) => {
    const fin = new THREE.Mesh(finGeom, bodyMaterial)
    fin.position.set(1.8, 0.4, z) 
    fin.rotation.x = z > 0 ? 0.25 : -0.25 
    
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.12), currentOrangeMaterial)
    cap.position.set(0.5, 1.75, 0.04)
    fin.add(cap)
    fighter.add(fin)
  }
  createFin(0.5)
  createFin(-0.5)

  // 9. 双发动机与粒子尾焰
  const exhaustParticles: ExhaustParticleSystem[] = []
  const createEngine = (z: number) => {
    const engine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.38, 0.8).rotateZ(Math.PI / 2),
      darkMaterial,
    )
    engine.position.set(2.2, -0.1, z)
    fighter.add(engine)

    const particleCount = 80
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 2.6
      positions[i * 3 + 1] = -0.1
      positions[i * 3 + 2] = z
      sizes[i] = 1.0
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.PointsMaterial({
      size: 1.1,
      map: glowTexture, 
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
    })

    const points = new THREE.Points(geometry, material)
    fighter.add(points)

    const particleData = Array.from({ length: particleCount }, () => ({
      x: 2.6 + Math.random() * 0.6,
      vy: (Math.random() - 0.5) * 0.015,
      vz: (Math.random() - 0.5) * 0.015,
      vx: 0.08 + Math.random() * 0.08,
      life: Math.random(),
    }))

    exhaustParticles.push({ points, data: particleData })
  }
  createEngine(0.35)
  createEngine(-0.35)

  return { fighter, exhaustParticles }
}

