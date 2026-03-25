import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createAirframe1 } from './models/Airframe1'
import { createAirframe2 } from './models/Airframe2'
import type { ExhaustParticleSystem } from './models/FighterBase'

// 1. 机体配置
const AIRFRAMES = [
  { id: 'frame1', name: '机体1', factory: createAirframe1 },
  { id: 'frame2', name: '机体2', factory: createAirframe2 },
]
const VIEW_MODES = [
  { id: 'preview', name: '预览' },
  { id: 'game', name: '游戏' },
] as const

type ViewMode = typeof VIEW_MODES[number]['id']
const PREVIEW_SCENE_SCALE = 1
const GAME_SCENE_SCALE = 0.35
const EXHAUST_BASE_SIZE = 5.0  // 大幅增加基础尺寸以还原厚实感
const GAME_BANK_ANGLE = 0.52
const GAME_BANK_LERP = 0.16


// 2. 状态变量
let currentFrameId = localStorage.getItem('selectedFrame') || AIRFRAMES[0].id
let currentViewMode = (localStorage.getItem('viewMode') as ViewMode | null) || 'preview'
let activeFighter: THREE.Group | null = null
let activeExhaust: ExhaustParticleSystem[] = []
let currentGameBank = 0
const keysPressed: Record<string, boolean> = {}

window.addEventListener('keydown', (e) => { keysPressed[e.key.toLowerCase()] = true })
window.addEventListener('keyup', (e) => { keysPressed[e.key.toLowerCase()] = false })

// 3. 基础场景设置
const scene = new THREE.Scene()
scene.background = new THREE.Color('#07111f')
scene.fog = new THREE.Fog('#0d1930', 20, 50)
const sceneContent = new THREE.Group()
scene.add(sceneContent)

// 边界可视化 (添加到 scene，由 handleResize 动态更新几何)
const boundaryBox = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff0000 }))
boundaryBox.visible = false
scene.add(boundaryBox)

const aspect = window.innerWidth / window.innerHeight
const frustumSize = 25
const camera = new THREE.OrthographicCamera(
  frustumSize * aspect / -2, frustumSize * aspect / 2,
  frustumSize / 2, frustumSize / -2,
  0.1, 1000
)
camera.position.set(0, 10, 0)
camera.up.set(-1, 0, 0)
camera.lookAt(0, 0, 0)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true; controls.dampingFactor = 0.05
controls.minDistance = 10; controls.maxDistance = 40
controls.enableRotate = false // 禁用旋转以保持 2D 视角


const syncCameraMode = () => {
  const isGameMode = currentViewMode === 'game'
  controls.enabled = !isGameMode
  
  if (isGameMode) {
    camera.up.set(-1, 0, 0)
    camera.position.set(0, 10, 0)
    camera.zoom = 1
  } else {
    camera.up.set(0, 1, 0)
    camera.position.set(6, 4, 12)
    camera.zoom = 1 // 预览模式可以根据需要调整 zoom
  }

  controls.target.set(0, 0, 0)
  camera.lookAt(controls.target)
  camera.updateProjectionMatrix()
  controls.update()
}

// 4. 切换机体函数
const loadFrame = (id: string) => {
  if (activeFighter) sceneContent.remove(activeFighter)
  
  const config = AIRFRAMES.find(f => f.id === id) || AIRFRAMES[0]
  const { fighter, exhaustParticles } = config.factory()
  
  fighter.scale.setScalar(1.2)
  sceneContent.add(fighter)
  
  activeFighter = fighter
  activeExhaust = exhaustParticles
  currentFrameId = id
  localStorage.setItem('selectedFrame', id)
  
  syncExhaustVisualScale()
  syncFighterOrientation()
  updateUI()
}

// 5. 创建 UI
const ui = document.createElement('div')
ui.className = 'model-selector'
document.body.appendChild(ui)

const modeToggle = document.createElement('div')
modeToggle.className = 'view-mode-toggle'
document.body.appendChild(modeToggle)

