import './style.css'
import * as THREE from 'three'

/**
 * 英雄联盟 Web 版 - 繁花草场地图
 */

// 1. 地图配置
const MAP_CONFIG = {
  pathWidth: 16,        
  fieldWidth: 70,       // 收缩到红线范围
  length: 250,          
  grassCount: 132000    // 保持密度不变 (450000 * 54/184)
}

// 2. 初始化场景
const scene = new THREE.Scene()
scene.background = new THREE.Color('#87ceeb') // 明亮的晴空蓝

// 3. 初始化相机 (MOBA 风格 - 支持旋转)
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 2000)

// 相机旋转状态
let zoomLevel = 0.4
let cameraTheta = Math.PI * 0.25 // 水平角度
let cameraPhi = 25 * (Math.PI / 180) // 垂直仰角 (默认 25 度)
const baseDistance = 50          // 基础距离

const CAMERA_OFFSET = new THREE.Vector3()

// 更新相机位置的函数
function updateCameraOffset() {
  const dist = baseDistance * zoomLevel
  CAMERA_OFFSET.set(
    dist * Math.sin(cameraPhi) * Math.sin(cameraTheta),
    dist * Math.cos(cameraPhi),
    dist * Math.sin(cameraPhi) * Math.cos(cameraTheta)
  )
}
updateCameraOffset()

// 4. 控制逻辑 (仅保留相机状态，移除 UI 辅助函数)
// 鼠标位置追踪 (用于智能视角偏移)
const mouseNDC = new THREE.Vector2(0, 0)
const mouseFollowOffset = new THREE.Vector3(0, 0, 0)
const targetMouseFollowOffset = new THREE.Vector3(0, 0, 0)

// 右键旋转逻辑
let isRotating = false
window.addEventListener('mousedown', (e) => {
  if (e.button === 2) isRotating = true
})
window.addEventListener('mouseup', () => {
  isRotating = false
})

window.addEventListener('mousemove', (e) => {
  // 更新鼠标归一化坐标 (始终执行，用于智能视角)
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1

  if (isRotating) {
    const sensitivity = 0.005
    cameraTheta -= e.movementX * sensitivity
    cameraPhi -= e.movementY * sensitivity
    cameraPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, cameraPhi))
    
    updateCameraOffset()
  }
})

// 禁用右键菜单
window.addEventListener('contextmenu', (e) => e.preventDefault())

// 5. 初始化渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
// 开启阴影支持
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap // 柔和阴影
document.querySelector('#app')!.appendChild(renderer.domElement)

