import * as PIXI from 'pixi.js'
import heroPng from '../../assets/hero.png'
import enemyPng from '../../assets/enemy.png'
import { ENEMY_FRAMES } from '../config'
import { buildAlphaMaskFromImage, loadImageElement } from '../utils/image'
import { boundsOverlap, pixelPerfectCollides } from '../utils/collision'
import { createStarfieldSystem } from '../systems/starfieldSystem'
import { createExplosionSystem } from '../systems/explosionSystem'
import { createLibrarySystem } from '../systems/librarySystem'
import { createEnergyOrbSystem } from '../systems/energyOrbSystem'
import { WAVE_REGISTRY, getNextUntriggeredWave, isRegisteredWaveEnemy } from '../waves/registry'
import {
  FIRE_INTERVAL_BY_LEVEL,
  MISSILE_UNLOCK_RULE,
  WEAPON_DISPLAY_NAME,
  WEAPON_IDS,
  WEAPON_UPGRADE_COST,
  getTracksByLevel,
} from '../weapons/registry'

// 游戏主控制器：
// - 管理 Pixi 生命周期（init / update / destroy）
// - 串联输入、移动、射击、碰撞、波次、掉落、HUD
// - 对 React 层暴露最小接口（start / destroy / setLibraryVisible）
export class GameController {
  constructor(container, options = {}) {
    // 外部传入的 DOM 挂载点
    this.container = container
    // 初始资料库可见性（由 React 状态传入）
    this.showLibrary = options.showLibrary ?? false
    // 清理函数：start 成功后创建，用于统一释放资源
    this.cleanupFn = null
    this.started = false
    this.destroyed = false
    this.librarySystem = null
  }

  // 切换资料库显示（React -> Pixi 单向同步）
  setLibraryVisible(visible) {
    this.showLibrary = visible
    this.librarySystem?.setVisible(visible)
  }