const fpsPanel = document.createElement('div')
fpsPanel.className = 'fps-panel'
fpsPanel.textContent = 'FPS 0'
document.body.appendChild(fpsPanel)

const syncExhaustVisualScale = () => {
  const isGameMode = currentViewMode === 'game'
  // 在游戏模式下，虽然场景缩小了，但我们要维持粒子的视觉厚度
  const exhaustScale = isGameMode ? GAME_SCENE_SCALE * 1.5 : PREVIEW_SCENE_SCALE
  
  activeExhaust.forEach((sys) => {
    const material = sys.points.material as THREE.PointsMaterial
    material.size = EXHAUST_BASE_SIZE * exhaustScale
    material.needsUpdate = true
  })
}

const syncFighterOrientation = () => {
  if (!activeFighter) return
  // 游戏模式下绕机头方向滚转，做出压机翼的侧倾效果
  activeFighter.rotation.set(0, 0, 0)
  activeFighter.rotation.x = currentViewMode === 'game' ? currentGameBank : 0
}

const applyViewMode = () => {
  const isGameMode = currentViewMode === 'game'
  ui.classList.toggle('is-hidden', isGameMode)
  sceneContent.scale.setScalar(isGameMode ? GAME_SCENE_SCALE : PREVIEW_SCENE_SCALE)
  
  // 边界可视化开关
  boundaryBox.visible = isGameMode

  if (activeFighter) {
    activeFighter.position.set(0, 0, 0)
  }
  currentGameBank = 0

  syncExhaustVisualScale()
  syncFighterOrientation()
  syncCameraMode()
  localStorage.setItem('viewMode', currentViewMode)
}

const updateUI = () => {
  ui.innerHTML = `
    <div class="ui-title">机体</div>
    ${AIRFRAMES.map(f => `
      <div class="ui-item ${f.id === currentFrameId ? 'active' : ''}" data-id="${f.id}">
        <span class="frame-icon">✈</span>
        ${f.name}
      </div>
    `).join('')}
  `
  ui.querySelectorAll('.ui-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id')
      if (id) loadFrame(id)
    })
  })
}

const updateModeToggle = () => {
  modeToggle.innerHTML = VIEW_MODES.map(mode => `
    <button class="mode-chip ${mode.id === currentViewMode ? 'active' : ''}" data-mode="${mode.id}" type="button">
      ${mode.name}
    </button>
  `).join('')

  modeToggle.querySelectorAll<HTMLButtonElement>('.mode-chip').forEach(button => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode as ViewMode | undefined
      if (!mode || mode === currentViewMode) return
      currentViewMode = mode
      applyViewMode()
      updateModeToggle()
    })
  })
}

scene.add(new THREE.AmbientLight('#7e9bcb', 1.2))
const moonLight = new THREE.DirectionalLight('#d8e8ff', 1.75); moonLight.position.set(-6,8,6); scene.add(moonLight)
const rimLight = new THREE.DirectionalLight('#45b8ff', 1.2); rimLight.position.set(8,1,-8); scene.add(rimLight)

loadFrame(currentFrameId)
updateModeToggle()
applyViewMode()

// 边界状态
let screenBoundX = 12.5
let screenBoundZ = 12.5
let lastFpsSampleTime = performance.now()
let frameCount = 0

const handleResize = () => {
  const w = window.innerWidth; const h = window.innerHeight
  const aspect = w / h
  const frustumSize = 25
  
  camera.left = -frustumSize * aspect / 2
  camera.right = frustumSize * aspect / 2
  camera.top = frustumSize / 2
  camera.bottom = -frustumSize / 2
  camera.updateProjectionMatrix()
  
  // 更新边界数值
  screenBoundX = frustumSize / 2
  screenBoundZ = (frustumSize * aspect) / 2

  // 更新红框几何体
  const pts = [
    new THREE.Vector3(-screenBoundX, 0, -screenBoundZ),
    new THREE.Vector3(screenBoundX, 0, -screenBoundZ),
    new THREE.Vector3(screenBoundX, 0, screenBoundZ),
    new THREE.Vector3(-screenBoundX, 0, screenBoundZ),
    new THREE.Vector3(-screenBoundX, 0, -screenBoundZ)
  ]
  boundaryBox.geometry.setFromPoints(pts)
  
  renderer.setSize(w, h)
  const uiScale = Math.max(0.6, Math.min(1.4, w / 1440))
  document.documentElement.style.setProperty('--ui-scale', uiScale.toString())
}
window.addEventListener('resize', handleResize); handleResize()

