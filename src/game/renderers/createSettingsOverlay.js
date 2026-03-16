import * as PIXI from 'pixi.js'

const PANEL_PADDING = 28
const CLOSE_SIZE = 34
const TOGGLE_WIDTH = 108
const TOGGLE_HEIGHT = 40

const createToggle = ({ x, y, label, value, onToggle }) => {
  const container = new PIXI.Container()
  container.position.set(x, y)

  const labelText = new PIXI.Text({
    text: label,
    style: {
      fill: 0xe9f4ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 24,
      fontWeight: '700',
    },
  })
  labelText.position.set(0, 4)
  container.addChild(labelText)

  const button = new PIXI.Container()
  button.position.set(240, 0)
  button.eventMode = 'static'
  button.cursor = 'pointer'

  const bg = new PIXI.Graphics()
  const text = new PIXI.Text({
    text: '',
    style: {
      fill: 0xf5fbff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 18,
      fontWeight: '700',
    },
  })
  text.anchor.set(0.5)
  text.position.set(TOGGLE_WIDTH * 0.5, TOGGLE_HEIGHT * 0.5)

  const draw = (active, hovered = false) => {
    bg
      .clear()
      .roundRect(0, 0, TOGGLE_WIDTH, TOGGLE_HEIGHT, 12)
      .fill({
        color: active ? (hovered ? 0x14583f : 0x103f30) : hovered ? 0x3e1324 : 0x28101a,
        alpha: 0.95,
      })
      .stroke({
        color: active ? 0x72efdd : 0xff7b90,
        width: 2,
        alpha: 0.95,
      })
    text.text = active ? 'ON' : 'OFF'
  }

  let currentValue = value
  draw(currentValue, false)
  button.addChild(bg)
  button.addChild(text)
  button.on('pointertap', () => {
    currentValue = !currentValue
    draw(currentValue, false)
    onToggle(currentValue)
  })
  button.on('pointerover', () => draw(currentValue, true))
  button.on('pointerout', () => draw(currentValue, false))

  container.addChild(button)

  return {
    container,
    update(nextValue) {
      currentValue = nextValue
      draw(currentValue, false)
    },
  }
}

export const createSettingsOverlay = ({ x, y, width, height, musicEnabled, onMusicToggle, onClose }) => {
  const container = new PIXI.Container()
  container.position.set(x, y)
  container.visible = false

  const bg = new PIXI.Graphics()
  bg.rect(0, 0, width, height).fill({ color: 0x050a15, alpha: 0.96 })
  container.addChild(bg)

  const closeBg = new PIXI.Graphics()
  closeBg
    .roundRect(width - PANEL_PADDING - CLOSE_SIZE, PANEL_PADDING, CLOSE_SIZE, CLOSE_SIZE, 10)
    .fill({ color: 0x102347, alpha: 0.92 })
    .stroke({ color: 0x48638f, width: 2, alpha: 0.95 })
  closeBg.eventMode = 'static'
  closeBg.cursor = 'pointer'
  closeBg.on('pointertap', onClose)
  container.addChild(closeBg)

  const closeText = new PIXI.Text({
    text: '×',
    style: {
      fill: 0xe9f4ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 24,
      fontWeight: '700',
    },
  })
  closeText.anchor.set(0.5)
  closeText.position.set(width - PANEL_PADDING - CLOSE_SIZE * 0.5, PANEL_PADDING + CLOSE_SIZE * 0.5)
  container.addChild(closeText)

  const title = new PIXI.Text({
    text: '设置',
    style: {
      fill: 0xe9f4ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 40,
      fontWeight: '700',
    },
  })
  title.position.set(PANEL_PADDING, PANEL_PADDING + 4)
  container.addChild(title)

  const musicToggle = createToggle({
    x: PANEL_PADDING,
    y: 140,
    label: '音乐',
    value: musicEnabled,
    onToggle: onMusicToggle,
  })
  container.addChild(musicToggle.container)

  return {
    container,
    bounds: {
      left: x,
      top: y,
      right: x + width,
      bottom: y + height,
    },
    toggle() {
      container.visible = !container.visible
    },
    hide() {
      container.visible = false
    },
    isVisible() {
      return container.visible
    },
    update(nextState) {
      musicToggle.update(nextState.musicEnabled)
    },
  }
}