// 6. 具有结构感的石砖小路贴图 (更高密度、更细地缝)
function createDirtTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // 1. 基础深色 (砖缝颜色)
  ctx.fillStyle = '#2d241e'
  ctx.fillRect(0, 0, 512, 512)

  // 2. 绘制 16x16 高密度石砖
  const colors = ['#6d5c52', '#5d4c41', '#796a5f', '#54473e']
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]
      // 砖块之间留出极细的 1 像素缝隙 (512/16 = 32)
      ctx.fillRect(i * 32 + 1, j * 32 + 1, 30, 30)

      // 添加极细微的随机杂色
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.1})`
      ctx.fillRect(i * 32 + 2, j * 32 + 2, 28, 28)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(MAP_CONFIG.fieldWidth / 15, MAP_CONFIG.length / 15)
  return texture
}

// 7. 创建地面
const dirtTex = createDirtTexture()
const groundGeo = new THREE.PlaneGeometry(MAP_CONFIG.fieldWidth, MAP_CONFIG.length)
const groundMat = new THREE.MeshStandardMaterial({ 
  map: dirtTex, 
  roughness: 1,
  metalness: 0
})
const ground = new THREE.Mesh(groundGeo, groundMat)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true 
scene.add(ground)

// 7.5 在道路两侧添加深绿色草地背景层 (覆盖在泥土上)
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

// 8. 实例化渲染高草 (带 GPU 动画)
const bladeGeo = new THREE.ConeGeometry(0.2, 1.6, 3) // 半径从 0.1 增加到 0.2
bladeGeo.translate(0, 0.8, 0) 

// 创建带时间参数的材质
const grassMat = new THREE.MeshStandardMaterial({ 
  color: '#2d5a27',
  side: THREE.DoubleSide
})

// 核心：在材质编译前注入自定义 Shader 逻辑
const grassUniforms = {
  uTime: { value: 0 }
}

grassMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = grassUniforms.uTime
  
  // 注入顶点着色器逻辑
  shader.vertexShader = `
    uniform float uTime;
  ` + shader.vertexShader
  
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>
    
    // 计算风力摆动
    // v.y 是草的高度，高度越高摆动越大
    float h = position.y;
    float sway = sin(uTime * 2.0 + instanceMatrix[3][0] * 0.5 + instanceMatrix[3][2] * 0.5) * h * 0.1;
    transformed.x += sway;
    transformed.z += sway * 0.4;
    `
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
  const s = 0.5 + Math.random() * 1.8 // 高度随机性
  dummy.scale.set(1.6, s, 1.6) // 横向缩放从 1.1 增加到 1.6
  dummy.rotation.y = Math.random() * Math.PI
  dummy.rotation.z = (Math.random() - 0.5) * 0.8 // 增加倾斜
  dummy.rotation.x = (Math.random() - 0.5) * 0.8
  dummy.updateMatrix()
  instancedGrass.setMatrixAt(i, dummy.matrix)
  
  const color = new THREE.Color().setHSL(0.24 + Math.random() * 0.1, 0.4, 0.2 + Math.random() * 0.25)
  instancedGrass.setColorAt(i, color)
}
instancedGrass.castShadow = true 
instancedGrass.receiveShadow = true 
scene.add(instancedGrass)

// 9. 英雄与移动逻辑 (极致精细红色炮车)
const hero = new THREE.Group()

// 材质定义
const mainRedMat = new THREE.MeshStandardMaterial({ color: '#b71c1c', metalness: 0.6, roughness: 0.4 }) 
const lightRedMat = new THREE.MeshStandardMaterial({ color: '#e53935', metalness: 0.4, roughness: 0.5 }) 
const armorMat = new THREE.MeshStandardMaterial({ color: '#7f0000', metalness: 0.7, roughness: 0.3 }) 
const barrelMat = new THREE.MeshStandardMaterial({ color: '#37474f', metalness: 0.9, roughness: 0.1 }) 
const blackMetalMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.8, roughness: 0.2 })
const glowMat = new THREE.MeshStandardMaterial({ color: '#ff5252', emissive: '#ff1744', emissiveIntensity: 2 }) 
const headlightMat = new THREE.MeshStandardMaterial({ color: '#fff9c4', emissive: '#fdd835', emissiveIntensity: 1 })

// 1. 底盘主体
const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.6), mainRedMat)
chassis.position.y = 0.45
chassis.castShadow = true
chassis.receiveShadow = true
hero.add(chassis)

// 1.1 前大灯
const lampGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1)
const leftLamp = new THREE.Mesh(lampGeo, headlightMat)
leftLamp.position.set(-0.4, 0.45, 0.8)
hero.add(leftLamp)
const rightLamp = new THREE.Mesh(lampGeo, headlightMat)
rightLamp.position.set(0.4, 0.45, 0.8)
hero.add(rightLamp)

// 1.2 后排气管
const exhaustGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8)
const leftExhaust = new THREE.Mesh(exhaustGeo, blackMetalMat)
leftExhaust.rotation.x = -Math.PI / 4
leftExhaust.position.set(-0.4, 0.6, -0.85)
hero.add(leftExhaust)
const rightExhaust = new THREE.Mesh(exhaustGeo, blackMetalMat)
rightExhaust.rotation.x = -Math.PI / 4
rightExhaust.position.set(0.4, 0.6, -0.85)
hero.add(rightExhaust)

// 1.5 侧翼装甲与铆钉
const skirtGeo = new THREE.BoxGeometry(0.15, 0.4, 1.7)
const boltGeo = new THREE.SphereGeometry(0.04, 8, 8)

