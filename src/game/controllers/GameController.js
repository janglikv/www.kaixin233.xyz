import * as PIXI from 'pixi.js'
import heroPng from '../../assets/hero.png'
import enemyPng from '../../assets/enemy.png'
import { ENEMY_FRAMES, ROUTE_PLAN } from '../config'
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

export class GameController {
  constructor(container, options = {}) {
    this.container = container
    this.showLibrary = options.showLibrary ?? false
    this.cleanupFn = null
    this.started = false
    this.destroyed = false
    this.librarySystem = null
  }

  setLibraryVisible(visible) {
    this.showLibrary = visible
    this.librarySystem?.setVisible(visible)
  }

  async start() {
    if (this.started || !this.container) return

    this.started = true
    this.destroyed = false

    let disposed = false
    let initialized = false
    const app = new PIXI.Application()
    const pressedKeys = new Set()

    const alphaMasks = new WeakMap()
    const enemySprites = []
    const bulletSprites = []
    const missileSprites = []

    const heroSpeed = 280
    const enemyMoveSpeed = 120
    const bulletSpeed = 640
    const blinkInterval = 0.1
    const blinkTotalToggles = 6
    const travelSpeedMps = 48

    let hero = null
    let worldLayer = null
    let enemyContainer = null
    let bulletContainer = null
    let missileContainer = null
    let resizeHandler = null

    let spawnHeroBullet = null
    let spawnHomingMissiles = null
    let spawnEnemyById = null

    let elapsedGameTime = 0
    let nextFireTime = 0
    let nextMissileFireTime = 0
    let isFiring = false
    let keyboardFiring = false
    let mouseFiring = false

    let isBlinking = false
    let blinkElapsed = 0
    let blinkToggleCount = 0

    let traveledMeters = 0
    let routeCursor = 0
    let lastSpawnInfo = '无'

    const routePlan = [...ROUTE_PLAN].sort((a, b) => a.meter - b.meter)
    const triggeredWaveIds = new Set()

    let starfieldSystem = null
    let explosionSystem = null
    let energyOrbSystem = null
    let energyCount = 0
    let weaponLevel = 1
    let currentWeapon = WEAPON_IDS.GUN
    const heroGlobalPoint = new PIXI.Point()
    const enemyGlobalPoint = new PIXI.Point(0, 0)
    let unlockKillCount = 0
    let missileWeaponUnlocked = false
    let weaponCardDropped = false
    let weaponCard = null
    let hudNoticeText = null
    let hudNoticeUntil = 0

    const startHeroBlink = () => {
      if (!hero || isBlinking) return
      isBlinking = true
      blinkElapsed = 0
      blinkToggleCount = 0
      hero.alpha = 0.25
    }

    const syncFiringState = () => {
      const nextFiring = keyboardFiring || mouseFiring
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

    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd'].includes(key)) {
        pressedKeys.add(key)
      }
      if (event.code === 'Slash' && !event.repeat) {
        const nextWave = getNextUntriggeredWave(triggeredWaveIds)
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

    const handleMouseDown = (event) => {
      if (event.button !== 0) return
      mouseFiring = true
      syncFiringState()
    }

    const handleMouseUp = (event) => {
      if (event.button !== 0) return
      mouseFiring = false
      syncFiringState()
    }

    const handleWindowBlur = () => {
      keyboardFiring = false
      mouseFiring = false
      syncFiringState()
    }

    const clampHeroToScreen = () => {
      if (!hero) return
      const halfWidth = hero.width / 2
      const halfHeight = hero.height / 2
      hero.x = Math.max(halfWidth, Math.min(app.renderer.width - halfWidth, hero.x))
      hero.y = Math.max(halfHeight, Math.min(app.renderer.height - halfHeight, hero.y))
    }

    const removeMissile = (missileData, index) => {
      missileContainer.removeChild(missileData.sprite)
      missileData.sprite.destroy()
      missileSprites.splice(index, 1)
    }

    WAVE_REGISTRY.forEach((wave) => wave.reset?.())

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

    this.container.appendChild(app.canvas)
    app.stage.sortableChildren = true

    worldLayer = new PIXI.Container()
    worldLayer.zIndex = 0
    app.stage.addChild(worldLayer)

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

    spawnHeroBullet = () => {
      if (!hero) return
      const tracks = getTracksByLevel(weaponLevel)
      for (const offsetX of tracks) {
        const bullet = new PIXI.Sprite(bulletTexture)
        bullet.anchor.set(0.5)
        bullet.x = hero.x + offsetX
        bullet.y = hero.y - hero.height * 0.42
        bulletContainer.addChild(bullet)
        bulletSprites.push(bullet)
      }
    }

    spawnHomingMissiles = () => {
      if (!hero) return
      const tracks = getTracksByLevel(weaponLevel)
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

    spawnEnemyById = (enemyId, options = {}) => {
      const idx = enemyId - 1
      if (idx < 0 || idx >= enemyTextures.length) return null

      const frame = ENEMY_FRAMES[idx]
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
          recycleLaneIndex: options.recycleLaneIndex ?? 0,
          waveId: options.waveId ?? null,
        }
      } else if (options.motionType === 'diagonal') {
        enemy.__motion = {
          type: 'diagonal',
          vx: options.vx ?? 0,
          vy: options.vy ?? enemyMoveSpeed,
          waveId: options.waveId ?? null,
          parked: false,
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

    const updateRouteHud = () => {
      const nextPlan = routePlan[routeCursor]
      const nextWave = getNextUntriggeredWave(triggeredWaveIds)
      const nextText = nextPlan
        ? `${nextPlan.meter}m -> #${nextPlan.enemyId}`
        : (nextWave ? nextWave.getNextText() : '已完成')
      const nextUpgrade = weaponLevel < 3 ? `Lv${weaponLevel + 1}:${WEAPON_UPGRADE_COST[weaponLevel + 1]}` : 'MAX'
      const weaponName = WEAPON_DISPLAY_NAME[currentWeapon]
      const unlockText = missileWeaponUnlocked
        ? '导弹已解锁(Q切换)'
        : `导弹解锁:#${MISSILE_UNLOCK_RULE.enemyId} ${unlockKillCount}/${MISSILE_UNLOCK_RULE.killCount}`
      routeHudText.text = `行进管理 速度:${travelSpeedMps.toFixed(0)}m/s | 里程:${traveledMeters.toFixed(1)}m | 下个:${nextText} | 最近:${lastSpawnInfo} | 能量:${energyCount} | 武器:${weaponName} Lv${weaponLevel} | 升级(V):${nextUpgrade} | ${unlockText}`
      routeHudText.position.set(170, 14)
      if (hudNoticeText) {
        hudNoticeText.position.set(app.renderer.width / 2, 56)
      }
    }
    updateRouteHud()

    this.librarySystem = createLibrarySystem(app, enemyTextures, this.showLibrary)

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

    const removeEnemy = (enemy, enemyIndex) => {
      explosionSystem.spawn(enemy.x, enemy.y)
      const enemyGlobal = enemy.getGlobalPosition(enemyGlobalPoint)
      energyOrbSystem.spawn(enemyGlobal.x, enemyGlobal.y)
      enemyContainer.removeChild(enemy)
      alphaMasks.delete(enemy)
      WAVE_REGISTRY.forEach((wave) => wave.onEnemyDestroyed(enemy))

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

    app.ticker.add(() => {
      if (!hero || !spawnEnemyById) return

      const deltaSeconds = app.ticker.deltaMS / 1000
      const stageW = app.renderer.width
      const stageH = app.renderer.height

      elapsedGameTime += deltaSeconds

      let moveX = 0
      let moveY = 0
      if (pressedKeys.has('a')) moveX -= 1
      if (pressedKeys.has('d')) moveX += 1
      if (pressedKeys.has('w')) moveY -= 1
      if (pressedKeys.has('s')) moveY += 1

      if (moveX !== 0 || moveY !== 0) {
        const length = Math.hypot(moveX, moveY)
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

      while (routeCursor < routePlan.length && traveledMeters >= routePlan[routeCursor].meter) {
        const plan = routePlan[routeCursor]
        spawnEnemyById(plan.enemyId)
        lastSpawnInfo = `${plan.meter}m:#${plan.enemyId}`
        routeCursor += 1
      }

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

      for (let mi = missileSprites.length - 1; mi >= 0; mi -= 1) {
        const missile = missileSprites[mi]
        const target = missile.lockedTarget
        if (target && !enemySprites.includes(target)) {
          missile.lockedTarget = null
        }

        if (!missile.lockedTarget && missile.travelDistance >= missile.armingDistance) {
          let nearest = null
          let nearestDistSq = missile.terminalRange * missile.terminalRange
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

        let angle = Math.atan2(missile.vy, missile.vx)
        if (missile.lockedTarget) {
          const desiredAngle = Math.atan2(
            missile.lockedTarget.y - missile.sprite.y,
            missile.lockedTarget.x - missile.sprite.x,
          )
          let delta = desiredAngle - angle
          while (delta > Math.PI) delta -= Math.PI * 2
          while (delta < -Math.PI) delta += Math.PI * 2
          const maxTurn = missile.turnRate * deltaSeconds
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
        let hitEnemyIndex = -1
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

      for (let i = enemySprites.length - 1; i >= 0; i -= 1) {
        const enemy = enemySprites[i]
        if (isRegisteredWaveEnemy(enemy) && enemy.__motion?.parked) {
          continue
        }

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

        let recycled = false
        for (const wave of WAVE_REGISTRY) {
          if (recycled) break
          recycled = wave.recycle({
            enemy,
            stageWidth: stageW,
            stageHeight: stageH,
            nowSeconds: elapsedGameTime,
          })
        }

        if (!recycled && enemy.y > stageH + enemy.height) {
          enemy.y = -enemy.height - Math.random() * 80
        }
      }

      WAVE_REGISTRY.forEach((wave) => {
        wave.update?.({
          stageWidth: stageW,
          stageHeight: stageH,
          nowSeconds: elapsedGameTime,
        })
      })

      for (let bi = bulletSprites.length - 1; bi >= 0; bi -= 1) {
        const bullet = bulletSprites[bi]
        const bulletBounds = bullet.getBounds()
        let hit = false

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

      if (weaponCard && hero) {
        weaponCard.rotation += deltaSeconds * 1.8
        const dx = hero.x - weaponCard.x
        const dy = hero.y - weaponCard.y
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

      for (const enemy of enemySprites) {
        if (pixelPerfectCollides(hero, enemy, alphaMasks)) {
          startHeroBlink()
          break
        }
      }
    })

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
    this.cleanupFn?.()
    this.cleanupFn = null
    this.started = false
  }
}
