import * as THREE from 'three'
import type { HeroController } from './types'

export function createEzrealHero(_scene: THREE.Scene): HeroController {
  const hero = new THREE.Group()

  const skinMat = new THREE.MeshStandardMaterial({ color: '#e4bc97', roughness: 0.9 })
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#273043', roughness: 0.45 })
  const hairMat = new THREE.MeshStandardMaterial({ color: '#cfa24f', roughness: 0.55 })
  const clothLightMat = new THREE.MeshStandardMaterial({ color: '#d7dce3', roughness: 0.72 })
  const clothDarkMat = new THREE.MeshStandardMaterial({ color: '#596985', roughness: 0.82 })
  const bootMat = new THREE.MeshStandardMaterial({ color: '#58453a', roughness: 0.9 })
  const soleMat = new THREE.MeshStandardMaterial({ color: '#2d2522', roughness: 1 })
  const leatherMat = new THREE.MeshStandardMaterial({ color: '#6a5447', roughness: 0.72, metalness: 0.05 })

  const hipsPivot = new THREE.Group()
  hipsPivot.position.y = 0.92
  hero.add(hipsPivot)

  const hips = createPart(new THREE.BoxGeometry(0.54, 0.24, 0.3), clothDarkMat)
  hipsPivot.add(hips)

  const spinePivot = new THREE.Group()
  spinePivot.position.y = 0.14
  hipsPivot.add(spinePivot)

  const abdomen = createPart(new THREE.BoxGeometry(0.46, 0.32, 0.28), clothDarkMat)
  abdomen.position.y = 0.16
  spinePivot.add(abdomen)

  const chestPivot = new THREE.Group()
  chestPivot.position.y = 0.3
  spinePivot.add(chestPivot)

  const chest = createPart(new THREE.BoxGeometry(0.66, 0.52, 0.34), clothLightMat)
  chest.position.y = 0.26
  chestPivot.add(chest)

  const shoulders = createPart(new THREE.BoxGeometry(0.8, 0.14, 0.26), clothLightMat)
  shoulders.position.y = 0.48
  chestPivot.add(shoulders)

  const neckPivot = new THREE.Group()
  neckPivot.position.y = 0.56
  chestPivot.add(neckPivot)

  const neck = createPart(new THREE.BoxGeometry(0.14, 0.14, 0.14), skinMat)
  neck.position.y = 0.08
  neckPivot.add(neck)

  const headPivot = new THREE.Group()
  headPivot.position.y = 0.14
  neckPivot.add(headPivot)

  const head = createPart(new THREE.BoxGeometry(0.36, 0.4, 0.32), skinMat)
  head.position.set(0, 0.22, 0)
  headPivot.add(head)

  const leftEye = createPart(new THREE.BoxGeometry(0.055, 0.02, 0.015), eyeMat)
  leftEye.position.set(-0.075, 0.21, 0.168)
  headPivot.add(leftEye)
  const rightEye = createPart(new THREE.BoxGeometry(0.055, 0.02, 0.015), eyeMat)
  rightEye.position.set(0.075, 0.21, 0.168)
  headPivot.add(rightEye)

  const hairTop = createPart(new THREE.BoxGeometry(0.4, 0.14, 0.34), hairMat)
  hairTop.position.set(0.02, 0.44, -0.01)
  headPivot.add(hairTop)

  const hairBack = createPart(new THREE.BoxGeometry(0.3, 0.16, 0.12), hairMat)
  hairBack.position.set(-0.01, 0.28, -0.12)
  headPivot.add(hairBack)

  const fringe = createPart(new THREE.BoxGeometry(0.12, 0.12, 0.06), hairMat)
  fringe.position.set(0.08, 0.3, 0.1)
  fringe.rotation.z = -0.22
  headPivot.add(fringe)

  const sideBang = createPart(new THREE.BoxGeometry(0.06, 0.12, 0.05), hairMat)
  sideBang.position.set(-0.09, 0.25, 0.08)
  sideBang.rotation.z = 0.14
  headPivot.add(sideBang)

  const leftArm = createArm(-1, chestPivot, clothLightMat, skinMat)
  const rightArm = createArm(1, chestPivot, clothLightMat, skinMat)
  const leftLeg = createLeg(-1, hipsPivot, clothDarkMat, bootMat, soleMat, leatherMat)
  const rightLeg = createLeg(1, hipsPivot, clothDarkMat, bootMat, soleMat, leatherMat)

  let walkCycle = 0
  let walkBlend = 0
  const lastPosition = hero.position.clone()

  return {
    group: hero,
    collisionRadius: 0.34,
    moveSpeed: 0.0267,
    aimAt() {},
    tryFire() {
      return false
    },
    update(deltaMs) {
      const movedDistance = hero.position.distanceTo(lastPosition)
      lastPosition.copy(hero.position)

      const isMoving = movedDistance > 0.0005
      const blendTarget = isMoving ? 1 : 0
      walkBlend += (blendTarget - walkBlend) * 0.18

      if (isMoving) {
        const strideSpeed = THREE.MathUtils.clamp(movedDistance * 170, 0.55, 1.45)
        walkCycle += (deltaMs / 1000) * 4.8 * strideSpeed
      }

      const leftPhase = walkCycle
      const rightPhase = walkCycle + Math.PI

      const leftStride = Math.sin(leftPhase)
      const rightStride = Math.sin(rightPhase)
      const leftLift = Math.max(0, Math.sin(leftPhase - 0.45))
      const rightLift = Math.max(0, Math.sin(rightPhase - 0.45))
      const leftPlant = Math.max(0, Math.sin(leftPhase + 0.9))
      const rightPlant = Math.max(0, Math.sin(rightPhase + 0.9))

      const bodyBob = (0.012 + 0.012 * Math.cos(walkCycle * 2)) * walkBlend
      const hipSway = Math.sin(walkCycle) * 0.045 * walkBlend
      const hipTwist = Math.sin(walkCycle) * 0.09 * walkBlend
      const chestTwist = -hipTwist * 0.55
      const chestLean = 0.04 * walkBlend
      const armSwing = Math.sin(walkCycle) * 0.22 * walkBlend

      hipsPivot.position.y = 0.92 - bodyBob
      hipsPivot.position.x = hipSway
      hipsPivot.rotation.y = hipTwist
      hipsPivot.rotation.z = hipSway * 0.55

      spinePivot.rotation.x = -chestLean
      spinePivot.rotation.y = -hipTwist * 0.2
      spinePivot.rotation.z = -hipSway * 0.18
      chestPivot.rotation.y = chestTwist
      chestPivot.rotation.z = -hipSway * 0.26
      headPivot.rotation.y = -chestTwist * 0.35
      headPivot.rotation.z = hipSway * 0.12

      leftLeg.hipPivot.rotation.x = leftStride * 0.34 * walkBlend + leftLift * 0.08 * walkBlend
      rightLeg.hipPivot.rotation.x = rightStride * 0.34 * walkBlend + rightLift * 0.08 * walkBlend
      leftLeg.hipPivot.rotation.z = -hipSway * 0.22
      rightLeg.hipPivot.rotation.z = -hipSway * 0.22

      leftLeg.kneePivot.rotation.x = leftLift * 0.52 * walkBlend + Math.max(0, -leftStride) * 0.12 * walkBlend
      rightLeg.kneePivot.rotation.x = rightLift * 0.52 * walkBlend + Math.max(0, -rightStride) * 0.12 * walkBlend

      leftLeg.anklePivot.rotation.x = leftPlant * 0.16 * walkBlend - leftLift * 0.3 * walkBlend - leftStride * 0.08 * walkBlend
      rightLeg.anklePivot.rotation.x = rightPlant * 0.16 * walkBlend - rightLift * 0.3 * walkBlend - rightStride * 0.08 * walkBlend
      leftLeg.anklePivot.rotation.z = hipSway * 0.12
      rightLeg.anklePivot.rotation.z = hipSway * 0.12

      leftArm.shoulderPivot.rotation.x = -armSwing - chestLean * 0.3
      rightArm.shoulderPivot.rotation.x = armSwing - chestLean * 0.3
      leftArm.shoulderPivot.rotation.z = 0.08 - chestTwist * 0.15
      rightArm.shoulderPivot.rotation.z = -0.08 - chestTwist * 0.15
      leftArm.elbowPivot.rotation.x = 0.12 + Math.max(0, armSwing) * 0.18
      rightArm.elbowPivot.rotation.x = 0.12 + Math.max(0, -armSwing) * 0.18
      leftArm.handPivot.rotation.x = -0.05 + armSwing * 0.08
      rightArm.handPivot.rotation.x = -0.05 - armSwing * 0.08
    },
  }
}

