import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import heroPng from './assets/hero.png'
import enemyPng from './assets/enemy.png'

const hmrVersion = (() => {
  if (!import.meta.hot) return 0
  const nextVersion = (import.meta.hot.data.pixiAppVersion ?? 0) + 1
  import.meta.hot.data.pixiAppVersion = nextVersion
  return nextVersion
})()

// 从 enemy.png 透明通道连通域识别出的 20 个主要敌机区域坐标。
const ENEMY_FRAMES = [
  { x: 874, y: 54, w: 249, h: 170 },
  { x: 1218, y: 56, w: 226, h: 174 },
  { x: 324, y: 60, w: 226, h: 160 },
  { x: 580, y: 60, w: 246, h: 158 },
  { x: 66, y: 64, w: 218, h: 155 },
  { x: 931, y: 256, w: 259, h: 194 },
  { x: 651, y: 268, w: 231, h: 180 },
  { x: 58, y: 275, w: 261, h: 166 },
  { x: 1258, y: 275, w: 227, h: 163 },
  { x: 369, y: 282, w: 237, h: 153 },
  { x: 1011, y: 489, w: 215, h: 162 },
  { x: 1267, y: 494, w: 227, h: 150 },
  { x: 400, y: 496, w: 247, h: 152 },
  { x: 705, y: 499, w: 259, h: 146 },
  { x: 82, y: 500, w: 268, h: 150 },
  { x: 656, y: 725, w: 249, h: 193 },
  { x: 77, y: 729, w: 233, h: 208 },
  { x: 372, y: 729, w: 254, h: 199 },
  { x: 1232, y: 733, w: 266, h: 201 },
  { x: 929, y: 741, w: 251, h: 192 },
]

// 行进管理：达到对应里程后刷出指定编号敌军（编号与资料库一致，从 1 开始）。
const ROUTE_PLAN = []

