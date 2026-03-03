import * as PIXI from 'pixi.js'

// 复用点对象，避免每次像素检测都创建临时对象
const sharedPoint = new PIXI.Point()

// 判断某个世界坐标在 sprite 对应掩码位置是否为“不透明像素”
export const isOpaqueAtWorldPoint = (sprite, mask, worldX, worldY) => {
  if (!mask) return false
  const local = sprite.toLocal(sharedPoint.set(worldX, worldY))
  const x = Math.floor(local.x + sprite.anchor.x * mask.width)
  const y = Math.floor(local.y + sprite.anchor.y * mask.height)
  if (x < 0 || x >= mask.width || y < 0 || y >= mask.height) return false
  // alpha 阈值 20：过滤抗锯齿边缘的极淡像素，减少“擦边误判”
  return mask.alpha[y * mask.width + x] > 20
}

// 像素级精确碰撞：先算包围盒交集，再对交集内逐像素检测
export const pixelPerfectCollides = (spriteA, spriteB, alphaMasks) => {
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

  // 只要找到一个双方都不透明的像素，就判定碰撞成立
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

// AABB 粗略重叠检测（性能高，适合先做初筛）
export const boundsOverlap = (a, b) => (
  a.x < b.x + b.width
  && a.x + a.width > b.x
  && a.y < b.y + b.height
  && a.y + a.height > b.y
)