  async start() {
    if (this.started || !this.container) return

    this.started = true
    this.destroyed = false

    let disposed = false // 是否已进入清理流程
    let initialized = false // Pixi 是否完成 init
    const app = new PIXI.Application() // Pixi 应用实例
    const pressedKeys = new Set() // 当前按下的移动键集合（w/a/s/d）

    // ===== 运行时容器数据 =====
    // 像素级碰撞掩码缓存（key: sprite）
    const alphaMasks = new WeakMap()
    // 场上实体数组（统一由主循环维护）
    const enemySprites = []
    const bulletSprites = []
    const missileSprites = []

    // ===== 核心数值配置 =====
    const heroSpeed = 420 // 主角移动速度（像素/秒）
    const enemyMoveSpeed = 120 // 敌机默认下行速度（像素/秒）
    const bulletSpeed = 640 // 主炮子弹初始速度（像素/秒）
    const blinkInterval = 0.1 // 受击闪烁每次切换间隔（秒）
    const blinkTotalToggles = 6 // 闪烁总切换次数（6 次约等于闪 3 下）
    const travelSpeedMps = 48 // 行进系统里程推进速度（米/秒）

    // ===== 场景节点引用 =====
    let hero = null // 主角精灵
    let worldLayer = null // 世界主层（承载主角、敌机、子弹等）
    let enemyContainer = null // 敌机容器层
    let bulletContainer = null // 主炮子弹容器层
    let missileContainer = null // 导弹容器层
    let resizeHandler = null // renderer 尺寸变化回调引用（用于解绑）

    // ===== 工厂函数引用（init 后赋值） =====
    let spawnHeroBullet = null // 主炮发射函数
    let spawnHomingMissiles = null // 导弹发射函数（含末端制导参数）
    let spawnEnemyById = null // 通用敌机生成函数（按 #ID + 运动参数）

    // ===== 战斗状态 =====
    let elapsedGameTime = 0 // 累计游戏时间（秒）
    let nextFireTime = 0 // 主炮下次可发射时间点（秒）
    let nextMissileFireTime = 0 // 导弹下次可发射时间点（秒）
    let isFiring = false // 是否处于持续开火状态（键鼠合并态）
    let keyboardFiring = false // 键盘开火态（空格）
    let mouseFiring = false // 鼠标开火态（左键）

    let isBlinking = false // 主角是否处于受击闪烁中
    let blinkElapsed = 0 // 闪烁累计时间
    let blinkToggleCount = 0 // 已完成闪烁切换次数

    // ===== 里程与刷怪状态 =====
    let traveledMeters = 0 // 当前累计里程（米）
    let lastSpawnInfo = '无' // HUD 上显示的最近刷怪信息
    const triggeredWaveIds = new Set() // 已触发波次 ID 集合

    // ===== 子系统实例 =====
    let starfieldSystem = null
    let explosionSystem = null
    let energyOrbSystem = null
    let energyCount = 0 // 当前持有能量豆数量
    let weaponLevel = 1 // 当前武器等级（1~3）
    let currentWeapon = WEAPON_IDS.GUN // 当前激活武器 ID
    const heroGlobalPoint = new PIXI.Point() // 复用：主角全局坐标缓存
    const enemyGlobalPoint = new PIXI.Point(0, 0) // 复用：敌机全局坐标缓存
    let unlockKillCount = 0 // 解锁导弹所需目标击杀计数
    let missileWeaponUnlocked = false // 导弹武器是否已解锁
    let weaponCardDropped = false // 是否已经掉落过导弹武器卡
    let weaponCard = null // 场上武器卡精灵引用
    let hudNoticeText = null // 居中提示文本对象
    let hudNoticeUntil = 0 // 提示文本显示截止时间

    // 玩家与敌机碰撞后，触发短时间闪烁（无敌感反馈）
    const startHeroBlink = () => {
      if (!hero || isBlinking) return
      isBlinking = true
      blinkElapsed = 0
      blinkToggleCount = 0
      hero.alpha = 0.25
    }

    // 同步“是否处于持续开火”状态：
    // - 输入来源：空格 + 鼠标左键
    // - 支持按下第一时间发射（并受间隔控制）
    const syncFiringState = () => {
      const nextFiring = keyboardFiring || mouseFiring // 任一输入源激活即视为开火
      if (nextFiring && !isFiring) {
        isFiring = true
        if (currentWeapon === WEAPON_IDS.GUN) {
          if (spawnHeroBullet && elapsedGameTime + 1e-6 >= nextFireTime) {
            spawnHeroBullet()
            nextFireTime = elapsedGameTime + FIRE_INTERVAL_BY_LEVEL[weaponLevel]
          }
        } else if (currentWeapon === WEAPON_IDS.MISSILE && missileWeaponUnlocked) {
          if (spawnHomingMissiles && elapsedGameTime + 1e-6 >= nextMissileFireTime) {
            spawnHomingMissiles()
            nextMissileFireTime = elapsedGameTime + FIRE_INTERVAL_BY_LEVEL[weaponLevel]
          }
        }
        return
      }
      if (!nextFiring && isFiring) {
        isFiring = false
      }
    }

    // 键盘按下处理：移动、开火、切枪、升级、跳波次
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase() // 统一小写处理，便于比较
      if (['w', 'a', 's', 'd'].includes(key)) {
        pressedKeys.add(key)
      }
      if (event.code === 'Slash' && !event.repeat) {
        const nextWave = getNextUntriggeredWave(triggeredWaveIds) // 下一波未触发波次
        if (nextWave) {
          traveledMeters = Math.max(traveledMeters, nextWave.config.triggerMeter)
        }
      }
      if (event.code === 'Space') {
        keyboardFiring = true
        syncFiringState()
      }
      if (key === 'q' && !event.repeat && missileWeaponUnlocked) {
        currentWeapon = currentWeapon === WEAPON_IDS.GUN ? WEAPON_IDS.MISSILE : WEAPON_IDS.GUN
        hudNoticeUntil = elapsedGameTime + 1.5
        if (hudNoticeText) {
          hudNoticeText.text = currentWeapon === WEAPON_IDS.GUN ? '已切换：主炮' : '已切换：追踪导弹'
        }
      }
      if (key === 'v' && !event.repeat && weaponLevel < 3) {
        const targetLevel = weaponLevel + 1
        const cost = WEAPON_UPGRADE_COST[targetLevel]
        if (energyCount >= cost) {
          energyCount -= cost
          weaponLevel = targetLevel
          nextFireTime = Math.min(nextFireTime, elapsedGameTime + FIRE_INTERVAL_BY_LEVEL[weaponLevel])
          nextMissileFireTime = Math.min(nextMissileFireTime, elapsedGameTime + FIRE_INTERVAL_BY_LEVEL[weaponLevel])
        }
      }
    }

