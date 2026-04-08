import './style.css'
import * as THREE from 'three'
import { createEzrealHero } from './heroes/ezreal'
import { createTankHero } from './heroes/tank'
import type { HeroController } from './heroes/types'

type ModelId = 'ezreal' | 'tank'

type PersistedUiState = {
  settingsOpen: boolean
  activeTab: 'models'
  previewModelId: ModelId | null
}

const UI_STATE_STORAGE_KEY = 'kaixin233:model-preview-state:v1'
const HUD_BASE_WIDTH = 1440
const HUD_BASE_HEIGHT = 900

const MAP_CONFIG = {
  pathWidth: 16,
  fieldWidth: 70,
  length: 250,
  grassCount: 132000,
}

const scene = new THREE.Scene()
scene.background = new THREE.Color('#87ceeb')

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 2000)

let zoomLevel = 0.4
let cameraTheta = Math.PI * 0.25
let cameraPhi = 25 * (Math.PI / 180)
const baseDistance = 50
const MIN_ZOOM = 0.1
const MAX_ZOOM = 0.4
const cameraOffset = new THREE.Vector3()

function updateCameraOffset() {
  const dist = baseDistance * zoomLevel
  cameraOffset.set(
    dist * Math.sin(cameraPhi) * Math.sin(cameraTheta),
    dist * Math.cos(cameraPhi),
    dist * Math.sin(cameraPhi) * Math.cos(cameraTheta),
  )
}
updateCameraOffset()

const mouseNDC = new THREE.Vector2(0, 0)
const mouseFollowOffset = new THREE.Vector3()
const targetMouseFollowOffset = new THREE.Vector3()
let isRotating = false
let isMouseFiring = false

window.addEventListener('mousedown', (event) => {
  if (isUiTarget(event.target)) return
  if (event.button === 2) isRotating = true
  if (event.button === 0) isMouseFiring = true
})
window.addEventListener('mouseup', (event) => {
  if (isUiTarget(event.target)) return
  if (event.button === 2) isRotating = false
  if (event.button === 0) isMouseFiring = false
})
window.addEventListener('mousemove', (event) => {
  mouseNDC.x = (event.clientX / window.innerWidth) * 2 - 1
  mouseNDC.y = -(event.clientY / window.innerHeight) * 2 + 1

  if (isRotating) {
    const sensitivity = 0.005
    cameraTheta -= event.movementX * sensitivity
    cameraPhi -= event.movementY * sensitivity
    cameraPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, cameraPhi))
    updateCameraOffset()
  }
})
window.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
    const zoomDelta = event.deltaY * 0.0006
    zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + zoomDelta))
    updateCameraOffset()
  },
  { passive: false },
)
window.addEventListener('contextmenu', (event) => event.preventDefault())
window.addEventListener('blur', () => {
  isMouseFiring = false
  keys[' '] = false
})

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
const appRoot = document.querySelector<HTMLDivElement>('#app')!
appRoot.appendChild(renderer.domElement)

function createDirtTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#2d241e'
  ctx.fillRect(0, 0, 512, 512)

  const colors = ['#6d5c52', '#5d4c41', '#796a5f', '#54473e']
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]
      ctx.fillRect(i * 32 + 1, j * 32 + 1, 30, 30)
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.1})`
      ctx.fillRect(i * 32 + 2, j * 32 + 2, 28, 28)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(MAP_CONFIG.fieldWidth / 15, MAP_CONFIG.length / 15)
  return texture
}

const dirtTex = createDirtTexture()
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(MAP_CONFIG.fieldWidth, MAP_CONFIG.length),
  new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1, metalness: 0 }),
)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

const grassFieldGeo = new THREE.PlaneGeometry((MAP_CONFIG.fieldWidth - MAP_CONFIG.pathWidth) / 2, MAP_CONFIG.length)
const grassFieldMat = new THREE.MeshStandardMaterial({ color: '#1b301b', roughness: 1 })
const leftField = new THREE.Mesh(grassFieldGeo, grassFieldMat)
leftField.rotation.x = -Math.PI / 2
leftField.position.set(-(MAP_CONFIG.fieldWidth / 2 + MAP_CONFIG.pathWidth / 2) / 2, 0.02, 0)
leftField.receiveShadow = true
scene.add(leftField)
const rightField = new THREE.Mesh(grassFieldGeo, grassFieldMat)
rightField.rotation.x = -Math.PI / 2
rightField.position.set((MAP_CONFIG.fieldWidth / 2 + MAP_CONFIG.pathWidth / 2) / 2, 0.02, 0)
rightField.receiveShadow = true
scene.add(rightField)

const bladeGeo = new THREE.ConeGeometry(0.2, 1.6, 3)
bladeGeo.translate(0, 0.8, 0)
const grassMat = new THREE.MeshStandardMaterial({ color: '#2d5a27', side: THREE.DoubleSide })
const grassUniforms = { uTime: { value: 0 } }
grassMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = grassUniforms.uTime
  shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    float h = position.y;
    float sway = sin(uTime * 2.0 + instanceMatrix[3][0] * 0.5 + instanceMatrix[3][2] * 0.5) * h * 0.1;
    transformed.x += sway;
    transformed.z += sway * 0.4;`,
  )
}

