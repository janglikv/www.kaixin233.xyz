import * as PIXI from 'pixi.js'

const PANEL_PADDING = 28
const CLOSE_SIZE = 34
const CONTROL_BUTTON_WIDTH = 44
const CONTROL_BUTTON_HEIGHT = 34
const ACTION_BUTTON_WIDTH = 88
const ACTION_BUTTON_HEIGHT = 36
const ROW_START_Y = 142
const ROW_GAP = 58

const createValueText = ({ x, y, width }) => {
  const text = new PIXI.Text({
    text: '',
    style: {
      fill: 0xf5fbff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 20,
      fontWeight: '700',
      align: 'right',
    },
  })
  text.anchor.set(1, 0.5)
  text.position.set(x + width, y)
  return text
}

const createControlButton = ({ x, y, width, height, label, onTap }) => {
  const button = new PIXI.Container()
  const bg = new PIXI.Graphics()
  const text = new PIXI.Text({
    text: label,
    style: {
      fill: 0xe9f4ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 16,
      fontWeight: '700',
      align: 'center',
    },
  })

  const draw = (hovered = false) => {
    bg
      .clear()
      .roundRect(0, 0, width, height, 10)
      .fill({
        color: hovered ? 0x15325f : 0x0a1836,
        alpha: 0.94,
      })
      .stroke({
        color: hovered ? 0x7fcfff : 0x48638f,
        width: 2,
        alpha: 0.95,
      })
  }

  draw(false)
  button.position.set(x, y)
  button.eventMode = 'static'
  button.cursor = 'pointer'
  text.anchor.set(0.5)
  text.position.set(width * 0.5, height * 0.5)
  button.addChild(bg)
  button.addChild(text)
  button.on('pointertap', onTap)
  button.on('pointerover', () => draw(true))
  button.on('pointerout', () => draw(false))

  return button
}

const createLabel = ({ x, y, text }) => {
  const label = new PIXI.Text({
    text,
    style: {
      fill: 0xe9f4ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 24,
      fontWeight: '700',
    },
  })
  label.position.set(x, y)
  return label
}

const createToggleRow = ({ x, y, label, value, onToggle }) => {
  const container = new PIXI.Container()
  const valueText = createValueText({ x: 0, y: 17, width: 412 })
  let currentValue = value
  let buttonLabel = null

  const button = createControlButton({
    x: 428,
    y: 0,
    width: ACTION_BUTTON_WIDTH,
    height: ACTION_BUTTON_HEIGHT,
    label: '',
    onTap: () => {
      currentValue = !currentValue
      update(currentValue)
      onToggle(currentValue)
    },
  })
  buttonLabel = button.children[1]

  const update = (nextValue) => {
    currentValue = nextValue
    valueText.text = currentValue ? 'ON' : 'OFF'
    buttonLabel.text = currentValue ? '关闭' : '开启'
  }

  container.position.set(x, y)
  container.addChild(createLabel({ x: 0, y: 2, text: label }))
  container.addChild(valueText)
  container.addChild(button)
  update(value)

  return {
    container,
    update,
  }
}

const createStepperRow = ({ x, y, label, value, formatValue, onStep }) => {
  const container = new PIXI.Container()
  const valueText = createValueText({ x: 0, y: 17, width: 412 })

  container.position.set(x, y)
  container.addChild(createLabel({ x: 0, y: 2, text: label }))
  container.addChild(valueText)
  container.addChild(
    createControlButton({
      x: 428,
      y: 1,
      width: CONTROL_BUTTON_WIDTH,
      height: CONTROL_BUTTON_HEIGHT,
      label: '-',
      onTap: () => onStep(-1),
    }),
  )
  container.addChild(
    createControlButton({
      x: 480,
      y: 1,
      width: CONTROL_BUTTON_WIDTH,
      height: CONTROL_BUTTON_HEIGHT,
      label: '+',
      onTap: () => onStep(1),
    }),
  )
  valueText.text = formatValue(value)

  return {
    container,
    update(nextValue) {
      valueText.text = formatValue(nextValue)
    },
  }
}

const createActionRow = ({ x, y, label, buttonLabel, value = '', onTap }) => {
  const container = new PIXI.Container()
  const valueText = createValueText({ x: 0, y: 17, width: 412 })

  container.position.set(x, y)
  container.addChild(createLabel({ x: 0, y: 2, text: label }))
  container.addChild(valueText)
  container.addChild(
    createControlButton({
      x: 428,
      y: 0,
      width: ACTION_BUTTON_WIDTH,
      height: ACTION_BUTTON_HEIGHT,
      label: buttonLabel,
      onTap,
    }),
  )
  valueText.text = value

  return {
    container,
    update(nextValue) {
      valueText.text = nextValue
    },
  }
}

export const createSettingsOverlay = ({
  x,
  y,
  width,
  height,
  state,
  onMusicToggle,
  onFpsToggle,
  onAdjustStat,
  onFlameSwitch,
  onCatalogOpen,
  onClose,
}) => {
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

  const subtitle = new PIXI.Text({
    text: '音频、属性和调试入口会保存在本机',
    style: {
      fill: 0x8dbdff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 14,
      letterSpacing: 0.4,
    },
  })
  subtitle.position.set(PANEL_PADDING, 86)
  container.addChild(subtitle)

  const musicRow = createToggleRow({
    x: PANEL_PADDING,
    y: ROW_START_Y,
    label: '音乐',
    value: state.musicEnabled,
    onToggle: onMusicToggle,
  })
  const fpsRow = createToggleRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP,
    label: 'FPS',
    value: state.fpsEnabled,
    onToggle: onFpsToggle,
  })
  const attackPowerRow = createStepperRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP * 2,
    label: '攻击力',
    value: state.attackPower,
    formatValue: (nextValue) => `${nextValue}`,
    onStep: (direction) => onAdjustStat('attackPower', direction),
  })
  const attackSpeedRow = createStepperRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP * 3,
    label: '攻速',
    value: state.attackSpeed,
    formatValue: (nextValue) => `${nextValue.toFixed(1)}/s`,
    onStep: (direction) => onAdjustStat('attackSpeed', direction),
  })
  const critChanceRow = createStepperRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP * 4,
    label: '暴击',
    value: state.critChance,
    formatValue: (nextValue) => `${(nextValue * 100).toFixed(0)}%`,
    onStep: (direction) => onAdjustStat('critChance', direction),
  })
  const exhaustRow = createActionRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP * 5,
    label: '尾焰',
    buttonLabel: '切换',
    value: state.exhaustName,
    onTap: onFlameSwitch,
  })
  const catalogRow = createActionRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP * 6,
    label: '资料库',
    buttonLabel: '打开',
    value: '查看飞船资料',
    onTap: onCatalogOpen,
  })

  attackPowerRow.update(state.attackPower)
  attackSpeedRow.update(state.attackSpeed)
  critChanceRow.update(state.critChance)
  exhaustRow.update(state.exhaustName)
  catalogRow.update('查看飞船资料')

  ;[
    musicRow.container,
    fpsRow.container,
    attackPowerRow.container,
    attackSpeedRow.container,
    critChanceRow.container,
    exhaustRow.container,
    catalogRow.container,
  ].forEach((child) => {
    container.addChild(child)
  })

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
      musicRow.update(nextState.musicEnabled)
      fpsRow.update(nextState.fpsEnabled)
      attackPowerRow.update(nextState.attackPower)
      attackSpeedRow.update(nextState.attackSpeed)
      critChanceRow.update(nextState.critChance)
      exhaustRow.update(nextState.exhaustName)
    },
  }
}