function createArm(
  side: 1 | -1,
  parent: THREE.Object3D,
  sleeveMat: THREE.Material,
  skinMat: THREE.Material,
) {
  const shoulderPivot = new THREE.Group()
  shoulderPivot.position.set(0.38 * side, 0.44, 0)
  parent.add(shoulderPivot)

  const upperArm = createPart(new THREE.BoxGeometry(0.16, 0.38, 0.16), sleeveMat)
  upperArm.position.y = -0.19
  upperArm.position.x = 0.02 * side
  shoulderPivot.add(upperArm)

  const elbowPivot = new THREE.Group()
  elbowPivot.position.y = -0.38
  shoulderPivot.add(elbowPivot)

  const lowerArm = createPart(new THREE.BoxGeometry(0.14, 0.36, 0.14), skinMat)
  lowerArm.position.y = -0.18
  elbowPivot.add(lowerArm)

  const handPivot = new THREE.Group()
  handPivot.position.y = -0.36
  elbowPivot.add(handPivot)

  const hand = createPart(new THREE.BoxGeometry(0.14, 0.12, 0.16), skinMat)
  hand.position.set(0, -0.06, 0.01)
  handPivot.add(hand)

  shoulderPivot.rotation.z = side === 1 ? -0.08 : 0.08

  return { shoulderPivot, elbowPivot, handPivot }
}

