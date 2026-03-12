import { EXHAUST_PLUGINS } from './exhaustPlugins'

export const createExhaustSwitcher = ({ PIXI, runtimeLayer, initialIndex = 0 }) => {
  let pluginIndex = initialIndex
  let pluginRuntime = null

  const getSafePluginIndex = () =>
    ((pluginIndex % EXHAUST_PLUGINS.length) + EXHAUST_PLUGINS.length) %
    EXHAUST_PLUGINS.length

  const mountCurrent = () => {
    pluginRuntime?.destroy()
    pluginRuntime = EXHAUST_PLUGINS[getSafePluginIndex()].createRuntime(PIXI, runtimeLayer)
  }

  mountCurrent()

  return {
    switchNext() {
      pluginIndex = getSafePluginIndex() + 1
      mountCurrent()
    },
    update(deltaSeconds, elapsedSeconds, state) {
      pluginRuntime?.update(deltaSeconds, elapsedSeconds, state)
    },
    destroy() {
      pluginRuntime?.destroy()
      pluginRuntime = null
    },
  }
}
