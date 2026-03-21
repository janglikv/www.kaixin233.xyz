export const createBattleFlowRuntime = ({
  spaceBackdrop,
  playerCombat,
  enemyFormation,
  impactEffectSystem,
  gameOverOverlay,
  keyboard,
  pointer,
  audio,
  spawnImpact,
  gameOverFadeTime,
}) => {
  let gameOver = false
  let elapsedSeconds = 0
  let gameOverFadeProgress = 0

  const triggerGameOver = () => {
    if (gameOver) return
    gameOver = true
    playerCombat.setShipVisible(false)
    audio.playExplosion({ large: true })
    audio.playGameOver()
    const playerPosition = playerCombat.getPosition()
    spawnImpact(playerPosition.x, playerPosition.y, {
      scale: 3.2,
      flashOuterColor: 0xff4c39,
      flashInnerColor: 0xffd2a6,
      sparkColors: [0xff3b30, 0xff7a45, 0xffc15a],
    })
  }

  return {
    triggerGameOver,
    update(deltaSeconds) {
      elapsedSeconds += deltaSeconds
      if (gameOver) {
        gameOverFadeProgress = Math.min(1, gameOverFadeProgress + deltaSeconds / gameOverFadeTime)
      }
      spaceBackdrop.update?.(deltaSeconds)
      const axis = gameOver ? { horizontal: 0, vertical: 0 } : keyboard.getAxis()
      playerCombat.update(deltaSeconds, elapsedSeconds, {
        axis,
        shouldFire: pointer.isFiring(),
        gameOver,
      })
      const { x: playerX, y: playerY } = playerCombat.getPosition()
      enemyFormation.update(
        deltaSeconds,
        {
          x: playerX,
          y: playerY,
          bounds: playerCombat.getTargetBounds(),
        },
        ({ x, y, damage }) => {
        audio.playExplosion({ large: true })
        spawnImpact(x, y, {
          force: true,
          scale: 2.8,
          flashOuterColor: 0xff5a36,
          flashInnerColor: 0xffd8b0,
          sparkColors: [0xff4f32, 0xff8554, 0xffd494],
        })
        if (gameOver) return
        playerCombat.applyIncomingDamage({ damage, x, y })
        },
      )
      impactEffectSystem.update(deltaSeconds)
      gameOverOverlay.setProgress(gameOverFadeProgress)
    },
    destroy() {
      impactEffectSystem.destroy()
      enemyFormation.destroy()
      playerCombat.destroy()
      gameOverOverlay.destroy()
    },
  }
}