const createSkirt = (side: number) => {
  const skirt = new THREE.Mesh(skirtGeo, armorMat)
  skirt.position.set(0.65 * side, 0.4, 0)
  skirt.castShadow = true
  skirt.receiveShadow = true
  // 添加铆钉
  for (let z = -0.7; z <= 0.7; z += 0.35) {
    const bolt = new THREE.Mesh(boltGeo, barrelMat)
    bolt.position.set(0.08 * side, 0.15, z)
    skirt.add(bolt)
  }
  return skirt
}
hero.add(createSkirt(1))
hero.add(createSkirt(-1))

// 2. 轮子
const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16)
const wheelPositions = [
  [-0.6, 0.35, 0.55], [0.6, 0.35, 0.55],
  [-0.6, 0.35, -0.55], [0.6, 0.35, -0.55]
]
wheelPositions.forEach(pos => {
  const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: '#212121' }))
  wheel.rotation.z = Math.PI / 2
  wheel.position.set(pos[0], pos[1], pos[2])
  wheel.castShadow = true
  wheel.receiveShadow = true
  // 轮毂细节
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 8), barrelMat)
  hub.rotation.z = 0
  wheel.add(hub)
  hero.add(wheel)
})

// 3. 炮塔组件
const turret = new THREE.Group()
turret.position.y = 0.95
hero.add(turret)

const turretBody = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.5, 16), lightRedMat)
turretBody.castShadow = true
turretBody.receiveShadow = true
turret.add(turretBody)

// 3.1 舱门与天线
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
antenna2.rotation.x = -0.2
antenna2.rotation.z = 0.1
turret.add(antenna2)

// 3.2 能量核心
const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), glowMat)
core.position.set(0, 0.1, 0.5)
turret.add(core)

// 4. 炮管组件
const barrelGroup = new THREE.Group()
barrelGroup.position.set(0, 0.05, 0.4)
turret.add(barrelGroup)

const mainBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.2, 16), barrelMat)
mainBarrel.rotation.x = Math.PI / 2
mainBarrel.position.z = 0.6
mainBarrel.castShadow = true
mainBarrel.receiveShadow = true
barrelGroup.add(mainBarrel)

// 炮管加固环
const ringGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16)
const ring1 = new THREE.Mesh(ringGeo, blackMetalMat)
ring1.rotation.x = Math.PI / 2
ring1.position.z = 0.4
barrelGroup.add(ring1)
const ring2 = new THREE.Mesh(ringGeo, blackMetalMat)
ring2.rotation.x = Math.PI / 2
ring2.position.z = 0.8
barrelGroup.add(ring2)

// 炮口
const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16), barrelMat)
muzzle.rotation.x = Math.PI / 2
muzzle.position.z = 1.3
muzzle.castShadow = true
barrelGroup.add(muzzle)

scene.add(hero)

// 9.5 开火与子弹逻辑
const projectiles: { 
  mesh: THREE.Group; 
  light: THREE.PointLight;
  direction: THREE.Vector3; 
  speed: number; 
  life: number 
}[] = []

const particles: { 
  mesh: THREE.Points; 
  velocities: Float32Array;
  life: number;
  maxLife: number;
}[] = []

const flashes: { mesh: THREE.Group; light: THREE.PointLight; life: number }[] = []