const instancedGrass = new THREE.InstancedMesh(bladeGeo, grassMat, MAP_CONFIG.grassCount)
const dummy = new THREE.Object3D()
for (let i = 0; i < MAP_CONFIG.grassCount; i++) {
  let x = (Math.random() - 0.5) * MAP_CONFIG.fieldWidth
  const z = (Math.random() - 0.5) * MAP_CONFIG.length
  if (Math.abs(x) < MAP_CONFIG.pathWidth / 2) {
    x = (MAP_CONFIG.pathWidth / 2 + Math.random() * 1.5) * (x > 0 ? 1 : -1)
  }
  dummy.position.set(x, 0, z)
  const s = 0.5 + Math.random() * 1.8
  dummy.scale.set(1.6, s, 1.6)
  dummy.rotation.y = Math.random() * Math.PI
  dummy.rotation.z = (Math.random() - 0.5) * 0.8
  dummy.rotation.x = (Math.random() - 0.5) * 0.8
  dummy.updateMatrix()
  instancedGrass.setMatrixAt(i, dummy.matrix)
  const color = new THREE.Color().setHSL(0.24 + Math.random() * 0.1, 0.4, 0.2 + Math.random() * 0.25)
  instancedGrass.setColorAt(i, color)
}
instancedGrass.castShadow = true
instancedGrass.receiveShadow = true
scene.add(instancedGrass)

const heroFactories: Record<ModelId, () => HeroController> = {
  ezreal: () => createEzrealHero(scene),
  tank: () => createTankHero(scene),
}

const activeHero = heroFactories.ezreal()
scene.add(activeHero.group)

let previewHero: HeroController | null = null
let previewLookHeight = 1.2
let previewDistance = 10

const persistedUiState = loadPersistedUiState()
const uiState: PersistedUiState = {
  settingsOpen: persistedUiState.previewModelId ? true : persistedUiState.settingsOpen,
  activeTab: persistedUiState.activeTab,
  previewModelId: persistedUiState.previewModelId,
}

const hudRoot = document.createElement('div')
hudRoot.className = 'hud-root'
hudRoot.innerHTML = `
  <div class="hud-stage">
    <button class="settings-toggle" type="button" aria-label="打开设置">
      <span class="settings-toggle-label">系统设置</span>
      <span class="settings-toggle-hint">F10</span>
    </button>
    <section class="settings-panel" aria-label="设置面板">
      <div class="settings-shell">
        <div class="settings-head">
          <div>
            <h2>设置</h2>
            <p class="preview-status">未预览模型</p>
          </div>
          <button class="settings-close" type="button" aria-label="关闭设置">×</button>
        </div>
        <div class="settings-body">
          <div class="settings-pane is-active" data-pane="models">
            <div class="settings-toolbar">
              <button class="settings-tab is-active" type="button" data-tab="models">模型</button>
              <button class="preview-exit" type="button">退出预览</button>
            </div>
            <div class="model-list">
              <button class="model-card" type="button" data-model="ezreal">
                <span class="model-name">Ezreal</span>
                <span class="model-meta">人物模型</span>
              </button>
              <button class="model-card" type="button" data-model="tank">
                <span class="model-name">Tank</span>
                <span class="model-meta">炮车模型</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
`
appRoot.appendChild(hudRoot)
updateHudScale()

const settingsToggleButton = hudRoot.querySelector<HTMLButtonElement>('.settings-toggle')!
const settingsPanel = hudRoot.querySelector<HTMLElement>('.settings-panel')!
const settingsCloseButton = hudRoot.querySelector<HTMLButtonElement>('.settings-close')!
const previewStatus = hudRoot.querySelector<HTMLElement>('.preview-status')!
const previewExitButton = hudRoot.querySelector<HTMLButtonElement>('.preview-exit')!
const modelButtons = Array.from(hudRoot.querySelectorAll<HTMLButtonElement>('.model-card'))

settingsToggleButton.addEventListener('click', () => {
  uiState.settingsOpen = !uiState.settingsOpen
  persistUiState()
  renderHud()
})

settingsCloseButton.addEventListener('click', () => {
  uiState.settingsOpen = false
  persistUiState()
  renderHud()
})

previewExitButton.addEventListener('click', () => {
  setPreviewModel(null)
})

