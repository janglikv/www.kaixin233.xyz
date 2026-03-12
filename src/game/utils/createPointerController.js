export const createPointerController = (target, options = {}) => {
  let firing = false
  const shouldStart = options.shouldStart ?? (() => true)

  const handlePointerDown = (event) => {
    if (!shouldStart(event)) return
    firing = true
  }

  const handlePointerUp = () => {
    firing = false
  }

  target.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('pointerup', handlePointerUp)
  target.addEventListener('pointerleave', handlePointerUp)
  target.addEventListener('pointercancel', handlePointerUp)

  return {
    isFiring() {
      return firing
    },
    destroy() {
      target.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
      target.removeEventListener('pointerleave', handlePointerUp)
      target.removeEventListener('pointercancel', handlePointerUp)
    },
  }
}
