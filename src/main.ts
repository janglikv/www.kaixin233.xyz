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


// 2. 状态变量
let currentFrameId = localStorage.getItem('selectedFrame') || AIRFRAMES[0].id
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
controls.enableDamping = true; controls.dampingFactor = 0.05
controls.minDistance = 5; controls.maxDistance = 35

// 4. 切换机体函数
const loadFrame = (id: string) => {
  if (activeFighter) scene.remove(activeFighter)
  
  const config = AIRFRAMES.find(f => f.id === id) || AIRFRAMES[0]
  const { fighter, exhaustParticles } = config.factory()
  
  fighter.scale.setScalar(1.2)
  scene.add(fighter)
  
  activeFighter = fighter
  activeExhaust = exhaustParticles
  currentFrameId = id
  localStorage.setItem('selectedFrame', id)
  
  updateUI()
}

// 5. 创建 UI
const ui = document.createElement('div')
ui.className = 'model-selector'
document.body.appendChild(ui)

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

// 环境物体
const cloudMaterial = new THREE.MeshStandardMaterial({ color: '#d8e6ff', flatShading: true, transparent: true, opacity: 0.72, roughness: 1 })
const createCloud = (pos: THREE.Vector3Tuple, s: number) => {
  const g = new THREE.Group(); const pGeom = new THREE.IcosahedronGeometry(0.55, 0)
  ;[[-0.9,0,0],[-0.25,0.18,0.08],[0.45,0.08,-0.05],[1.0,-0.02,0.03]].forEach(([x,y,z], i) => {
    const p = new THREE.Mesh(pGeom, cloudMaterial); p.position.set(x,y,z); p.scale.setScalar(i%2===0?1:0.9); g.add(p)
  })
  g.position.set(...pos); g.scale.setScalar(s); scene.add(g)
}
createCloud([-8.2,4.5,-8], 1.15); createCloud([8.3,3.8,-9], 1.05); createCloud([6.4,-1.4,-11], 0.82)

const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#d8ebff', size: 0.085, sizeAttenuation: true }))
const starPos = new Float32Array(220 * 3)
for (let i=0; i<220; i++) {
  const s = i * 3; starPos[s] = (Math.random()-0.5)*64; starPos[s+1] = Math.random()*32-8; starPos[s+2] = -Math.random()*40-10
}
stars.geometry.setAttribute('position', new THREE.BufferAttribute(starPos, 3)); scene.add(stars)

scene.add(new THREE.AmbientLight('#7e9bcb', 1.2))
const moonLight = new THREE.DirectionalLight('#d8e8ff', 1.75); moonLight.position.set(-6,8,6); scene.add(moonLight)
const rimLight = new THREE.DirectionalLight('#45b8ff', 1.2); rimLight.position.set(8,1,-8); scene.add(rimLight)

loadFrame(currentFrameId)

const handleResize = () => {
  const w = window.innerWidth; const h = window.innerHeight
  camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
  const uiScale = Math.max(0.6, Math.min(1.4, w / 1440))
  document.documentElement.style.setProperty('--ui-scale', uiScale.toString())
}
window.addEventListener('resize', handleResize); handleResize()

const render = () => {
  const elapsed = performance.now() * 0.001
  if (activeFighter) {
    activeFighter.position.y = Math.sin(elapsed * 0.5) * 0.15
    activeFighter.rotation.z = Math.sin(elapsed * 0.3) * 0.05
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