for (const button of modelButtons) {
  button.addEventListener('click', () => {
    const modelId = button.dataset.model as ModelId
    setPreviewModel(modelId)
  })
}

const raycaster = new THREE.Raycaster()
const mouseWorldPoint = new THREE.Vector3(0, 0, 8)
const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false, ' ': false }

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && uiState.settingsOpen) {
    uiState.settingsOpen = false
    persistUiState()
    renderHud()
    return
  }
  if (isUiTarget(event.target)) return
  const key = event.key.toLowerCase()
  if (!(key in keys)) return
  if (uiState.previewModelId) return
  if (key === ' ' && !keys[' ']) activeHero.tryFire(mouseWorldPoint)
  keys[key] = true
})
window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase()
  if (key in keys) keys[key] = false
})

scene.add(new THREE.AmbientLight('#ffffff', 0.5))

const sunLight = new THREE.DirectionalLight('#fffce0', 1.8)
sunLight.position.set(-40, 60, -20)
sunLight.castShadow = true
sunLight.shadow.bias = -0.002
sunLight.shadow.camera.left = -50
sunLight.shadow.camera.right = 50
sunLight.shadow.camera.top = 50
sunLight.shadow.camera.bottom = -50
sunLight.shadow.camera.near = 0.5
sunLight.shadow.camera.far = 200
sunLight.shadow.mapSize.set(1024, 1024)
scene.add(sunLight)

const clock = new THREE.Clock()
const moveDir = new THREE.Vector3()
let heroTurnVelocity = 0
const HERO_TURN_ACCEL = 0.012
const HERO_TURN_DAMPING = 0.84
const HERO_MAX_TURN_SPEED = 0.14

function animate() {
  requestAnimationFrame(animate)

  const deltaMs = clock.getDelta() * 1000
  grassUniforms.uTime.value += deltaMs / 1000

  if (previewHero) {
    previewHero.update(deltaMs)
    previewHero.group.rotation.y += deltaMs * 0.0006
  } else {
    moveDir.set(0, 0, 0)
    if (keys.w) moveDir.z -= 1
    if (keys.s) moveDir.z += 1
    if (keys.a) moveDir.x -= 1
    if (keys.d) moveDir.x += 1

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize()
      const targetRotation = Math.atan2(moveDir.x, moveDir.z)
      let deltaRotation = targetRotation - activeHero.group.rotation.y
      while (deltaRotation < -Math.PI) deltaRotation += Math.PI * 2
      while (deltaRotation > Math.PI) deltaRotation -= Math.PI * 2
      heroTurnVelocity += deltaRotation * HERO_TURN_ACCEL
      heroTurnVelocity = THREE.MathUtils.clamp(heroTurnVelocity, -HERO_MAX_TURN_SPEED, HERO_MAX_TURN_SPEED)
      activeHero.group.position.addScaledVector(moveDir, activeHero.moveSpeed)
    } else {
      heroTurnVelocity *= 0.92
    }

    heroTurnVelocity *= HERO_TURN_DAMPING
    if (Math.abs(heroTurnVelocity) < 0.0002) heroTurnVelocity = 0
    activeHero.group.rotation.y += heroTurnVelocity

    const boundaryX = MAP_CONFIG.pathWidth / 2 - activeHero.collisionRadius
    const boundaryZ = MAP_CONFIG.length / 2 - activeHero.collisionRadius
    activeHero.group.position.x = Math.max(-boundaryX, Math.min(boundaryX, activeHero.group.position.x))
    activeHero.group.position.z = Math.max(-boundaryZ, Math.min(boundaryZ, activeHero.group.position.z))

    raycaster.setFromCamera(mouseNDC, camera)
    const intersects = raycaster.intersectObject(ground)
    if (intersects.length > 0) {
      mouseWorldPoint.copy(intersects[0].point)
    }

    activeHero.aimAt(mouseWorldPoint)
    if (keys[' '] || isMouseFiring) activeHero.tryFire(mouseWorldPoint)
    activeHero.update(deltaMs)

    const maxMouseOffset = 12 * zoomLevel
    targetMouseFollowOffset.set(mouseNDC.x * maxMouseOffset, 0, -mouseNDC.y * maxMouseOffset)
    targetMouseFollowOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraTheta)
    mouseFollowOffset.lerp(targetMouseFollowOffset, 0.05)

    camera.position.set(
      activeHero.group.position.x + cameraOffset.x + mouseFollowOffset.x,
      activeHero.group.position.y + cameraOffset.y + mouseFollowOffset.y,
      activeHero.group.position.z + cameraOffset.z + mouseFollowOffset.z,
    )
    camera.lookAt(
      activeHero.group.position.x + mouseFollowOffset.x,
      activeHero.group.position.y + 1.2,
      activeHero.group.position.z + mouseFollowOffset.z,
    )

    sunLight.position.set(activeHero.group.position.x - 40, 60, activeHero.group.position.z - 20)
    sunLight.target.position.copy(activeHero.group.position)
  }

  if (previewHero) {
    const previewOffset = createOrbitOffset(previewDistance)
    camera.position.set(
      previewHero.group.position.x + previewOffset.x,
      previewHero.group.position.y + previewOffset.y,
      previewHero.group.position.z + previewOffset.z,
    )
    camera.lookAt(
      previewHero.group.position.x,
      previewHero.group.position.y + previewLookHeight,
      previewHero.group.position.z,
    )

    sunLight.position.set(previewHero.group.position.x - 18, 34, previewHero.group.position.z + 10)
    sunLight.target.position.copy(previewHero.group.position)
  }
  sunLight.target.updateMatrixWorld()

  renderer.render(scene, camera)
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  updateHudScale()
})

