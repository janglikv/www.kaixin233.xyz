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
const ATTACK_SPEED_MODAL_WIDTH = 420
const ATTACK_SPEED_MODAL_HEIGHT = 220
const ATTACK_SPEED_INPUT_BASE_WIDTH = ATTACK_SPEED_MODAL_WIDTH - 56
const ATTACK_SPEED_INPUT_BASE_HEIGHT = 52

const createNumericEditModal = ({
  width,
  height,
  titleText,
  hintText,
  placeholderText,
  initialValue,
  onConfirm,
  getDomRect,
}) => {
  const overlay = new PIXI.Container()
  overlay.visible = false
  overlay.eventMode = 'static'
  overlay.cursor = 'default'
  let currentValue = initialValue
  let inputElement = null
  const panelX = (width - ATTACK_SPEED_MODAL_WIDTH) * 0.5
  const panelY = (height - ATTACK_SPEED_MODAL_HEIGHT) * 0.5

  const mask = new PIXI.Graphics()
  mask.rect(0, 0, width, height).fill({ color: 0x030812, alpha: 0.72 })
  mask.eventMode = 'static'
  mask.cursor = 'default'
  mask.on('pointerdown', (event) => {
    event.stopPropagation()
  })
  mask.on('pointertap', (event) => {
    event.stopPropagation()
  })
  overlay.addChild(mask)

  const panel = new PIXI.Container()
  panel.position.set(panelX, panelY)
  panel.eventMode = 'static'
  panel.cursor = 'default'
  panel.on('pointerdown', (event) => {
    event.stopPropagation()
  })
  panel.on('pointertap', (event) => {
    event.stopPropagation()
  })
  overlay.addChild(panel)

  const panelBg = new PIXI.Graphics()
  panelBg
    .roundRect(0, 0, ATTACK_SPEED_MODAL_WIDTH, ATTACK_SPEED_MODAL_HEIGHT, 24)
    .fill({ color: 0x071221, alpha: 0.98 })
    .stroke({ color: 0x5ca9ff, width: 2, alpha: 0.92 })
  panel.addChild(panelBg)

  const title = new PIXI.Text({
    text: titleText,
    style: {
      fill: 0xf5fbff,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 24,
      fontWeight: '700',
    },
  })
  title.position.set(28, 24)
  panel.addChild(title)

  const hint = new PIXI.Text({
    text: hintText,
    style: {
      fill: 0x93aed6,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 14,
      fontWeight: '500',
    },
  })
  hint.position.set(28, 58)
  panel.addChild(hint)

  const inputBackground = new PIXI.Graphics()
  inputBackground
    .roundRect(0, 0, ATTACK_SPEED_MODAL_WIDTH - 56, 52, 14)
    .fill({ color: 0x0b1b36, alpha: 0.98 })
    .stroke({ color: 0x6bb7ff, width: 2, alpha: 0.95 })
  inputBackground.position.set(28, 92)
  panel.addChild(inputBackground)

  const errorText = new PIXI.Text({
    text: '',
    style: {
      fill: 0xff8a80,
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 14,
      fontWeight: '700',
    },
  })
  errorText.position.set(28, 152)
  panel.addChild(errorText)

  const destroyInputElement = () => {
    if (!inputElement) return
    inputElement.remove()
    inputElement = null
  }

  const syncInputValue = (nextValue) => {
    if (!inputElement) return
    inputElement.value = nextValue
  }

  const createInputElement = () => {
    if (typeof document === 'undefined' || inputElement) return

    const input = document.createElement('input')
    input.type = 'text'
    input.inputMode = 'decimal'
    input.placeholder = placeholderText
    input.autocomplete = 'off'
    input.spellcheck = false
    input.value = currentValue
    input.style.position = 'fixed'
    input.style.transformOrigin = 'left top'
    input.style.border = '2px solid #6bb7ff'
    input.style.borderRadius = '14px'
    input.style.background = 'rgba(11, 27, 54, 0.98)'
    input.style.color = '#f5fbff'
    input.style.fontFamily = 'IBM Plex Mono, monospace'
    input.style.fontSize = '20px'
    input.style.fontWeight = '700'
    input.style.outline = 'none'
    input.style.boxSizing = 'border-box'
    input.style.zIndex = '2147483647'
    input.style.width = `${ATTACK_SPEED_INPUT_BASE_WIDTH}px`
    input.style.height = `${ATTACK_SPEED_INPUT_BASE_HEIGHT}px`
    input.style.padding = '0 16px'
    input.addEventListener('input', () => {
      errorText.text = ''
    })
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        submit()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    })
    document.body.appendChild(input)
    const domRect = getDomRect?.({
      x: panelX + 28,
      y: panelY + 92,
      width: ATTACK_SPEED_MODAL_WIDTH - 56,
      height: 52,
    })
    if (domRect) {
      const scale = domRect.width / ATTACK_SPEED_INPUT_BASE_WIDTH
      input.style.left = `${domRect.left}px`
      input.style.top = `${domRect.top}px`
      input.style.transform = `scale(${scale})`
    } else {
      input.style.left = '50%'
      input.style.top = '50%'
      input.style.transform = 'translate(-50%, -12px)'
    }
    input.focus()
    input.select()
    inputElement = input
  }

  const close = () => {
    overlay.visible = false
    errorText.text = ''
    destroyInputElement()
  }

  const open = (nextValue) => {
    currentValue = nextValue
    errorText.text = ''
    overlay.visible = true
    createInputElement()
    syncInputValue(nextValue)
  }

  const submit = () => {
    const result = onConfirm?.(inputElement?.value ?? currentValue) ?? { ok: true }
    if (result.ok === false) {
      errorText.text = result.error ?? '请输入有效的攻速数值'
      inputElement?.focus()
      inputElement?.select()
      return
    }
    close()
  }

  panel.addChild(
    createControlButton({
      x: ATTACK_SPEED_MODAL_WIDTH - 200,
      y: ATTACK_SPEED_MODAL_HEIGHT - 56,
      width: 76,
      height: 36,
      label: '取消',
      onTap: close,
    }),
  )
  panel.addChild(
    createControlButton({
      x: ATTACK_SPEED_MODAL_WIDTH - 108,
      y: ATTACK_SPEED_MODAL_HEIGHT - 56,
      width: 76,
      height: 36,
      label: '确认',
      onTap: submit,
      variant: 'success',
    }),
  )

  return {
    container: overlay,
    open,
    close,
    destroy() {
      destroyInputElement()
    },
    isVisible() {
      return overlay.visible
    },
  }
}

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