export default function App() {
  const containerRef = useRef(null)
  const libraryContainerRef = useRef(null)
  const [showLibrary, setShowLibrary] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return undefined

    let destroyed = false
    let initialized = false
    const app = new PIXI.Application()
    const pressedKeys = new Set()

    let hero = null
    const heroSpeed = 280
    const enemySprites = []
    const enemyMoveSpeed = 120
    const bulletSprites = []
    const bulletSpeed = 640
    const fireInterval = 0.8
    let fireElapsed = 0
    const blinkInterval = 0.1
    const blinkTotalToggles = 6
    let isBlinking = false
    let blinkElapsed = 0
    let blinkToggleCount = 0
    const alphaMasks = new WeakMap()
    const sharedPoint = new PIXI.Point()
    let resizeHandler = null
    const starParticles = []
    const routePlan = [...ROUTE_PLAN].sort((a, b) => a.meter - b.meter)
    const travelSpeedMps = 48
    let traveledMeters = 0
    let routeCursor = 0
    let lastSpawnInfo = '无'
    const formationMeter = 100
    const formationEnemyId = 15
    const formationCount = 5
    let formationTriggered = false

    const loadImageElement = (url) => new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = (event) => reject(new Error(`Failed to load image: ${url} ${String(event)}`))
      image.src = url
    })

    const buildAlphaMaskFromImage = (image, frame) => {
      const width = Math.floor(frame.width)
      const height = Math.floor(frame.height)
      if (width <= 0 || height <= 0) return null

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return null
      context.clearRect(0, 0, width, height)
      context.drawImage(
        image,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        0,
        0,
        width,
        height,
      )
      const pixels = context.getImageData(0, 0, width, height).data

      const alpha = new Uint8Array(width * height)
      for (let i = 0; i < width * height; i += 1) {
        alpha[i] = pixels[i * 4 + 3]
      }
      return { width, height, alpha }
    }

    const isOpaqueAtWorldPoint = (sprite, mask, worldX, worldY) => {
      if (!mask) return false
      const local = sprite.toLocal(sharedPoint.set(worldX, worldY))
      const x = Math.floor(local.x + sprite.anchor.x * mask.width)
      const y = Math.floor(local.y + sprite.anchor.y * mask.height)
      if (x < 0 || x >= mask.width || y < 0 || y >= mask.height) return false
      return mask.alpha[y * mask.width + x] > 20
    }

    const pixelPerfectCollides = (spriteA, spriteB) => {
      const maskA = alphaMasks.get(spriteA)
      const maskB = alphaMasks.get(spriteB)
      if (!maskA || !maskB) return false

      const a = spriteA.getBounds()
      const b = spriteB.getBounds()
      const left = Math.max(a.x, b.x)
      const top = Math.max(a.y, b.y)
      const right = Math.min(a.x + a.width, b.x + b.width)
      const bottom = Math.min(a.y + a.height, b.y + b.height)
      if (right <= left || bottom <= top) return false

      const startX = Math.floor(left)
      const startY = Math.floor(top)
      const endX = Math.ceil(right)
      const endY = Math.ceil(bottom)

      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const worldX = x + 0.5
          const worldY = y + 0.5
          if (
            isOpaqueAtWorldPoint(spriteA, maskA, worldX, worldY)
            && isOpaqueAtWorldPoint(spriteB, maskB, worldX, worldY)
          ) {
            return true
          }
        }
      }
      return false
    }

    const boundsOverlap = (a, b) => (
      a.x < b.x + b.width
      && a.x + a.width > b.x
      && a.y < b.y + b.height
      && a.y + a.height > b.y
    )

    const startHeroBlink = () => {
      if (!hero || isBlinking) return
      isBlinking = true
      blinkElapsed = 0
      blinkToggleCount = 0
      hero.alpha = 0.25
    }

    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd'].includes(key)) {
        pressedKeys.add(key)
      }
    }

    const handleKeyUp = (event) => {
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd'].includes(key)) {
        pressedKeys.delete(key)
      }
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

      const starfieldContainer = new PIXI.Container()
      starfieldContainer.zIndex = -100
      app.stage.addChild(starfieldContainer)

      const starfieldGlow = new PIXI.Graphics()
      starfieldGlow
        .rect(0, 0, app.renderer.width, app.renderer.height)
        .fill({
          color: 0x0b1521,
          alpha: 1,
        })
      starfieldContainer.addChild(starfieldGlow)

      const createStarTexture = (radius, color, alpha) => {
        const shape = new PIXI.Graphics()
        shape.circle(radius, radius, radius).fill({ color, alpha })
        const texture = app.renderer.generateTexture(shape)
        shape.destroy()
        return texture
      }

      const farStarTexture = createStarTexture(1, 0x9fb2c7, 0.7)
      const midStarTexture = createStarTexture(1.4, 0xc9def7, 0.82)
      const nearStarTexture = createStarTexture(2, 0xf2f7ff, 0.95)

      const makeStarLayer = (count, texture, speed, twinkle = false) => {
        for (let i = 0; i < count; i += 1) {
          const star = new PIXI.Sprite(texture)
          star.anchor.set(0.5)
          star.x = Math.random() * app.renderer.width
          star.y = Math.random() * app.renderer.height
          star.alpha = 0.4 + Math.random() * 0.6
          starfieldContainer.addChild(star)
          starParticles.push({
            sprite: star,
            speed,
            twinkle,
            phase: Math.random() * Math.PI * 2,
            baseAlpha: star.alpha,
          })
        }
      }

      const uniformStarSpeed = 48
      makeStarLayer(90, farStarTexture, uniformStarSpeed, false)
      makeStarLayer(56, midStarTexture, uniformStarSpeed, true)
      makeStarLayer(28, nearStarTexture, uniformStarSpeed, true)

      const heroTexture = await PIXI.Assets.load(heroPng)
      hero = new PIXI.Sprite(heroTexture)
      hero.anchor.set(0.5)
      hero.position.set(app.renderer.width / 2, app.renderer.height * 0.8)
      app.stage.addChild(hero)
      const heroImage = await loadImageElement(heroPng)
      alphaMasks.set(hero, buildAlphaMaskFromImage(heroImage, {
        x: 0,
        y: 0,
        width: heroImage.width,
        height: heroImage.height,
      }))

      const bulletContainer = new PIXI.Container()
      bulletContainer.zIndex = 20
      app.stage.addChild(bulletContainer)

      const bulletShape = new PIXI.Graphics()
      bulletShape
        .roundRect(0, 0, 8, 20, 4)
        .fill(0xfff2a8)
        .stroke({ color: 0xffffff, width: 1, alpha: 0.9 })
      const bulletTexture = app.renderer.generateTexture(bulletShape)
      bulletShape.destroy()

      const spawnHeroBullet = () => {
        const bullet = new PIXI.Sprite(bulletTexture)
        bullet.anchor.set(0.5)
        bullet.x = hero.x
        bullet.y = hero.y - hero.height * 0.42
        bulletContainer.addChild(bullet)
        bulletSprites.push(bullet)
      }

      const enemySheet = await PIXI.Assets.load(enemyPng)
      const enemyContainer = new PIXI.Container()
      enemyContainer.zIndex = 10
      app.stage.addChild(enemyContainer)
      const enemyImage = await loadImageElement(enemyPng)

      const enemyTextures = ENEMY_FRAMES.map((frame) => new PIXI.Texture({
        source: enemySheet.source,
        frame: new PIXI.Rectangle(frame.x, frame.y, frame.w, frame.h),
      }))

      const spawnEnemyById = (enemyId, options = {}) => {
        const idx = enemyId - 1
        if (idx < 0 || idx >= enemyTextures.length) return null
        const frame = ENEMY_FRAMES[idx]
        const enemy = new PIXI.Sprite(enemyTextures[idx])
        enemy.anchor.set(0.5)
        enemy.scale.set(0.22)
        enemy.x = options.x ?? (90 + Math.random() * Math.max(120, app.renderer.width - 180))
        enemy.y = options.y ?? -Math.max(36, enemy.height / 2)
        if (options.motionType === 'sine') {
          enemy.__motion = {
            type: 'sine',
            baseX: enemy.x,
            amplitude: options.amplitude ?? 70,
            angularSpeed: options.angularSpeed ?? 2.4,
            phase: options.phase ?? 0,
          }
        } else if (options.motionType === 'snake') {
          enemy.__motion = {
            type: 'snake',
            laneX: options.laneX ?? enemy.x,
            amplitude: options.amplitude ?? 72,
            angularSpeed: options.angularSpeed ?? 3.2,
            phase: options.phase ?? 0,
            frequency: options.frequency ?? 0.032,
            segmentOffset: options.segmentOffset ?? 0,
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
          : (formationTriggered ? '已完成' : `${formationMeter}m -> #${formationEnemyId} x${formationCount} (sin)`)
        routeHudText.text = `行进管理 速度:${travelSpeedMps.toFixed(0)}m/s | 里程:${traveledMeters.toFixed(1)}m | 下个:${nextText} | 最近:${lastSpawnInfo}`
        routeHudText.position.set(170, 14)
      }
      updateRouteHud()

      const libraryContainer = new PIXI.Container()
      libraryContainer.zIndex = 5000
      libraryContainer.visible = showLibrary
      app.stage.addChild(libraryContainer)
      libraryContainerRef.current = libraryContainer

      const libraryBackdrop = new PIXI.Graphics()
      const libraryPanel = new PIXI.Graphics()
      const libraryGrid = new PIXI.Container()
      libraryContainer.addChild(libraryBackdrop)
      libraryContainer.addChild(libraryPanel)
      libraryContainer.addChild(libraryGrid)

      const titleText = new PIXI.Text({
        text: 'Enemy Library',
        style: {
          fill: 0xffffff,
          fontSize: 24,
          fontWeight: '700',
        },
      })
      titleText.position.set(0, 0)
      libraryContainer.addChild(titleText)

      const libraryEntries = enemyTextures.map((texture, index) => {
        const item = new PIXI.Container()
        const sprite = new PIXI.Sprite(texture)
        const label = new PIXI.Text({
          text: `#${index + 1}`,
          style: {
            fill: 0xfff18a,
            fontSize: 18,
            fontWeight: '700',
          },
        })
        sprite.anchor.set(0.5)
        label.anchor.set(0.5, 0)
        item.addChild(sprite)
        item.addChild(label)
        libraryGrid.addChild(item)
        return { item, sprite, label }
      })

      const layoutLibrary = () => {
        const stageW = app.renderer.width
        const stageH = app.renderer.height
        starfieldGlow.clear()
        starfieldGlow.rect(0, 0, stageW, stageH).fill({
          color: 0x0b1521,
          alpha: 1,
        })
        for (const particle of starParticles) {
          if (particle.sprite.x > stageW) particle.sprite.x = Math.random() * stageW
          if (particle.sprite.y > stageH) particle.sprite.y = Math.random() * stageH
        }
        libraryBackdrop.clear()
        libraryBackdrop.rect(0, 0, stageW, stageH).fill(0x000000)
        libraryBackdrop.alpha = 0.62

        const panelPadding = 24
        const panelX = panelPadding
        const panelY = panelPadding
        const panelW = Math.max(320, stageW - panelPadding * 2)
        const panelH = Math.max(260, stageH - panelPadding * 2)
        libraryPanel.clear()
        libraryPanel.roundRect(panelX, panelY, panelW, panelH, 16).fill(0x10263d)
        libraryPanel
          .roundRect(panelX, panelY, panelW, panelH, 16)
          .stroke({ color: 0x79b8ff, width: 2, alpha: 0.85 })

        titleText.position.set(panelX + 24, panelY + 14)

        const gridTop = panelY + 64
        const gridLeft = panelX + 18
        const gridRight = panelX + panelW - 18
        const gridBottom = panelY + panelH - 20
        const cols = Math.max(3, Math.min(6, Math.floor((gridRight - gridLeft) / 140)))
        const cellW = (gridRight - gridLeft) / cols
        const rows = Math.ceil(libraryEntries.length / cols)
        const cellH = Math.max(98, (gridBottom - gridTop) / Math.max(1, rows))

        libraryEntries.forEach((entry, index) => {
          const col = index % cols
          const row = Math.floor(index / cols)
          const centerX = gridLeft + cellW * (col + 0.5)
          const centerY = gridTop + cellH * (row + 0.5)
          const targetSize = Math.min(cellW * 0.72, cellH * 0.58)
          const maxSide = Math.max(entry.sprite.texture.width, entry.sprite.texture.height)
          const scale = maxSide > 0 ? targetSize / maxSide : 0.2

          entry.item.position.set(centerX, centerY)
          entry.sprite.scale.set(scale)
          entry.sprite.position.set(0, -10)
          entry.label.position.set(0, cellH * 0.28)
        })
      }

      resizeHandler = () => {
        clampHeroToScreen()
        layoutLibrary()
        updateRouteHud()
      }

      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      app.renderer.on('resize', resizeHandler)
      layoutLibrary()

      app.ticker.add(() => {
        if (!hero) return

        const deltaSeconds = app.ticker.deltaMS / 1000
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

        const stageW = app.renderer.width
        const stageH = app.renderer.height
        fireElapsed += deltaSeconds
        while (fireElapsed >= fireInterval) {
          fireElapsed -= fireInterval
          spawnHeroBullet()
        }

        traveledMeters += travelSpeedMps * deltaSeconds
        while (routeCursor < routePlan.length && traveledMeters >= routePlan[routeCursor].meter) {
          const plan = routePlan[routeCursor]
          spawnEnemyById(plan.enemyId)
          lastSpawnInfo = `${plan.meter}m:#${plan.enemyId}`
          routeCursor += 1
        }
        if (!formationTriggered && traveledMeters >= formationMeter) {
          formationTriggered = true
          const formationCenterX = stageW / 2
          const spawnY = -80
          for (let i = 0; i < formationCount; i += 1) {
            spawnEnemyById(formationEnemyId, {
              x: formationCenterX,
              y: spawnY - i * 42,
              motionType: 'snake',
              laneX: formationCenterX,
              amplitude: 78,
              angularSpeed: 3.1,
              phase: 0,
              frequency: 0.036,
              segmentOffset: i * 0.9,
            })
          }
          lastSpawnInfo = `${formationMeter}m:#${formationEnemyId}x${formationCount}(snake)`
        }
        updateRouteHud()

        for (const particle of starParticles) {
          const star = particle.sprite
          star.y += particle.speed * deltaSeconds
          if (particle.twinkle) {
            particle.phase += deltaSeconds * 2.8
            star.alpha = Math.max(0.2, Math.min(1, particle.baseAlpha + Math.sin(particle.phase) * 0.22))
          }
          if (star.y > stageH + 6) {
            star.y = -6
            star.x = Math.random() * stageW
          }
        }

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
          if (enemy.__motion?.type === 'sine') {
            enemy.__motion.phase += enemy.__motion.angularSpeed * deltaSeconds
            enemy.x = enemy.__motion.baseX + Math.sin(enemy.__motion.phase) * enemy.__motion.amplitude
          } else if (enemy.__motion?.type === 'snake') {
            enemy.__motion.phase += enemy.__motion.angularSpeed * deltaSeconds
            const wave = enemy.y * enemy.__motion.frequency + enemy.__motion.phase - enemy.__motion.segmentOffset
            enemy.x = enemy.__motion.laneX + Math.sin(wave) * enemy.__motion.amplitude
          }
          enemy.y += enemyMoveSpeed * deltaSeconds
          if (enemy.y > stageH + enemy.height) {
            enemyContainer.removeChild(enemy)
            alphaMasks.delete(enemy)
            enemy.destroy()
            enemySprites.splice(i, 1)
          }
        }

        for (let bi = bulletSprites.length - 1; bi >= 0; bi -= 1) {
          const bullet = bulletSprites[bi]
          const bulletBounds = bullet.getBounds()
          let hit = false
          for (let ei = enemySprites.length - 1; ei >= 0; ei -= 1) {
            const enemy = enemySprites[ei]
            if (!boundsOverlap(bulletBounds, enemy.getBounds())) continue
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
          if (pixelPerfectCollides(hero, enemy)) {
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
      if (initialized && resizeHandler) {
        app.renderer.off('resize', resizeHandler)
      }
      pressedKeys.clear()
      bulletSprites.length = 0
      enemySprites.length = 0
      libraryContainerRef.current = null

      if (initialized) {
        app.destroy(true, { children: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hmrVersion])

  useEffect(() => {
    if (libraryContainerRef.current) {
      libraryContainerRef.current.visible = showLibrary
    }
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