function createOrbitOffset(distance: number) {
  return new THREE.Vector3(
    distance * Math.sin(cameraPhi) * Math.sin(cameraTheta),
    distance * Math.cos(cameraPhi),
    distance * Math.sin(cameraPhi) * Math.cos(cameraTheta),
  )
}

function updateHudScale() {
  const hudScale = Math.min(window.innerWidth / HUD_BASE_WIDTH, window.innerHeight / HUD_BASE_HEIGHT)
  const scaledWidth = HUD_BASE_WIDTH * hudScale
  const scaledHeight = HUD_BASE_HEIGHT * hudScale
  const offsetX = (window.innerWidth - scaledWidth) * 0.5
  const offsetY = (window.innerHeight - scaledHeight) * 0.5
  const hudStage = hudRoot.querySelector<HTMLElement>('.hud-stage')

  hudRoot.style.width = `${window.innerWidth}px`
  hudRoot.style.height = `${window.innerHeight}px`

  if (!hudStage) return

  hudStage.style.width = `${HUD_BASE_WIDTH}px`
  hudStage.style.height = `${HUD_BASE_HEIGHT}px`
  hudStage.style.left = `${offsetX}px`
  hudStage.style.top = `${offsetY}px`
  hudStage.style.transform = `scale(${hudScale})`
}

function isUiTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest('.hud-root') !== null
}

function loadPersistedUiState(): PersistedUiState {
  try {
    const raw = localStorage.getItem(UI_STATE_STORAGE_KEY)
    if (!raw) {
      return { settingsOpen: false, activeTab: 'models', previewModelId: null }
    }
    const parsed = JSON.parse(raw) as Partial<PersistedUiState>
    return {
      settingsOpen: typeof parsed.settingsOpen === 'boolean' ? parsed.settingsOpen : false,
      activeTab: parsed.activeTab === 'models' ? 'models' : 'models',
      previewModelId: parsed.previewModelId === 'ezreal' || parsed.previewModelId === 'tank' ? parsed.previewModelId : null,
    }
  } catch {
    return { settingsOpen: false, activeTab: 'models', previewModelId: null }
  }
}

function persistUiState() {
  localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(uiState))
}

function setPreviewModel(modelId: ModelId | null) {
  if (previewHero) {
    scene.remove(previewHero.group)
    previewHero = null
  }

  uiState.previewModelId = modelId
  uiState.settingsOpen = modelId ? true : uiState.settingsOpen

  if (modelId) {
    previewHero = heroFactories[modelId]()
    previewHero.group.position.set(0, 0, 0)
    previewHero.group.rotation.set(0, Math.PI * 0.15, 0)
    scene.add(previewHero.group)
    applyPreviewBounds(previewHero.group)
    activeHero.group.visible = false
    isMouseFiring = false
    keys[' '] = false
  } else {
    activeHero.group.visible = true
  }

  persistUiState()
  renderHud()
}

function applyPreviewBounds(group: THREE.Group) {
  const bounds = new THREE.Box3().setFromObject(group)
  const size = new THREE.Vector3()
  bounds.getSize(size)
  previewLookHeight = Math.max(0.8, size.y * 0.42)
  previewDistance = Math.max(4.5, Math.max(size.x, size.y, size.z) * 2.4)
}

function renderHud() {
  hudRoot.classList.toggle('is-open', uiState.settingsOpen)
  settingsPanel.toggleAttribute('hidden', !uiState.settingsOpen)

  const previewLabel = uiState.previewModelId ? `预览中 ${uiState.previewModelId.toUpperCase()}` : '未预览模型'
  previewStatus.textContent = previewLabel
  previewExitButton.disabled = uiState.previewModelId === null

  for (const button of modelButtons) {
    const isSelected = button.dataset.model === uiState.previewModelId
    button.classList.toggle('is-selected', isSelected)
  }
}

renderHud()
if (uiState.previewModelId) {
  setPreviewModel(uiState.previewModelId)
}

animate()