const render = () => {
  const elapsed = performance.now() * 0.001
  frameCount += 1
  const now = performance.now()
  if (now - lastFpsSampleTime >= 250) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsSampleTime))
    fpsPanel.textContent = `FPS ${fps}`
    frameCount = 0
    lastFpsSampleTime = now
  }

  if (activeFighter) {
    if (currentViewMode === 'game') {
      // WASD 移动逻辑
      const speed = 0.4
      if (keysPressed['w'] || keysPressed['arrowup']) activeFighter.position.x -= speed
      if (keysPressed['s'] || keysPressed['arrowdown']) activeFighter.position.x += speed
      if (keysPressed['a'] || keysPressed['arrowleft']) activeFighter.position.z += speed
      if (keysPressed['d'] || keysPressed['arrowright']) activeFighter.position.z -= speed

      const movingLeft = keysPressed['a'] || keysPressed['arrowleft']
      const movingRight = keysPressed['d'] || keysPressed['arrowright']
      const targetBank = movingLeft === movingRight ? 0 : movingLeft ? GAME_BANK_ANGLE : -GAME_BANK_ANGLE
      currentGameBank += (targetBank - currentGameBank) * GAME_BANK_LERP

      // 动态边界限制 (留出一点边距)
      const margin = 1.2
      const limitX = screenBoundX / GAME_SCENE_SCALE - margin
      const limitZ = screenBoundZ / GAME_SCENE_SCALE - margin
      activeFighter.position.x = Math.max(-limitX, Math.min(limitX, activeFighter.position.x))
      activeFighter.position.z = Math.max(-limitZ, Math.min(limitZ, activeFighter.position.z))

      activeFighter.position.y = 0
      activeFighter.rotation.set(currentGameBank, 0, 0)
    } else {
      currentGameBank = 0
      activeFighter.position.y = Math.sin(elapsed * 0.5) * 0.15
      activeFighter.rotation.x = 0
      activeFighter.rotation.y = 0
      activeFighter.rotation.z = Math.sin(elapsed * 0.3) * 0.05
    }
  }
  activeExhaust.forEach((sys) => {
    const pos = sys.points.geometry.attributes.position.array as Float32Array
    const col = sys.points.geometry.attributes.color.array as Float32Array

    const exhaustXStart = 2.6

    sys.data.forEach((p, i) => {
      p.x += p.vx; p.life -= 0.09; const dist = p.x - exhaustXStart
      if (p.life <= 0) {
        p.x = exhaustXStart; p.life = 1.0; p.vx = 0.08 + Math.random() * 0.06
        p.vy = (Math.random()-0.5)*0.01; p.vz = (Math.random()-0.5)*0.01
      }
      const idx = i * 3
      pos[idx] = p.x; 
      pos[idx+1] = -0.1 + p.vy*dist*4 + Math.sin(elapsed*25+i)*0.015; 
      pos[idx+2] = p.vz*dist*4 // 相对于所属 Points 的 Z 位置 (0)
      const age = 1.0 - p.life; const intensity = p.life
      if (age < 0.3) { col[idx]=intensity; col[idx+1]=intensity; col[idx+2]=intensity; }
      else if (age < 0.6) { col[idx]=intensity; col[idx+1]=0.6*intensity; col[idx+2]=0.1*intensity; }
      else { col[idx]=0.8*intensity; col[idx+1]=0.1*intensity; col[idx+2]=0; }
    })
    sys.points.geometry.attributes.position.needsUpdate = true
    sys.points.geometry.attributes.color.needsUpdate = true
  })
  controls.update(); renderer.render(scene, camera)
}
renderer.setAnimationLoop(render)
