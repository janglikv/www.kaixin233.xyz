import * as THREE from 'three'
import type { HeroController } from './types'

type Projectile = {
  mesh: THREE.Group
  direction: THREE.Vector3
  speed: number
  life: number
}

type ParticleCloud = {
  mesh: THREE.Points
  velocities: Float32Array
  life: number
}

type Flash = {
  mesh: THREE.Group
  light: THREE.PointLight
  life: number
}

export function createTankHero(scene: THREE.Scene): HeroController {
  const hero = new THREE.Group()

  const mainRedMat = new THREE.MeshStandardMaterial({ color: '#b71c1c', metalness: 0.6, roughness: 0.4 })
  const lightRedMat = new THREE.MeshStandardMaterial({ color: '#e53935', metalness: 0.4, roughness: 0.5 })
  const armorMat = new THREE.MeshStandardMaterial({ color: '#7f0000', metalness: 0.7, roughness: 0.3 })
  const barrelMat = new THREE.MeshStandardMaterial({ color: '#37474f', metalness: 0.9, roughness: 0.1 })
  const blackMetalMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.8, roughness: 0.2 })
  const glowMat = new THREE.MeshStandardMaterial({ color: '#ff5252', emissive: '#ff1744', emissiveIntensity: 2 })
  const headlightMat = new THREE.MeshStandardMaterial({ color: '#fff9c4', emissive: '#fdd835', emissiveIntensity: 1 })

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.6), mainRedMat)
  chassis.position.y = 0.45
  chassis.castShadow = true
  chassis.receiveShadow = true
  hero.add(chassis)

  const lampGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1)
  const leftLamp = new THREE.Mesh(lampGeo, headlightMat)
  leftLamp.position.set(-0.4, 0.45, 0.8)
  hero.add(leftLamp)
  const rightLamp = new THREE.Mesh(lampGeo, headlightMat)
  rightLamp.position.set(0.4, 0.45, 0.8)
  hero.add(rightLamp)

  const exhaustGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8)
  const leftExhaust = new THREE.Mesh(exhaustGeo, blackMetalMat)
  leftExhaust.rotation.x = -Math.PI / 4
  leftExhaust.position.set(-0.4, 0.6, -0.85)
  hero.add(leftExhaust)
  const rightExhaust = new THREE.Mesh(exhaustGeo, blackMetalMat)
  rightExhaust.rotation.x = -Math.PI / 4
  rightExhaust.position.set(0.4, 0.6, -0.85)
  hero.add(rightExhaust)

  const skirtGeo = new THREE.BoxGeometry(0.15, 0.4, 1.7)
  const boltGeo = new THREE.SphereGeometry(0.04, 8, 8)
  const createSkirt = (side: number) => {
    const skirt = new THREE.Mesh(skirtGeo, armorMat)
    skirt.position.set(0.65 * side, 0.4, 0)
    skirt.castShadow = true
    skirt.receiveShadow = true
    for (let z = -0.7; z <= 0.7; z += 0.35) {
      const bolt = new THREE.Mesh(boltGeo, barrelMat)
      bolt.position.set(0.08 * side, 0.15, z)
      skirt.add(bolt)
    }
    return skirt
  }
  hero.add(createSkirt(1))
  hero.add(createSkirt(-1))

  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16)
  const wheelPositions = [
    [-0.6, 0.35, 0.55], [0.6, 0.35, 0.55],
    [-0.6, 0.35, -0.55], [0.6, 0.35, -0.55],
  ]
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: '#212121' }))
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, y, z)
    wheel.castShadow = true
    wheel.receiveShadow = true
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 8), barrelMat)
    wheel.add(hub)
    hero.add(wheel)
  }

  const turret = new THREE.Group()
  turret.position.y = 0.95
  hero.add(turret)

  const turretBody = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.5, 16), lightRedMat)
  turretBody.castShadow = true
  turretBody.receiveShadow = true
  turret.add(turretBody)

  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 16), armorMat)
  hatch.position.y = 0.3
  turret.add(hatch)

  const antennaGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4)
  const antenna1 = new THREE.Mesh(antennaGeo, blackMetalMat)
  antenna1.position.set(0.3, 0.5, -0.3)
  antenna1.rotation.x = -0.2
  turret.add(antenna1)
  const antenna2 = new THREE.Mesh(antennaGeo, blackMetalMat)
  antenna2.position.set(-0.3, 0.5, -0.3)
  antenna2.rotation.set(-0.2, 0, 0.1)
  turret.add(antenna2)

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), glowMat)
  core.position.set(0, 0.1, 0.5)
  turret.add(core)

  const barrelGroup = new THREE.Group()
  barrelGroup.position.set(0, 0.05, 0.4)
  turret.add(barrelGroup)

  const mainBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.2, 16), barrelMat)
  mainBarrel.rotation.x = Math.PI / 2
  mainBarrel.position.z = 0.6
  mainBarrel.castShadow = true
  mainBarrel.receiveShadow = true
  barrelGroup.add(mainBarrel)

  const ringGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16)
  const ring1 = new THREE.Mesh(ringGeo, blackMetalMat)
  ring1.rotation.x = Math.PI / 2
  ring1.position.z = 0.4
  barrelGroup.add(ring1)
  const ring2 = new THREE.Mesh(ringGeo, blackMetalMat)
  ring2.rotation.x = Math.PI / 2
  ring2.position.z = 0.8
  barrelGroup.add(ring2)

  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16), barrelMat)
  muzzle.rotation.x = Math.PI / 2
  muzzle.position.z = 1.3
  muzzle.castShadow = true
  barrelGroup.add(muzzle)

  const projectiles: Projectile[] = []
  const particles: ParticleCloud[] = []
  const flashes: Flash[] = []

  const FIRE_INTERVAL = 320
  let lastFireTime = -FIRE_INTERVAL
  let barrelRecoil = 0

  const craterTex = createCraterTexture()
  const craterGeo = new THREE.CircleGeometry(1.5, 16)
  const craterMat = new THREE.MeshBasicMaterial({
    map: craterTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  })

  function fireProjectile(target: THREE.Vector3) {
    const muzzleWorldPos = new THREE.Vector3()
    muzzle.getWorldPosition(muzzleWorldPos)

    const targetPos = target.clone()
    const heroPos2 = new THREE.Vector2(hero.position.x, hero.position.z)
    const targetPos2 = new THREE.Vector2(targetPos.x, targetPos.z)
    const diff = new THREE.Vector2().subVectors(targetPos2, heroPos2)
    const distance = diff.length()

    if (distance < 2.5) {
      if (distance < 0.1) {
        const turretWorldDir = new THREE.Vector3(0, 0, 1).applyQuaternion(turret.getWorldQuaternion(new THREE.Quaternion()))
        targetPos.copy(muzzleWorldPos).addScaledVector(turretWorldDir, 5)
      } else {
        diff.normalize().multiplyScalar(2.5)
        targetPos.set(hero.position.x + diff.x, 0, hero.position.z + diff.y)
      }
    }

    const direction = new THREE.Vector3().subVectors(targetPos, muzzleWorldPos).normalize()

    const flashGroup = new THREE.Group()
    flashGroup.position.copy(muzzleWorldPos).addScaledVector(direction, 0.4)
    flashGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)

    const flashCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    )
    flashGroup.add(flashCore)

    const spikeGeo = new THREE.CylinderGeometry(0, 0.1, 0.7, 4)
    spikeGeo.translate(0, 0.35, 0)
    const spikeMat = new THREE.MeshBasicMaterial({
      color: '#ffcc33',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    })
    for (let i = 0; i < 6; i++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat)
      spike.rotation.x = Math.random() * Math.PI * 2
      spike.rotation.z = Math.random() * Math.PI * 2
      spike.scale.set(Math.random() * 0.5 + 0.5, Math.random() * 1.2 + 0.3, Math.random() * 0.5 + 0.5)
      flashGroup.add(spike)
    }

    const flashLight = new THREE.PointLight('#ffcc33', 200, 10)
    flashGroup.add(flashLight)
    scene.add(flashGroup)
    flashes.push({ mesh: flashGroup, light: flashLight, life: 1.0 })

    const sparkCount = 8
    const sparkGeo = new THREE.BufferGeometry()
    const sparkPos = new Float32Array(sparkCount * 3)
    const sparkVels = new Float32Array(sparkCount * 3)
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = muzzleWorldPos.x
      sparkPos[i * 3 + 1] = muzzleWorldPos.y
      sparkPos[i * 3 + 2] = muzzleWorldPos.z
      const spread = 0.3
      sparkVels[i * 3] = (direction.x + (Math.random() - 0.5) * spread) * 0.5
      sparkVels[i * 3 + 1] = (direction.y + (Math.random() - 0.5) * spread) * 0.5
      sparkVels[i * 3 + 2] = (direction.z + (Math.random() - 0.5) * spread) * 0.5
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3))
    const sparkPoints = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({
        color: '#ffeb3b',
        size: 0.15,
        transparent: true,
        blending: THREE.AdditiveBlending,
      }),
    )
    scene.add(sparkPoints)
    particles.push({ mesh: sparkPoints, velocities: sparkVels, life: 1.0 })

    const projGroup = new THREE.Group()
    const projectileCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 12),
      new THREE.MeshStandardMaterial({
        color: '#fff9c4',
        emissive: '#fdd835',
        emissiveIntensity: 3,
        metalness: 0.9,
        roughness: 0.1,
      }),
    )
    projGroup.add(projectileCore)

    const innerTail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.01, 2.5, 8),
      new THREE.MeshBasicMaterial({
        color: '#fff176',
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      }),
    )
    innerTail.rotation.x = Math.PI / 2
    innerTail.position.z = -1.25
    projGroup.add(innerTail)

    const outerTail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.05, 3.0, 8),
      new THREE.MeshBasicMaterial({
        color: '#ff9800',
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
      }),
    )
    outerTail.rotation.x = Math.PI / 2
    outerTail.position.z = -1.5
    projGroup.add(outerTail)

    projGroup.position.copy(muzzleWorldPos).addScaledVector(direction, 0.4)
    projGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction)
    scene.add(projGroup)
    projectiles.push({ mesh: projGroup, direction, speed: 0.22, life: 600 })

    barrelRecoil = 0.35
  }

  function createExplosion(pos: THREE.Vector3) {
    const crater = new THREE.Mesh(craterGeo, craterMat)
    crater.rotation.x = -Math.PI / 2
    crater.position.set(pos.x, 0.03, pos.z)
    crater.rotation.z = Math.random() * Math.PI * 2
    scene.add(crater)

    const explosionGroup = new THREE.Group()
    explosionGroup.position.copy(pos)
    scene.add(explosionGroup)

    const shockwave = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.2, 32),
      new THREE.MeshBasicMaterial({
        color: '#fff59d',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      }),
    )
    shockwave.rotation.x = Math.PI / 2
    shockwave.position.y = 0.1
    explosionGroup.add(shockwave)

    const flashCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }),
    )
    explosionGroup.add(flashCore)

    const spikeGeo = new THREE.CylinderGeometry(0, 0.2, 2.5, 4)
    spikeGeo.translate(0, 1.25, 0)
    const spikeMat = new THREE.MeshBasicMaterial({
      color: '#ffb74d',
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    })
    for (let i = 0; i < 8; i++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat)
      spike.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      spike.scale.set(0.5, 0.2 + Math.random(), 0.5)
      explosionGroup.add(spike)
    }

    const flashLight = new THREE.PointLight('#ffcc33', 200, 15)
    explosionGroup.add(flashLight)
    flashes.push({ mesh: explosionGroup, light: flashLight, life: 1.0 })

    const count = 100
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const color1 = new THREE.Color('#fff176')
    const color2 = new THREE.Color('#e65100')
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x
      positions[i * 3 + 1] = pos.y
      positions[i * 3 + 2] = pos.z
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.5
      const speed = 0.05 + Math.random() * 0.45
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
      velocities[i * 3 + 1] = Math.cos(phi) * speed + 0.05
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed
      const mixedColor = color1.clone().lerp(color2, Math.random())
      colors[i * 3] = mixedColor.r
      colors[i * 3 + 1] = mixedColor.g
      colors[i * 3 + 2] = mixedColor.b
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
      }),
    )
    scene.add(points)
    particles.push({ mesh: points, velocities, life: 1.0 })
  }

  return {
    group: hero,
    collisionRadius: 0.6,
    moveSpeed: 0.03,
    aimAt(target) {
      const turretWorldPos = new THREE.Vector3()
      turret.getWorldPosition(turretWorldPos)
      const angle = Math.atan2(target.x - turretWorldPos.x, target.z - turretWorldPos.z)
      turret.rotation.y = angle - hero.rotation.y
    },
    tryFire(target) {
      const now = performance.now()
      if (now - lastFireTime < FIRE_INTERVAL) return false
      lastFireTime = now
      fireProjectile(target)
      return true
    },
    update() {
      if (barrelRecoil > 0) {
        barrelRecoil *= 0.88
        if (barrelRecoil < 0.001) barrelRecoil = 0
      }
      barrelGroup.position.z = 0.4 - barrelRecoil

      for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i]
        projectile.mesh.position.addScaledVector(projectile.direction, projectile.speed)
        projectile.life--
        if (projectile.mesh.position.y <= 0.1 || projectile.life <= 0) {
          createExplosion(projectile.mesh.position)
          scene.remove(projectile.mesh)
          projectiles.splice(i, 1)
        }
      }

      for (let i = flashes.length - 1; i >= 0; i--) {
        const flash = flashes[i]
        flash.life -= 0.08
        const shockwave = flash.mesh.children[0]
        if (shockwave instanceof THREE.Mesh && shockwave.geometry instanceof THREE.RingGeometry) {
          const scale = 1 + (1 - flash.life) * 15
          shockwave.scale.set(scale, scale, 1)
        }
        flash.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const material = child.material
            if (Array.isArray(material)) {
              for (const item of material) {
                if ('opacity' in item) item.opacity = flash.life
                item.transparent = true
              }
            } else {
              if ('opacity' in material) material.opacity = flash.life
              material.transparent = true
            }
          }
        })
        flash.light.intensity = 200 * flash.life * flash.life
        if (flash.life <= 0) {
          scene.remove(flash.mesh)
          flash.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose()
              const material = child.material
              if (Array.isArray(material)) {
                for (const item of material) item.dispose()
              } else {
                material.dispose()
              }
            }
          })
          flashes.splice(i, 1)
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i]
        particle.life -= 0.02
        const positions = particle.mesh.geometry.attributes.position.array as Float32Array
        for (let j = 0; j < positions.length / 3; j++) {
          positions[j * 3] += particle.velocities[j * 3]
          positions[j * 3 + 1] += particle.velocities[j * 3 + 1]
          positions[j * 3 + 2] += particle.velocities[j * 3 + 2]
          particle.velocities[j * 3 + 1] -= 0.01
          particle.velocities[j * 3] *= 0.95
          particle.velocities[j * 3 + 1] *= 0.95
          particle.velocities[j * 3 + 2] *= 0.95
        }
        particle.mesh.geometry.attributes.position.needsUpdate = true
        const material = particle.mesh.material as THREE.PointsMaterial
        material.opacity = particle.life
        material.transparent = true
        if (particle.life <= 0) {
          scene.remove(particle.mesh)
          particle.mesh.geometry.dispose()
          material.dispose()
          particles.splice(i, 1)
        }
      }
    },
  }
}

function createCraterTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 10, 64, 64, 60)
  gradient.addColorStop(0, 'rgba(20, 15, 10, 0.9)')
  gradient.addColorStop(0.4, 'rgba(40, 30, 20, 0.7)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(10, 5, 0, 0.5)'
  ctx.lineWidth = 2
  for (let i = 0; i < 8; i++) {
    ctx.beginPath()
    ctx.moveTo(64, 64)
    const angle = Math.random() * Math.PI * 2
    const len = 20 + Math.random() * 30
    ctx.lineTo(64 + Math.cos(angle) * len, 64 + Math.sin(angle) * len)
    ctx.stroke()
  }
  return new THREE.CanvasTexture(canvas)
}