function fireProjectile() {
  const muzzleWorldPos = new THREE.Vector3()
  muzzle.getWorldPosition(muzzleWorldPos)
  
  const targetPos = mouseWorldPoint.clone()
  const direction = new THREE.Vector3().subVectors(targetPos, muzzleWorldPos).normalize()
  
  // 1. 升级版开火闪光 (真点光源 + 多层火球)
  const flashGroup = new THREE.Group()
  
  // 核心白光
  const flashCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#ffffff' })
  )
  flashGroup.add(flashCore)
  
  // 外围橙火
  const outer = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#ff9800', transparent: true, opacity: 0.6 })
  )
  flashGroup.add(outer)
  
  // 关键：瞬时强力点光源 (照亮坦克和地面)
  const flashLight = new THREE.PointLight('#ffcc33', 100, 10) // 强度 100
  flashLight.position.set(0, 0, 0)
  flashGroup.add(flashLight)

  flashGroup.position.copy(muzzleWorldPos)
  scene.add(flashGroup)
  flashes.push({ mesh: flashGroup, light: flashLight, life: 1.0 })

  // 2. 能量弹 (更具实感的炮弹 + 长拖尾)
  const projGroup = new THREE.Group()
  
  // 核心炮弹 (更大且带有金属感的红色球体)
  const coreGeo = new THREE.SphereGeometry(0.25, 12, 12)
  const coreMat = new THREE.MeshStandardMaterial({ 
    color: '#ff1744', 
    emissive: '#b71c1c',
    emissiveIntensity: 2,
    metalness: 0.8,
    roughness: 0.2
  })
  const projectileCore = new THREE.Mesh(coreGeo, coreMat)
  projGroup.add(projectileCore)
  
  // 强化拖尾 (分两层，一层核心强光，一层外围光晕)
  const innerTailGeo = new THREE.CylinderGeometry(0.15, 0.01, 2.5, 8)
  const innerTailMat = new THREE.MeshBasicMaterial({ 
    color: '#ff5252', 
    transparent: true, 
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  })
  const innerTail = new THREE.Mesh(innerTailGeo, innerTailMat)
  innerTail.rotation.x = Math.PI / 2
  innerTail.position.z = -1.25
  projGroup.add(innerTail)

  const outerTailGeo = new THREE.CylinderGeometry(0.25, 0.05, 3.0, 8)
  const outerTailMat = new THREE.MeshBasicMaterial({ 
    color: '#b71c1c', 
    transparent: true, 
    opacity: 0.3,
    blending: THREE.AdditiveBlending
  })
  const outerTail = new THREE.Mesh(outerTailGeo, outerTailMat)
  outerTail.rotation.x = Math.PI / 2
  outerTail.position.z = -1.5
  projGroup.add(outerTail)
  
  // 子弹动态光源
  const projLight = new THREE.PointLight('#ff1744', 20, 8)
  
  projGroup.position.copy(muzzleWorldPos)
  projGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction)
  
  scene.add(projGroup)
  scene.add(projLight)
  
  projectiles.push({
    mesh: projGroup,
    light: projLight,
    direction: direction,
    speed: 0.45, // 降低速度，从 1.2 降至 0.45
    life: 300   // 增加寿命以匹配较低的速度
  })
}

// 物理感爆炸效果
function createExplosion(pos: THREE.Vector3) {
  // 1. 中心闪光 (升级为带光源的 Group)
  const flashGroup = new THREE.Group()
  
  const flashGeo = new THREE.SphereGeometry(1.5, 16, 16)
  const flashMat = new THREE.MeshBasicMaterial({ color: '#ffeb3b', transparent: true, opacity: 0.8 })
  const flashMesh = new THREE.Mesh(flashGeo, flashMat)
  flashMesh.scale.set(0.1, 0.1, 0.1)
  flashGroup.add(flashMesh)

  // 爆炸瞬间的强光
  const flashLight = new THREE.PointLight('#ffaa00', 150, 15)
  flashGroup.add(flashLight)

  flashGroup.position.copy(pos)
  scene.add(flashGroup)
  flashes.push({ mesh: flashGroup, light: flashLight, life: 1.0 })

  // 2. 碎片粒子
  const count = 40
  const geo = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  
  const color1 = new THREE.Color('#ffeb3b') // 金黄
  const color2 = new THREE.Color('#ff5722') // 橙红
  
  for (let i = 0; i < count; i++) {
    positions[i * 3] = pos.x
    positions[i * 3 + 1] = pos.y
    positions[i * 3 + 2] = pos.z
    
    // 爆炸向四周扩散
    const theta = Math.random() * Math.PI * 2
    const phi = Math.random() * Math.PI
    const speed = 0.1 + Math.random() * 0.3
    velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
    velocities[i * 3 + 1] = Math.cos(phi) * speed + 0.1 // 稍微向上
    velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed
    
    const mixedColor = color1.clone().lerp(color2, Math.random())
    colors[i * 3] = mixedColor.r
    colors[i * 3 + 1] = mixedColor.g
    colors[i * 3 + 2] = mixedColor.b
  }
  
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  
  const mat = new THREE.PointsMaterial({ 
    size: 0.2, 
    vertexColors: true, 
    transparent: true,
    blending: THREE.AdditiveBlending 
  })
  const points = new THREE.Points(geo, mat)
  scene.add(points)
  
  particles.push({ 
    mesh: points, 
    velocities: velocities,
    life: 1.0,
    maxLife: 1.0
  })
}

