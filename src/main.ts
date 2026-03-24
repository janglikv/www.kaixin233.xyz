import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createFighter } from './models/Fighter'
import type { ExhaustParticleSystem } from './models/Fighter'

// 1. 模型配置
const MODELS = [
  { id: 'classic', name: '经典橙', color: '#f97316' },
  { id: 'phantom', name: '魅影蓝', color: '#3b82f6' },
  { id: 'vanguard', name: '先锋红', color: '#ef4444' },
  { id: 'stealth', name: '幽灵黑', color: '#18181b' },
]

// 2. 状态变量
let currentModelId = localStorage.getItem('selectedModel') || MODELS[0].id
let activeFighter: THREE.Group | null = null
let activeExhaust: ExhaustParticleSystem[] = []

// 3. 基础场景设置
const scene = new THREE.Scene()
scene.background = new THREE.Color('#07111f')
scene.fog = new THREE.Fog('#0d1930', 20, 50)

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200)
camera.position.set(6, 4, 12)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.minDistance = 5
controls.maxDistance = 30

// 4. 加载/切换模型函数
const loadModel = (id: string) => {
  // 移除旧模型
  if (activeFighter) scene.remove(activeFighter)
  
  const config = MODELS.find(m => m.id === id) || MODELS[0]
  const { fighter, exhaustParticles } = createFighter(config.color)
  
  fighter.scale.setScalar(1.2)
  scene.add(fighter)
  
  activeFighter = fighter
  activeExhaust = exhaustParticles
  currentModelId = id
  localStorage.setItem('selectedModel', id)
  
  updateUI()
}

// 5. 创建 UI
const ui = document.createElement('div')
ui.className = 'model-selector'
document.body.appendChild(ui)

const updateUI = () => {
  ui.innerHTML = `
    <div class="ui-title">战机库</div>
    ${MODELS.map(m => `
      <div class="ui-item ${m.id === currentModelId ? 'active' : ''}" data-id="${m.id}">
        <span class="color-dot" style="background: ${m.color}"></span>
        ${m.name}
      </div>
    `).join('')}
  `
  
  ui.querySelectorAll('.ui-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id')
      if (id) loadModel(id)
    })
  })
}

// 6. 环境物体 (云, 星)
const cloudMaterial = new THREE.MeshStandardMaterial({
  color: '#d8e6ff', flatShading: true, transparent: true, opacity: 0.72, roughness: 1,
})
const createCloud = (position: THREE.Vector3Tuple, scale: number) => {
  const cloud = new THREE.Group()
  const puffGeometry = new THREE.IcosahedronGeometry(0.55, 0)
  ;[[-0.9, 0, 0], [-0.25, 0.18, 0.08], [0.45, 0.08, -0.05], [1.0, -0.02, 0.03]].forEach(([x, y, z], index) => {
    const puff = new THREE.Mesh(puffGeometry, cloudMaterial)
    puff.position.set(x, y, z); puff.scale.setScalar(index % 2 === 0 ? 1 : 0.9)
    cloud.add(puff)
  })
  cloud.position.set(...position); cloud.scale.setScalar(scale); scene.add(cloud)
}
createCloud([-8.2, 4.5, -8], 1.15); createCloud([8.3, 3.8, -9], 1.05); createCloud([6.4, -1.4, -11], 0.82)

const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#d8ebff', size: 0.085, sizeAttenuation: true }))
const starPositions = new Float32Array(220 * 3)
for (let i = 0; i < 220; i++) {
  const s = i * 3
  starPositions[s] = (Math.random() - 0.5) * 64; starPositions[s+1] = Math.random() * 32 - 8; starPositions[s+2] = -Math.random() * 40 - 10
}
stars.geometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3)); scene.add(stars)

scene.add(new THREE.AmbientLight('#7e9bcb', 1.2))
const moonLight = new THREE.DirectionalLight('#d8e8ff', 1.75); moonLight.position.set(-6, 8, 6); scene.add(moonLight)
const rimLight = new THREE.DirectionalLight('#45b8ff', 1.2); rimLight.position.set(8, 1, -8); scene.add(rimLight)

// 初始加载
loadModel(currentModelId)

const handleResize = () => {
  const width = window.innerWidth
  const height = window.innerHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
  
  // 计算 UI 缩放 (基准宽度 1440)
  const uiScale = Math.max(0.6, Math.min(1.4, width / 1440))
  document.documentElement.style.setProperty('--ui-scale', uiScale.toString())
}

window.addEventListener('resize', handleResize)
handleResize()

const render = () => {
  const elapsed = performance.now() * 0.001

  if (activeFighter) {
    activeFighter.position.y = Math.sin(elapsed * 0.5) * 0.15
    activeFighter.rotation.z = Math.sin(elapsed * 0.3) * 0.05
  }

  activeExhaust.forEach((system, sysIdx) => {
    const positions = system.points.geometry.attributes.position.array as Float32Array
    const colors = system.points.geometry.attributes.color.array as Float32Array
    const zBase = sysIdx === 0 ? 0.35 : -0.35

    system.data.forEach((p, i) => {
      p.x += p.vx; p.life -= 0.09
      const dist = p.x - 2.6
      if (p.life <= 0) {
        p.x = 2.6; p.life = 1.0; p.vx = 0.08 + Math.random() * 0.06
        p.vy = (Math.random() - 0.5) * 0.01; p.vz = (Math.random() - 0.5) * 0.01
      }
      const idx = i * 3
      positions[idx] = p.x; positions[idx + 1] = -0.1 + p.vy * dist * 4 + Math.sin(elapsed * 25 + i) * 0.015; positions[idx + 2] = zBase + p.vz * dist * 4
      const age = 1.0 - p.life; const intensity = p.life
      if (age < 0.3) {
        colors[idx] = 1.0 * intensity; colors[idx+1] = 1.0 * intensity; colors[idx+2] = 1.0 * intensity;
      } else if (age < 0.6) {
        colors[idx] = 1.0 * intensity; colors[idx+1] = 0.6 * intensity; colors[idx+2] = 0.1 * intensity;
      } else {
        colors[idx] = 0.8 * intensity; colors[idx+1] = 0.1 * intensity; colors[idx+2] = 0.0 * intensity;
      }
    })
    system.points.geometry.attributes.position.needsUpdate = true
    system.points.geometry.attributes.color.needsUpdate = true
  })

  controls.update()
  renderer.render(scene, camera)
}
renderer.setAnimationLoop(render)