const createStepperActionRow = ({
  x,
  y,
  label,
  value,
  formatValue,
  onStep,
  actionLabel,
  onAction,
}) => {
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
  container.addChild(
    createControlButton({
      x: 532,
      y: 0,
      width: ACTION_BUTTON_WIDTH,
      height: ACTION_BUTTON_HEIGHT,
      label: actionLabel,
      onTap: onAction,
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
  onSaveAttackPower,
  onSaveAttackSpeed,
  onSaveCritChance,
  getDomRect,
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
  let currentAttackPower = state.attackPower
  let currentAttackSpeed = state.attackSpeed
  let currentCritChance = state.critChance

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
  const attackPowerRow = createStepperActionRow({
    x: PANEL_PADDING,
    y: ROW_START_Y,
    label: '攻击力',
    value: state.attackPower,
    formatValue: (nextValue) => `${nextValue}`,
    onStep: (direction) => onAdjustStat('attackPower', direction),
    actionLabel: '编辑',
    onAction: () => {
      attackPowerModal.open(String(currentAttackPower))
    },
  })
  const attackSpeedRow = createStepperActionRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP,
    label: '攻速',
    value: state.attackSpeed,
    formatValue: (nextValue) => `${nextValue.toFixed(1)}/s`,
    onStep: (direction) => onAdjustStat('attackSpeed', direction),
    actionLabel: '编辑',
    onAction: () => {
      attackSpeedModal.open(String(currentAttackSpeed))
    },
  })
  const critChanceRow = createStepperActionRow({
    x: PANEL_PADDING,
    y: ROW_START_Y + ROW_GAP * 2,
    label: '暴击',
    value: state.critChance,
    formatValue: (nextValue) => `${(nextValue * 100).toFixed(0)}%`,
    onStep: (direction) => onAdjustStat('critChance', direction),
    actionLabel: '编辑',
    onAction: () => {
      critChanceModal.open(String(Math.round(currentCritChance * 100)))
    },
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

  const attackPowerModal = createNumericEditModal({
    width,
    height,
    titleText: '设置攻击力',
    hintText: '输入新攻击力，确认后保存',
    placeholderText: '例如 120',
    initialValue: String(state.attackPower),
    onConfirm: (value) => onSaveAttackPower?.(value) ?? { ok: true },
    getDomRect,
  })

  const attackSpeedModal = createNumericEditModal({
    width,
    height,
    titleText: '设置攻速',
    hintText: '输入新攻速，确认后保存',
    placeholderText: '例如 30 或 42.5',
    initialValue: String(state.attackSpeed),
    onConfirm: (value) => onSaveAttackSpeed?.(value) ?? { ok: true },
    getDomRect,
  })

  const critChanceModal = createNumericEditModal({
    width,
    height,
    titleText: '设置暴击',
    hintText: '输入暴击率，支持 0-1 或 0-100',
    placeholderText: '例如 1 或 100',
    initialValue: String(Math.round(state.critChance * 100)),
    onConfirm: (value) => onSaveCritChance?.(value) ?? { ok: true },
    getDomRect,
  })

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
  container.addChild(attackPowerModal.container)
  container.addChild(attackSpeedModal.container)
  container.addChild(critChanceModal.container)

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
      attackPowerModal.close()
      attackSpeedModal.close()
      critChanceModal.close()
    },
    isVisible() {
      return container.visible
    },
    update(nextState) {
      currentAttackPower = nextState.attackPower
      currentAttackSpeed = nextState.attackSpeed
      currentCritChance = nextState.critChance
      musicRow.update(nextState.musicEnabled)
      fpsRow.update(nextState.fpsEnabled)
      impactEffectsRow.update(nextState.impactEffectsEnabled)
      attackPowerRow.update(nextState.attackPower)
      attackSpeedRow.update(nextState.attackSpeed)
      critChanceRow.update(nextState.critChance)
      basicTabContainer.visible = activeTab === 'basic'
      debugTabContainer.visible = activeTab === 'debug'
    },
    destroy() {
      attackPowerModal.destroy()
      attackSpeedModal.destroy()
      critChanceModal.destroy()
    },
  }
}