// 移动相关的状态
const raycaster = new THREE.Raycaster()
const mouseWorldPoint = new THREE.Vector3()

// 键盘状态记录
const keys: Record<string, boolean> = {
  w: false, a: false, s: false, d: false, ' ': false
}
const moveSpeed = 0.03

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase()
  if (key in keys) {
    if (key === ' ' && !keys[' ']) fireProjectile() // 按下空格开火
    keys[key] = true
  }
})
window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase()
  if (key in keys) keys[key] = false
})

// 鼠标左键开火
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) fireProjectile()
})

// 移除原本的右键点击逻辑和反馈特效
window.addEventListener('contextmenu', (e) => e.preventDefault())

// 10. 灯光
scene.add(new THREE.AmbientLight('#ffffff', 0.5))

const sunLight = new THREE.DirectionalLight('#fffce0', 1.8)
sunLight.position.set(-40, 60, -20) // 调整光源位置
sunLight.castShadow = true
sunLight.shadow.bias = -0.002 // 关键：解决大规模实例化物体的阴影偏移问题

// 配置阴影相机参数 (根据视角缩放)
sunLight.shadow.camera.left = -50
sunLight.shadow.camera.right = 50
sunLight.shadow.camera.top = 50
sunLight.shadow.camera.bottom = -50
sunLight.shadow.camera.near = 0.5
sunLight.shadow.camera.far = 200
sunLight.shadow.mapSize.set(1024, 1024) // 降低单次分辨率以支持超大规模阴影计算
scene.add(sunLight)

// 11. 渲染循环
const clock = new THREE.Clock()
const moveDir = new THREE.Vector3()

