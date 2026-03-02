import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import heroPng from './assets/hero.png'
import enemyPng from './assets/enemy.png'
import { ENEMY_FRAMES, ROUTE_PLAN } from './game/config'
import { buildAlphaMaskFromImage, loadImageElement } from './game/utils/image'
import { boundsOverlap, pixelPerfectCollides } from './game/utils/collision'
import { createStarfieldSystem } from './game/systems/starfieldSystem'
import { createExplosionSystem } from './game/systems/explosionSystem'
import { createLibrarySystem } from './game/systems/librarySystem'
import { WAVE1, recycleWave1Enemy, spawnWave1 } from './game/waves/wave1'

const hmrVersion = (() => {
  if (!import.meta.hot) return 0
  const nextVersion = (import.meta.hot.data.pixiAppVersion ?? 0) + 1
  import.meta.hot.data.pixiAppVersion = nextVersion
  return nextVersion
})()

export default function App() {
  const containerRef = useRef(null)
  const librarySystemRef = useRef(null)
  const [showLibrary, setShowLibrary] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return undefined

    let destroyed = false
    let initialized = false
    const app = new PIXI.Application()
    const pressedKeys = new Set()

    const alphaMasks = new WeakMap()
    const enemySprites = []
    const bulletSprites = []

    const heroSpeed = 280
    const enemyMoveSpeed = 120
    const bulletSpeed = 640
    const fireInterval = 0.2667
    const blinkInterval = 0.1
    const blinkTotalToggles = 6
    const travelSpeedMps = 48

    let hero = null
    let worldLayer = null
    let enemyContainer = null
    let bulletContainer = null
    let resizeHandler = null

    let spawnHeroBullet = null
    let spawnEnemyById = null

    let elapsedGameTime = 0
    let nextFireTime = 0
    let isFiring = false
    let keyboardFiring = false
    let mouseFiring = false

    let isBlinking = false
    let blinkElapsed = 0
    let blinkToggleCount = 0

    let traveledMeters = 0
    let routeCursor = 0
    let lastSpawnInfo = '无'
    let wave1Triggered = false

    const routePlan = [...ROUTE_PLAN].sort((a, b) => a.meter - b.meter)

    let starfieldSystem = null
    let explosionSystem = null

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
        if (spawnHeroBullet && elapsedGameTime + 1e-6 >= nextFireTime) {
          spawnHeroBullet()
          nextFireTime = elapsedGameTime + fireInterval
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
      if (event.code === 'Space') {
        keyboardFiring = true
        syncFiringState()
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

    const boot = async () => {
      await app.init({
        background: '#09131f',
        antialias: true,
        resizeTo: containerRef.current,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })

      initialized = true
      if (destroyed || !containerRef.current) {
        app.destroy(true, { children: true })
        return
      }

      containerRef.current.appendChild(app.canvas)
      app.stage.sortableChildren = true

      worldLayer = new PIXI.Container()
      worldLayer.zIndex = 0
      app.stage.addChild(worldLayer)

      starfieldSystem = createStarfieldSystem(app, worldLayer)
      explosionSystem = createExplosionSystem(app, worldLayer)

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

      const bulletShape = new PIXI.Graphics()
      bulletShape
        .roundRect(0, 0, 8, 20, 4)
        .fill(0xfff2a8)
        .stroke({ color: 0xffffff, width: 1, alpha: 0.9 })
      const bulletTexture = app.renderer.generateTexture(bulletShape)
      bulletShape.destroy()

      spawnHeroBullet = () => {
        if (!hero) return
        const bullet = new PIXI.Sprite(bulletTexture)
        bullet.anchor.set(0.5)
        bullet.x = hero.x
        bullet.y = hero.y - hero.height * 0.42
        bulletContainer.addChild(bullet)
        bulletSprites.push(bullet)
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

      const updateRouteHud = () => {
        const nextPlan = routePlan[routeCursor]
        const nextText = nextPlan
          ? `${nextPlan.meter}m -> #${nextPlan.enemyId}`
          : (wave1Triggered
            ? '已完成'
            : `${WAVE1.triggerMeter}m -> #${WAVE1.enemyId} x${WAVE1.count} (snake)`)
        routeHudText.text = `行进管理 速度:${travelSpeedMps.toFixed(0)}m/s | 里程:${traveledMeters.toFixed(1)}m | 下个:${nextText} | 最近:${lastSpawnInfo}`
        routeHudText.position.set(170, 14)
      }
      updateRouteHud()

      const librarySystem = createLibrarySystem(app, enemyTextures, showLibrary)
      librarySystemRef.current = librarySystem

      const layout = () => {
        clampHeroToScreen()
        starfieldSystem.layout()
        explosionSystem.layout()
        librarySystem.layout()
        updateRouteHud()
      }

      resizeHandler = layout
      app.renderer.on('resize', resizeHandler)
      layout()

      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      containerRef.current.addEventListener('mousedown', handleMouseDown)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('blur', handleWindowBlur)

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

        if (isFiring && spawnHeroBullet) {
          while (elapsedGameTime + 1e-6 >= nextFireTime) {
            spawnHeroBullet()
            nextFireTime += fireInterval
          }
        }

        traveledMeters += travelSpeedMps * deltaSeconds

        while (routeCursor < routePlan.length && traveledMeters >= routePlan[routeCursor].meter) {
          const plan = routePlan[routeCursor]
          spawnEnemyById(plan.enemyId)
          lastSpawnInfo = `${plan.meter}m:#${plan.enemyId}`
          routeCursor += 1
        }

        if (!wave1Triggered && traveledMeters >= WAVE1.triggerMeter) {
          wave1Triggered = true
          spawnWave1({
            spawnEnemyById,
            stageWidth: stageW,
          })
          lastSpawnInfo = `${WAVE1.triggerMeter}m:#${WAVE1.enemyId}x${WAVE1.count}(snake)`
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

        for (let i = enemySprites.length - 1; i >= 0; i -= 1) {
          const enemy = enemySprites[i]
          if (enemy.__motion?.type === 'snake') {
            enemy.__motion.phase += enemy.__motion.angularSpeed * deltaSeconds
            const wave = enemy.y * enemy.__motion.frequency + enemy.__motion.phase - enemy.__motion.segmentOffset
            enemy.x = enemy.__motion.laneX + Math.sin(wave) * enemy.__motion.amplitude
          }

          enemy.y += enemyMoveSpeed * deltaSeconds
          if (enemy.y > stageH + enemy.height) {
            const recycled = recycleWave1Enemy({ enemy, stageWidth: stageW })
            if (!recycled) {
              enemy.y = -enemy.height - Math.random() * 80
            }
          }
        }

        for (let bi = bulletSprites.length - 1; bi >= 0; bi -= 1) {
          const bullet = bulletSprites[bi]
          const bulletBounds = bullet.getBounds()
          let hit = false

          for (let ei = enemySprites.length - 1; ei >= 0; ei -= 1) {
            const enemy = enemySprites[ei]
            if (!boundsOverlap(bulletBounds, enemy.getBounds())) continue

            explosionSystem.spawn(enemy.x, enemy.y)
            enemyContainer.removeChild(enemy)
            alphaMasks.delete(enemy)
            enemy.destroy()
            enemySprites.splice(ei, 1)
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
    }

    boot().catch((error) => {
      console.error('Pixi boot failed:', error)
    })

    return () => {
      destroyed = true
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      containerRef.current?.removeEventListener('mousedown', handleMouseDown)
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
      enemySprites.length = 0

      librarySystemRef.current = null

      if (initialized) {
        app.destroy(true, { children: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hmrVersion])

  useEffect(() => {
    librarySystemRef.current?.setVisible(showLibrary)
  }, [showLibrary])

  return (
    <div className="app-root">
      <button
        type="button"
        className="library-btn"
        onClick={() => setShowLibrary((value) => !value)}
      >
        {showLibrary ? '关闭资料库' : '资料库'}
      </button>
      <div ref={containerRef} className="game-root" />
    </div>
  )
}