    // 键盘抬起处理：结束移动/开火
    const handleKeyUp = (event) => {
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd'].includes(key)) {
        pressedKeys.delete(key)
      }
      if (event.code === 'Space') {
        keyboardFiring = false
        syncFiringState()
      }
    }

    // 鼠标按下：开启持续开火
    const handleMouseDown = (event) => {
      if (event.button !== 0) return
      mouseFiring = true
      syncFiringState()
    }

    // 鼠标抬起：关闭持续开火
    const handleMouseUp = (event) => {
      if (event.button !== 0) return
      mouseFiring = false
      syncFiringState()
    }

    // 窗口失焦：重置输入，防止“切出后仍持续开火/移动”
    const handleWindowBlur = () => {
      keyboardFiring = false
      mouseFiring = false
      syncFiringState()
    }

    // 主角边界钳制：避免飞出屏幕
    const clampHeroToScreen = () => {
      if (!hero) return
      const halfWidth = hero.width / 2 // 主角半宽
      const halfHeight = hero.height / 2 // 主角半高
      hero.x = Math.max(halfWidth, Math.min(app.renderer.width - halfWidth, hero.x))
      hero.y = Math.max(halfHeight, Math.min(app.renderer.height - halfHeight, hero.y))
    }

    // 导弹销毁工具：统一删除容器与数组，避免泄漏
    const removeMissile = (missileData, index) => {
      missileContainer.removeChild(missileData.sprite)
      missileData.sprite.destroy()
      missileSprites.splice(index, 1)
    }

    // Pixi v8 初始化：必须先 init 再访问 renderer/canvas
    await app.init({
      background: '#09131f',
      antialias: true,
      resizeTo: this.container,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    initialized = true
    if (disposed || this.destroyed || !this.container) {
      app.destroy(true, { children: true })
      return
    }

    // 挂载画布
    this.container.appendChild(app.canvas)
    app.stage.sortableChildren = true

    worldLayer = new PIXI.Container()
    worldLayer.zIndex = 0
    app.stage.addChild(worldLayer)

    // 创建子系统
    starfieldSystem = createStarfieldSystem(app, worldLayer)
    explosionSystem = createExplosionSystem(app, worldLayer)
    energyOrbSystem = createEnergyOrbSystem(app)

    const heroTexture = await PIXI.Assets.load(heroPng)
    hero = new PIXI.Sprite(heroTexture)
    hero.anchor.set(0.5)
    hero.position.set(app.renderer.width / 2, app.renderer.height * 0.8)
    worldLayer.addChild(hero)

    const heroImage = await loadImageElement(heroPng)
    alphaMasks.set(hero, buildAlphaMaskFromImage(heroImage, {
      x: 0,
      y: 0,
      width: heroImage.width,
      height: heroImage.height,
    }))

    bulletContainer = new PIXI.Container()
    bulletContainer.zIndex = 20
    worldLayer.addChild(bulletContainer)

    missileContainer = new PIXI.Container()
    missileContainer.zIndex = 21
    worldLayer.addChild(missileContainer)

    const bulletShape = new PIXI.Graphics()
    bulletShape
      .roundRect(0, 0, 8, 20, 4)
      .fill(0xfff2a8)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.9 })
    const bulletTexture = app.renderer.generateTexture(bulletShape)
    bulletShape.destroy()

    const missileShape = new PIXI.Graphics()
    missileShape
      .moveTo(0, 0)
      .lineTo(18, 6)
      .lineTo(0, 12)
      .lineTo(4, 6)
      .closePath()
      .fill(0xff9f5d)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.9 })
    const missileTexture = app.renderer.generateTexture(missileShape)
    missileShape.destroy()

    const weaponCardShape = new PIXI.Graphics()
    weaponCardShape
      .roundRect(0, 0, 42, 56, 8)
      .fill(0x10293f)
      .stroke({ color: 0x6fd6ff, width: 2, alpha: 0.95 })
    weaponCardShape
      .moveTo(10, 18)
      .lineTo(30, 28)
      .lineTo(10, 38)
      .lineTo(14, 28)
      .closePath()
      .fill(0xff9f5d)
    const weaponCardTexture = app.renderer.generateTexture(weaponCardShape)
    weaponCardShape.destroy()

    // 主炮发射：按等级生成多轨道子弹
    spawnHeroBullet = () => {
      if (!hero) return
      const tracks = getTracksByLevel(weaponLevel) // 当前等级对应弹道偏移列表
      for (const offsetX of tracks) {
        const bullet = new PIXI.Sprite(bulletTexture)
        bullet.anchor.set(0.5)
        bullet.x = hero.x + offsetX
        bullet.y = hero.y - hero.height * 0.42
        bulletContainer.addChild(bullet)
        bulletSprites.push(bullet)
      }
    }

    // 导弹发射：先直线飞行，再末端制导
    spawnHomingMissiles = () => {
      if (!hero) return
      const tracks = getTracksByLevel(weaponLevel) // 当前等级对应导弹弹道偏移
      for (const offsetX of tracks) {
        const missile = new PIXI.Sprite(missileTexture)
        missile.anchor.set(0.25, 0.5)
        missile.x = hero.x + offsetX
        missile.y = hero.y - hero.height * 0.25
        missile.rotation = -Math.PI / 2
        missileContainer.addChild(missile)
        missileSprites.push({
          sprite: missile,
          speed: bulletSpeed,
          maxSpeed: 820,
          turnRate: 7.2,
          vx: 0,
          vy: -bulletSpeed,
          travelDistance: 0,
          terminalRange: 210,
          armingDistance: 220,
          lockedTarget: null,
        })
      }
    }

    const enemySheet = await PIXI.Assets.load(enemyPng)
    const enemyImage = await loadImageElement(enemyPng)
    const enemyTextures = ENEMY_FRAMES.map((frame) => new PIXI.Texture({
      source: enemySheet.source,
      frame: new PIXI.Rectangle(frame.x, frame.y, frame.w, frame.h),
    }))

    enemyContainer = new PIXI.Container()
    enemyContainer.zIndex = 10
    worldLayer.addChild(enemyContainer)

    // 统一敌机生成入口：按 enemyId 取纹理，并注入运动参数
    spawnEnemyById = (enemyId, options = {}) => {
      const idx = enemyId - 1 // #1 映射到数组索引 0
      if (idx < 0 || idx >= enemyTextures.length) return null

      const frame = ENEMY_FRAMES[idx] // 敌机在雪碧图中的切片数据
      const enemy = new PIXI.Sprite(enemyTextures[idx])
      enemy.__enemyId = enemyId
      enemy.anchor.set(0.5)
      enemy.scale.set(options.scale ?? 0.33)
      enemy.x = options.x ?? (90 + Math.random() * Math.max(120, app.renderer.width - 180))
      enemy.y = options.y ?? -Math.max(36, enemy.height / 2)

      if (options.motionType === 'snake') {
        enemy.__motion = {
          type: 'snake',
          laneX: options.laneX ?? enemy.x,
          amplitude: options.amplitude ?? 72,
          angularSpeed: options.angularSpeed ?? 3.2,
          phase: options.phase ?? 0,
          frequency: options.frequency ?? 0.032,
          segmentOffset: options.segmentOffset ?? 0,
          waveId: options.waveId ?? null,
        }
      } else if (options.motionType === 'diagonal') {
        enemy.__motion = {
          type: 'diagonal',
          vx: options.vx ?? 0,
          vy: options.vy ?? enemyMoveSpeed,
          waveId: options.waveId ?? null,
          queueOriginX: options.queueOriginX ?? enemy.x,
          swayAmplitude: options.swayAmplitude ?? 0,
          swaySpeed: options.swaySpeed ?? 0,
          swayPhase: options.swayPhase ?? 0,
        }
      }

      enemyContainer.addChild(enemy)
      enemySprites.push(enemy)
      alphaMasks.set(enemy, buildAlphaMaskFromImage(enemyImage, {
        x: frame.x,
        y: frame.y,
        width: frame.w,
        height: frame.h,
      }))

      return enemy
    }

    const routeHudText = new PIXI.Text({
      text: '',
      style: {
        fill: 0xeaf4ff,
        fontSize: 14,
        fontFamily: 'monospace',
        stroke: { color: 0x000000, width: 3 },
      },
    })
    routeHudText.zIndex = 2000
    app.stage.addChild(routeHudText)

    hudNoticeText = new PIXI.Text({
      text: '',
      style: {
        fill: 0xfff3b0,
        fontSize: 20,
        fontWeight: '700',
        stroke: { color: 0x000000, width: 4 },
      },
    })
    hudNoticeText.anchor.set(0.5, 0)
    hudNoticeText.zIndex = 2100
    hudNoticeText.visible = false
    app.stage.addChild(hudNoticeText)

    // HUD 更新：行进信息、里程、武器等级、解锁进度
    const updateRouteHud = () => {
      const nextWave = getNextUntriggeredWave(triggeredWaveIds) // HUD 下一个里程目标
      const nextText = nextWave ? nextWave.getNextText() : '已完成'
      const nextUpgrade = weaponLevel < 3 ? `Lv${weaponLevel + 1}:${WEAPON_UPGRADE_COST[weaponLevel + 1]}` : 'MAX'
      const weaponName = WEAPON_DISPLAY_NAME[currentWeapon]
      const unlockText = missileWeaponUnlocked
        ? '导弹已解锁(Q切换)'
        : `导弹解锁:#${MISSILE_UNLOCK_RULE.enemyId} ${unlockKillCount}/${MISSILE_UNLOCK_RULE.killCount}`
      routeHudText.text = `行进管理 速度:${travelSpeedMps.toFixed(0)}m/s | 里程:${traveledMeters.toFixed(1)}m | 下个:${nextText} | 最近:${lastSpawnInfo} | 能量:${energyCount} | 武器:${weaponName} Lv${weaponLevel} | 升级(V):${nextUpgrade} | ${unlockText}`
      routeHudText.position.set(170, Math.max(14, app.renderer.height - 34))
      if (hudNoticeText) {
        hudNoticeText.position.set(app.renderer.width / 2, Math.max(14, app.renderer.height - 86))
      }
    }
    updateRouteHud()

    // 创建资料库系统，并同步 React 当前状态
    this.librarySystem = createLibrarySystem(app, enemyTextures, this.showLibrary)

    // 分辨率变化时统一重排
    const layout = () => {
      clampHeroToScreen()
      starfieldSystem.layout()
      explosionSystem.layout()
      this.librarySystem.layout()
      updateRouteHud()
    }

    resizeHandler = layout
    app.renderer.on('resize', resizeHandler)
    layout()

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    this.container.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('blur', handleWindowBlur)

    // 击毁敌机：爆炸、掉豆、波次回调、解锁统计
    const removeEnemy = (enemy, enemyIndex) => {
      explosionSystem.spawn(enemy.x, enemy.y)
      const enemyGlobal = enemy.getGlobalPosition(enemyGlobalPoint)
      energyOrbSystem.spawn(enemyGlobal.x, enemyGlobal.y)
      enemyContainer.removeChild(enemy)
      alphaMasks.delete(enemy)
      WAVE_REGISTRY.forEach((wave) => wave.onEnemyDestroyed?.(enemy))

      if (enemy.__enemyId === MISSILE_UNLOCK_RULE.enemyId) {
        unlockKillCount += 1
        if (!weaponCardDropped && !missileWeaponUnlocked && unlockKillCount >= MISSILE_UNLOCK_RULE.killCount) {
          weaponCardDropped = true
          weaponCard = new PIXI.Sprite(weaponCardTexture)
          weaponCard.anchor.set(0.5)
          weaponCard.position.set(enemy.x, enemy.y)
          weaponCard.zIndex = 25
          worldLayer.addChild(weaponCard)
        }
      }

      enemy.destroy()
      enemySprites.splice(enemyIndex, 1)
    }

    // 越界清理敌机（非击毁）：不触发爆炸与掉豆
    const despawnEnemy = (enemy, enemyIndex) => {
      enemyContainer.removeChild(enemy)
      alphaMasks.delete(enemy)
      WAVE_REGISTRY.forEach((wave) => wave.onEnemyDestroyed?.(enemy))
      enemy.destroy()
      enemySprites.splice(enemyIndex, 1)
    }

    // ===== 主循环 =====
    // 顺序：输入移动 -> 开火 -> 触发波次 -> 更新子弹/导弹/敌机 -> 碰撞 -> 特效/HUD
    app.ticker.add(() => {
      if (!hero || !spawnEnemyById) return

      const deltaSeconds = app.ticker.deltaMS / 1000 // 本帧耗时（秒）
      const stageW = app.renderer.width // 当前画布宽度
      const stageH = app.renderer.height // 当前画布高度

      elapsedGameTime += deltaSeconds

      let moveX = 0 // 水平输入方向（-1/0/1）
      let moveY = 0 // 垂直输入方向（-1/0/1）
      if (pressedKeys.has('a')) moveX -= 1
      if (pressedKeys.has('d')) moveX += 1
      if (pressedKeys.has('w')) moveY -= 1
      if (pressedKeys.has('s')) moveY += 1

      if (moveX !== 0 || moveY !== 0) {
        const length = Math.hypot(moveX, moveY) // 归一化长度，保证斜向速度一致
        hero.x += (moveX / length) * heroSpeed * deltaSeconds
        hero.y += (moveY / length) * heroSpeed * deltaSeconds
        clampHeroToScreen()
      }

      if (isFiring && currentWeapon === WEAPON_IDS.GUN && spawnHeroBullet) {
        const fireInterval = FIRE_INTERVAL_BY_LEVEL[weaponLevel]
        while (elapsedGameTime + 1e-6 >= nextFireTime) {
          spawnHeroBullet()
          nextFireTime += fireInterval
        }
      }
      if (isFiring && currentWeapon === WEAPON_IDS.MISSILE && missileWeaponUnlocked && spawnHomingMissiles) {
        const fireInterval = FIRE_INTERVAL_BY_LEVEL[weaponLevel]
        while (elapsedGameTime + 1e-6 >= nextMissileFireTime) {
          spawnHomingMissiles()
          nextMissileFireTime += fireInterval
        }
      }

      traveledMeters += travelSpeedMps * deltaSeconds

      // 里程触发波次：每波只触发一次
      for (const wave of WAVE_REGISTRY) {
        if (triggeredWaveIds.has(wave.id)) continue
        if (traveledMeters < wave.config.triggerMeter) continue
        triggeredWaveIds.add(wave.id)
        wave.spawn({
          spawnEnemyById,
          stageWidth: stageW,
        })
        lastSpawnInfo = wave.getSpawnInfo()
      }

      updateRouteHud()
      starfieldSystem.update(deltaSeconds)

      for (let i = bulletSprites.length - 1; i >= 0; i -= 1) {
        const bullet = bulletSprites[i]
        bullet.y -= bulletSpeed * deltaSeconds
        if (bullet.y < -24) {
          bulletContainer.removeChild(bullet)
          bullet.destroy()
          bulletSprites.splice(i, 1)
        }
      }

      // 导弹更新：目标锁定、转向、推进、命中判定
      for (let mi = missileSprites.length - 1; mi >= 0; mi -= 1) {
        const missile = missileSprites[mi]
        const target = missile.lockedTarget
        if (target && !enemySprites.includes(target)) {
          missile.lockedTarget = null
        }

        if (!missile.lockedTarget && missile.travelDistance >= missile.armingDistance) {
          let nearest = null // 末端制导候选目标
          let nearestDistSq = missile.terminalRange * missile.terminalRange // 最近距离平方阈值
          for (const enemy of enemySprites) {
            const dx = enemy.x - missile.sprite.x
            const dy = enemy.y - missile.sprite.y
            const d2 = dx * dx + dy * dy
            if (d2 < nearestDistSq) {
              nearestDistSq = d2
              nearest = enemy
            }
          }
          missile.lockedTarget = nearest
        }

        let angle = Math.atan2(missile.vy, missile.vx) // 当前速度向量角度
        if (missile.lockedTarget) {
          const desiredAngle = Math.atan2(
            missile.lockedTarget.y - missile.sprite.y,
            missile.lockedTarget.x - missile.sprite.x,
          ) // 指向目标的理想角度
          let delta = desiredAngle - angle // 角度差（待约束到 -PI~PI）
          while (delta > Math.PI) delta -= Math.PI * 2
          while (delta < -Math.PI) delta += Math.PI * 2
          const maxTurn = missile.turnRate * deltaSeconds // 本帧最大可转向角
          delta = Math.max(-maxTurn, Math.min(maxTurn, delta))
          angle += delta
        }

        missile.speed = Math.min(missile.maxSpeed, missile.speed + 560 * deltaSeconds)
        missile.vx = Math.cos(angle) * missile.speed
        missile.vy = Math.sin(angle) * missile.speed
        missile.sprite.x += missile.vx * deltaSeconds
        missile.sprite.y += missile.vy * deltaSeconds
        missile.travelDistance += missile.speed * deltaSeconds
        missile.sprite.rotation = angle

        const out = missile.sprite.x < -120
          || missile.sprite.x > stageW + 120
          || missile.sprite.y < -120
          || missile.sprite.y > stageH + 120
        if (out) {
          removeMissile(missile, mi)
          continue
        }

        const missileBounds = missile.sprite.getBounds()
        let hitEnemyIndex = -1 // 导弹命中的敌机索引（-1 表示未命中）
        for (let ei = enemySprites.length - 1; ei >= 0; ei -= 1) {
          if (boundsOverlap(missileBounds, enemySprites[ei].getBounds())) {
            hitEnemyIndex = ei
            break
          }
        }
        if (hitEnemyIndex >= 0) {
          removeEnemy(enemySprites[hitEnemyIndex], hitEnemyIndex)
          removeMissile(missile, mi)
        }
      }

      // 敌机更新：按 motion 类型执行轨迹，越界后按策略清理
      for (let i = enemySprites.length - 1; i >= 0; i -= 1) {
        const enemy = enemySprites[i]
        const prevX = enemy.x
        const prevY = enemy.y
        if (enemy.__motion?.type === 'snake') {
          enemy.__motion.phase += enemy.__motion.angularSpeed * deltaSeconds
          const wave = enemy.y * enemy.__motion.frequency + enemy.__motion.phase - enemy.__motion.segmentOffset
          enemy.x = enemy.__motion.laneX + Math.sin(wave) * enemy.__motion.amplitude
          enemy.y += enemyMoveSpeed * deltaSeconds
        } else if (enemy.__motion?.type === 'diagonal') {
          enemy.__motion.swayPhase = (enemy.__motion.swayPhase ?? 0) + deltaSeconds * (enemy.__motion.swaySpeed ?? 0)
          enemy.__motion.queueOriginX += enemy.__motion.vx * deltaSeconds
          enemy.x = enemy.__motion.queueOriginX + Math.sin(enemy.__motion.swayPhase) * (enemy.__motion.swayAmplitude ?? 0)
          enemy.y += enemy.__motion.vy * deltaSeconds
        } else {
          enemy.y += enemyMoveSpeed * deltaSeconds
        }

        // 让敌机“头朝行进方向”
        const moveDX = enemy.x - prevX
        const moveDY = enemy.y - prevY
        if ((moveDX * moveDX + moveDY * moveDY) > 1e-6) {
          enemy.rotation = Math.atan2(moveDY, moveDX) + Math.PI / 2
        }

        const waveEnemyOffscreen = isRegisteredWaveEnemy(enemy) && (
          enemy.y > stageH + enemy.height
          || enemy.x < -enemy.width
          || enemy.x > stageW + enemy.width
        )
        if (waveEnemyOffscreen) {
          despawnEnemy(enemy, i)
          continue
        }

        if (enemy.y > stageH + enemy.height) {
          enemy.y = -enemy.height - Math.random() * 80
        }
      }

      // 主炮子弹命中检测
      for (let bi = bulletSprites.length - 1; bi >= 0; bi -= 1) {
        const bullet = bulletSprites[bi]
        const bulletBounds = bullet.getBounds()
        let hit = false // 当前子弹是否已命中敌机

        for (let ei = enemySprites.length - 1; ei >= 0; ei -= 1) {
          const enemy = enemySprites[ei]
          if (!boundsOverlap(bulletBounds, enemy.getBounds())) continue
          removeEnemy(enemy, ei)
          hit = true
          break
        }

        if (hit) {
          bulletContainer.removeChild(bullet)
          bullet.destroy()
          bulletSprites.splice(bi, 1)
        }
      }

      explosionSystem.update(deltaSeconds)
      energyOrbSystem.update(
        deltaSeconds,
        hero.getGlobalPosition(heroGlobalPoint),
        () => {
          energyCount += 1
        },
      )

      // 武器卡拾取判定：解锁导弹武器并提示
      if (weaponCard && hero) {
        weaponCard.rotation += deltaSeconds * 1.8
        const dx = hero.x - weaponCard.x // 玩家到卡片的 x 轴距离
        const dy = hero.y - weaponCard.y // 玩家到卡片的 y 轴距离
        if ((dx * dx + dy * dy) <= 44 * 44) {
          worldLayer.removeChild(weaponCard)
          weaponCard.destroy()
          weaponCard = null
          missileWeaponUnlocked = true
          currentWeapon = WEAPON_IDS.MISSILE
          nextMissileFireTime = elapsedGameTime
          hudNoticeUntil = elapsedGameTime + 3
          if (hudNoticeText) {
            hudNoticeText.text = '已解锁新武器，按Q切换武器'
          }
        }
      }

      if (hudNoticeText) {
        hudNoticeText.visible = elapsedGameTime < hudNoticeUntil
      }

      if (isBlinking) {
        blinkElapsed += deltaSeconds
        while (blinkElapsed >= blinkInterval) {
          blinkElapsed -= blinkInterval
          blinkToggleCount += 1
          hero.alpha = hero.alpha < 1 ? 1 : 0.25
          if (blinkToggleCount >= blinkTotalToggles) {
            isBlinking = false
            hero.alpha = 1
            break
          }
        }
        return
      }

      // 主角与敌机像素级碰撞
      for (const enemy of enemySprites) {
        if (pixelPerfectCollides(hero, enemy, alphaMasks)) {
          startHeroBlink()
          break
        }
      }
    })

    // 统一清理流程：事件解绑、对象销毁、WebGL 资源释放
    this.cleanupFn = () => {
      disposed = true
      this.destroyed = true

      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      this.container?.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('blur', handleWindowBlur)

      if (initialized && resizeHandler) {
        app.renderer.off('resize', resizeHandler)
      }

      pressedKeys.clear()
      keyboardFiring = false
      mouseFiring = false
      isFiring = false
      bulletSprites.length = 0
      missileSprites.length = 0
      enemySprites.length = 0

      if (weaponCard) {
        weaponCard.destroy()
        weaponCard = null
      }
      if (hudNoticeText) {
        hudNoticeText.destroy()
        hudNoticeText = null
      }

      this.librarySystem = null

      if (initialized) {
        app.destroy(true, { children: true })
      }
    }
  }

  destroy() {
    if (!this.started) return
    // 由 React 卸载/HMR 调用
    this.cleanupFn?.()
    this.cleanupFn = null
    this.started = false
  }
}
