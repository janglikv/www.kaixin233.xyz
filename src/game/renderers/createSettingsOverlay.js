import * as PIXI from 'pixi.js'

const PANEL_PADDING = 28
const CLOSE_SIZE = 34
const CONTROL_BUTTON_WIDTH = 44
const CONTROL_BUTTON_HEIGHT = 34
const ACTION_BUTTON_WIDTH = 88
const ACTION_BUTTON_HEIGHT = 36
const TAB_Y = 84
const ROW_START_Y = 146
const ROW_GAP = 58
const LARGE_ACTION_WIDTH = 260
const LARGE_ACTION_HEIGHT = 52

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

const createControlButton = ({ x, y, width, height, label, onTap, variant = 'default' }) => {
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

  const palette =
    variant === 'success'
      ? {
          idle: 0x137a43,
          hover: 0x1b9a57,
          stroke: 0x84f0b8,
          hoverStroke: 0xb6ffd6,
        }
      : {
          idle: 0x0a1836,
          hover: 0x15325f,
          stroke: 0x48638f,
          hoverStroke: 0x7fcfff,
        }

  const draw = (hovered = false) => {
    bg
      .clear()
      .roundRect(0, 0, width, height, 10)
      .fill({
        color: hovered ? palette.hover : palette.idle,
        alpha: 0.94,
      })
      .stroke({
        color: hovered ? palette.hoverStroke : palette.stroke,
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
    valueText.text = currentValue ? '已开启' : '已关闭'
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

const createActionRow = ({ x, y, label, buttonLabel, value = '', onTap, variant = 'default' }) => {
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
      variant,
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

const createTabButton = ({ x, y, label, active, onTap }) => {
  const button = new PIXI.Container()
  const bg = new PIXI.Graphics()
  const text = new PIXI.Text({
    text: label,
    style: {
      fill: 0xe9f4ff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 18,
      fontWeight: '700',
      align: 'center',
    },
  })
  let isActive = active

  const draw = (hovered = false) => {
    bg
      .clear()
      .roundRect(0, 0, 120, 40, 12)
      .fill({
        color: isActive ? 0x184886 : hovered ? 0x15325f : 0x0a1836,
        alpha: 0.96,
      })
      .stroke({
        color: isActive ? 0xa8ebff : hovered ? 0x7fcfff : 0x48638f,
        width: 2,
        alpha: 0.95,
      })
  }

  draw(false)
  button.position.set(x, y)
  button.eventMode = 'static'
  button.cursor = 'pointer'
  text.anchor.set(0.5)
  text.position.set(60, 20)
  button.addChild(bg)
  button.addChild(text)
  button.on('pointertap', onTap)
  button.on('pointerover', () => draw(true))
  button.on('pointerout', () => draw(false))

  return {
    container: button,
    setActive(nextActive) {
      isActive = nextActive
      draw(false)
    },
  }
}

const createLargeActionButton = ({ x, y, width, height, label, onTap, variant = 'success' }) => {
  const button = new PIXI.Container()
  const bg = new PIXI.Graphics()
  const text = new PIXI.Text({
    text: label,
    style: {
      fill: 0xf8feff,
      fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: 2,
      align: 'center',
    },
  })

  const palette =
    variant === 'success'
      ? {
          idle: 0x137a43,
          hover: 0x1b9a57,
          stroke: 0x84f0b8,
          hoverStroke: 0xb6ffd6,
        }
      : {
          idle: 0x1467d9,
          hover: 0x1e8dff,
          stroke: 0x7fcfff,
          hoverStroke: 0xa8ebff,
        }

  const draw = (hovered = false) => {
    bg
      .clear()
      .roundRect(0, 0, width, height, 18)
      .fill({ color: hovered ? palette.hover : palette.idle, alpha: 0.98 })
      .stroke({
        color: hovered ? palette.hoverStroke : palette.stroke,
        width: 2,
        alpha: 0.96,
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

  return {
    container: button,
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
  onImpactEffectsToggle,
  onAdjustStat,
  onCatalogOpen,
  onClearData,
  onEnterDebugScene,
  onLeave,
  onClose,
}) => {
  const container = new PIXI.Container()
  container.position.set(x, y)
  container.visible = false

  const bg = new PIXI.Graphics()
  bg.rect(0, 0, width, height).fill({ color: 0x050a15, alpha: 0.96 })
  bg.eventMode = 'static'
  bg.cursor = 'default'
  bg.hitArea = new PIXI.Rectangle(0, 0, width, height)
  bg.on('pointerdown', (event) => {
    event.stopPropagation()
  })
  bg.on('pointertap', (event) => {
    event.stopPropagation()
  })
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

  const basicTabContainer = new PIXI.Container()
  const debugTabContainer = new PIXI.Container()
  let activeTab = 'basic'

  const basicTab = createTabButton({
    x: PANEL_PADDING,
    y: TAB_Y,
    label: '基础',
    active: true,
    onTap: () => {
      activeTab = 'basic'
      basicTab.setActive(true)
      debugTab.setActive(false)
      basicTabContainer.visible = true
      debugTabContainer.visible = false
    },
  })
  const debugTab = createTabButton({
    x: PANEL_PADDING + 132,
    y: TAB_Y,
    label: '调试',
    active: false,
    onTap: () => {
      activeTab = 'debug'
      basicTab.setActive(false)
      debugTab.setActive(true)
      basicTabContainer.visible = false
      debugTabContainer.visible = true
    },
  })
  container.addChild(basicTab.container)
  container.addChild(debugTab.container)

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
    label: '帧率',
    value: state.fpsEnabled,
    onToggle: onFpsToggle,
  })
  const impactEffectsRow = createToggleRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP * 3,
    label: '爆炸效果',
    value: state.impactEffectsEnabled,
    onToggle: onImpactEffectsToggle,
  })
  const attackPowerRow = createStepperRow({
    x: PANEL_PADDING,
    y: ROW_START_Y,
    label: '攻击力',
    value: state.attackPower,
    formatValue: (nextValue) => `${nextValue}`,
    onStep: (direction) => onAdjustStat('attackPower', direction),
  })
  const attackSpeedRow = createStepperRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP,
    label: '攻速',
    value: state.attackSpeed,
    formatValue: (nextValue) => `${nextValue.toFixed(1)}/s`,
    onStep: (direction) => onAdjustStat('attackSpeed', direction),
  })
  const critChanceRow = createStepperRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP * 2,
    label: '暴击',
    value: state.critChance,
    formatValue: (nextValue) => `${(nextValue * 100).toFixed(0)}%`,
    onStep: (direction) => onAdjustStat('critChance', direction),
  })
  const catalogRow = createActionRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP * 4,
    label: '资料库',
    buttonLabel: '打开',
    value: '查看飞船资料',
    onTap: onCatalogOpen,
  })
  const clearDataRow = createActionRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP * 5,
    label: '清空数据',
    buttonLabel: '执行',
    value: '重置本地存档',
    onTap: onClearData,
  })
  const debugSceneRow = createActionRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP * 6,
    label: '调试场景',
    buttonLabel: '进入',
    value: '直接进入压测场景',
    onTap: onEnterDebugScene,
  })
  const leaveButton = createLargeActionButton({
    x: (width - LARGE_ACTION_WIDTH) * 0.5,
    y: height - PANEL_PADDING - LARGE_ACTION_HEIGHT,
    width: LARGE_ACTION_WIDTH,
    height: LARGE_ACTION_HEIGHT,
    label: '撤离',
    onTap: onLeave,
    variant: 'success',
  })

  attackPowerRow.update(state.attackPower)
  attackSpeedRow.update(state.attackSpeed)
  critChanceRow.update(state.critChance)
  catalogRow.update('查看飞船资料')

  ;[
    musicRow.container,
    fpsRow.container,
  ].forEach((child) => {
    basicTabContainer.addChild(child)
  })

  ;[
    attackPowerRow.container,
    attackSpeedRow.container,
    critChanceRow.container,
    impactEffectsRow.container,
    catalogRow.container,
    clearDataRow.container,
    debugSceneRow.container,
  ].forEach((child) => {
    debugTabContainer.addChild(child)
  })
  debugTabContainer.visible = false
  container.addChild(basicTabContainer)
  container.addChild(debugTabContainer)
  basicTabContainer.addChild(leaveButton.container)

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
      impactEffectsRow.update(nextState.impactEffectsEnabled)
      attackPowerRow.update(nextState.attackPower)
      attackSpeedRow.update(nextState.attackSpeed)
      critChanceRow.update(nextState.critChance)
      basicTabContainer.visible = activeTab === 'basic'
      debugTabContainer.visible = activeTab === 'debug'
    },
  }
}