function createLeg(
  side: 1 | -1,
  parent: THREE.Object3D,
  pantsMat: THREE.Material,
  bootMat: THREE.Material,
  soleMat: THREE.Material,
  leatherMat: THREE.Material,
) {
  const hipPivot = new THREE.Group()
  hipPivot.position.set(0.13 * side, -0.08, 0)
  parent.add(hipPivot)

  const upperLeg = createPart(new THREE.BoxGeometry(0.2, 0.46, 0.2), pantsMat)
  upperLeg.position.y = -0.23
  hipPivot.add(upperLeg)

  const kneePivot = new THREE.Group()
  kneePivot.position.y = -0.46
  hipPivot.add(kneePivot)

  const lowerLeg = createPart(new THREE.BoxGeometry(0.18, 0.42, 0.18), pantsMat)
  lowerLeg.position.y = -0.16
  kneePivot.add(lowerLeg)

  const anklePivot = new THREE.Group()
  anklePivot.position.y = -0.32
  kneePivot.add(anklePivot)

  const bootRoot = new THREE.Group()
  bootRoot.position.set(0, -0.01, 0.04)
  anklePivot.add(bootRoot)

  const sole = createPart(new THREE.BoxGeometry(0.22, 0.05, 0.36), soleMat)
  sole.position.set(0, -0.085, 0.08)
  bootRoot.add(sole)

  const midsole = createPart(new THREE.BoxGeometry(0.2, 0.025, 0.32), bootMat)
  midsole.position.set(0, -0.045, 0.075)
  bootRoot.add(midsole)

  const upper = createPart(new THREE.BoxGeometry(0.18, 0.13, 0.22), leatherMat)
  upper.position.set(0, -0.005, 0.025)
  bootRoot.add(upper)

  const vamp = createPart(new THREE.BoxGeometry(0.17, 0.08, 0.16), leatherMat)
  vamp.position.set(0, 0.005, 0.11)
  vamp.rotation.x = -0.1
  bootRoot.add(vamp)

  const toe = createPart(new THREE.CapsuleGeometry(0.07, 0.08, 4, 8), leatherMat)
  toe.rotation.z = Math.PI / 2
  toe.position.set(0, -0.03, 0.18)
  bootRoot.add(toe)

  const heel = createPart(new THREE.BoxGeometry(0.16, 0.14, 0.1), bootMat)
  heel.position.set(0, -0.015, -0.06)
  bootRoot.add(heel)

  const tongue = createPart(new THREE.BoxGeometry(0.1, 0.07, 0.12), bootMat)
  tongue.position.set(0, 0.035, 0.06)
  tongue.rotation.x = 0.18
  bootRoot.add(tongue)

  const cuff = createPart(new THREE.BoxGeometry(0.2, 0.07, 0.16), bootMat)
  cuff.position.set(0, 0.075, -0.015)
  bootRoot.add(cuff)

  return { hipPivot, kneePivot, anklePivot }
}

function createPart(geometry: THREE.BufferGeometry, material: THREE.Material) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
