export const createKeyboardController = () => {
  const pressedKeys = new Set()

  const handleKeyDown = (event) => {
    pressedKeys.add(event.code)
  }

  const handleKeyUp = (event) => {
    pressedKeys.delete(event.code)
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  return {
    getAxis() {
      const horizontal =
        (pressedKeys.has('KeyD') ? 1 : 0) - (pressedKeys.has('KeyA') ? 1 : 0)
      const vertical =
        (pressedKeys.has('KeyS') ? 1 : 0) - (pressedKeys.has('KeyW') ? 1 : 0)

      return { horizontal, vertical }
    },
    destroy() {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      pressedKeys.clear()
    },
  }
}