function animate() {
  requestAnimationFrame(animate)
  const elapsedTime = clock.getElapsedTime()

  // 1. 更新子弹
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]
    p.mesh.position.addScaledVector(p.direction, p.speed)
    p.light.position.copy(p.mesh.position)
    p.life--

    if (p.mesh.position.y <= 0.1 || p.life <= 0) {
      createExplosion(p.mesh.position)
      scene.remove(p.mesh)
      scene.remove(p.light)
      projectiles.splice(i, 1)
    }
  }

  // 1.2 更新闪光 (炮口闪光和爆炸闪光)
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i]
    f.life -= 0.15 // 快速消失
    
    // 缩放效果 (如果是大爆炸闪光)
    if (f.mesh.scale.x < 1.5) f.mesh.scale.addScalar(0.15)
    
    // 更新所有子物体的材质和光照强度
    f.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const m = child.material;
        if (Array.isArray(m)) {
          m.forEach(mi => { if ('opacity' in mi) (mi as any).opacity = f.life; (mi as any).transparent = true; });
        } else {
          if ('opacity' in m) (m as any).opacity = f.life; (m as any).transparent = true;
        }
      }
    })
    
    // 点光源强度随时间衰减
    f.light.intensity = 100 * f.life

    if (f.life <= 0) {
      scene.remove(f.mesh)
      f.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          const m = child.material
          if (Array.isArray(m)) m.forEach(mi => mi.dispose())
          else m.dispose()
        }
      })
      flashes.splice(i, 1)
    }
  }

  // 1.5 更新爆炸粒子 (带重力和阻力)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= 0.02
    const positions = p.mesh.geometry.attributes.position.array as Float32Array
    
    for (let j = 0; j < positions.length / 3; j++) {
      // 应用速度
      positions[j * 3] += p.velocities[j * 3]
      positions[j * 3 + 1] += p.velocities[j * 3 + 1]
      positions[j * 3 + 2] += p.velocities[j * 3 + 2]
      
      // 应用重力
      p.velocities[j * 3 + 1] -= 0.01
      // 应用空气阻力
      p.velocities[j * 3] *= 0.95
      p.velocities[j * 3 + 1] *= 0.95
      p.velocities[j * 3 + 2] *= 0.95
    }
    
    p.mesh.geometry.attributes.position.needsUpdate = true
    
    const mat = p.mesh.material as any
    if (mat.opacity !== undefined) mat.opacity = p.life
    mat.transparent = true

    if (p.life <= 0) {
      scene.remove(p.mesh)
      p.mesh.geometry.dispose()
      const m = p.mesh.material
      if (Array.isArray(m)) m.forEach(mi => mi.dispose())
      else m.dispose()
      particles.splice(i, 1)
    }
  }

  // 1.8 更新 Shader 时间
  grassUniforms.uTime.value = elapsedTime

  // 2. 处理 WASD 键盘移动
  moveDir.set(0, 0, 0)
  if (keys.w) moveDir.z -= 1
  if (keys.s) moveDir.z += 1
  if (keys.a) moveDir.x -= 1
  if (keys.d) moveDir.x += 1

  if (moveDir.length() > 0) {
    moveDir.normalize() // 归一化，防止斜向走得快

    // 平滑转向
    const targetRotation = Math.atan2(moveDir.x, moveDir.z)
    let deltaRotation = targetRotation - hero.rotation.y
    while (deltaRotation < -Math.PI) deltaRotation += Math.PI * 2
    while (deltaRotation > Math.PI) deltaRotation -= Math.PI * 2
    hero.rotation.y += deltaRotation * 0.15

    // 执行位移
    hero.position.addScaledVector(moveDir, moveSpeed)

    // 限制在路面范围内 (边界检查)
    // 宽度 16 => X 范围 [-8, 8]。减去英雄半径 0.6 => [-7.4, 7.4]
    const boundaryX = (MAP_CONFIG.pathWidth / 2) - 0.6
    const boundaryZ = (MAP_CONFIG.length / 2) - 0.6

    hero.position.x = Math.max(-boundaryX, Math.min(boundaryX, hero.position.x))
    hero.position.z = Math.max(-boundaryZ, Math.min(boundaryZ, hero.position.z))
  }

  // 2.5 处理炮塔指向鼠标
  raycaster.setFromCamera(mouseNDC, camera)
  const intersects = raycaster.intersectObject(ground)
  if (intersects.length > 0) {
    mouseWorldPoint.copy(intersects[0].point)
    
    // 计算炮塔在世界空间的位置
    const turretWorldPos = new THREE.Vector3()
    turret.getWorldPosition(turretWorldPos)
    
    // 计算旋转目标角度 (弧度)
    const angle = Math.atan2(
      mouseWorldPoint.x - turretWorldPos.x,
      mouseWorldPoint.z - turretWorldPos.z
    )
    
    // 关键：因为炮塔是 hero 的子物体，我们需要减去 hero 的旋转量
    turret.rotation.y = angle - hero.rotation.y
  }

  // 3. 计算智能视角偏移 (英雄联盟式视角)
  // 根据当前 zoomLevel 调整偏移强度
  const maxMouseOffset = 12 * zoomLevel
  targetMouseFollowOffset.set(
    mouseNDC.x * maxMouseOffset,
    0,
    -mouseNDC.y * maxMouseOffset
  )
  // 将偏移量旋转到与相机当前的 Theta 角一致
  targetMouseFollowOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraTheta)
  
  // 平滑插值
  mouseFollowOffset.lerp(targetMouseFollowOffset, 0.05)

  // 4. 同步相机 (加上鼠标偏移)
  camera.position.set(
    hero.position.x + CAMERA_OFFSET.x + mouseFollowOffset.x,
    hero.position.y + CAMERA_OFFSET.y + mouseFollowOffset.y,
    hero.position.z + CAMERA_OFFSET.z + mouseFollowOffset.z
  )
  camera.lookAt(
    hero.position.x + mouseFollowOffset.x,
    hero.position.y,
    hero.position.z + mouseFollowOffset.z
  )

  // 5. 同步灯光
  sunLight.position.set(hero.position.x - 40, 60, hero.position.z - 20)
  sunLight.target.position.copy(hero.position)
  sunLight.target.updateMatrixWorld()

  renderer.render(scene, camera)
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

animate()
