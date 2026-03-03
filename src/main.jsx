// React 严格模式：用于开发阶段提前发现副作用问题
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import './index.css'
import App from './App.jsx'

// 应用入口：挂载 React 根节点，并统一套 Ant Design 主题
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 全局主题配置：当前使用暗色算法，便于和太空场景风格一致 */}
    <ConfigProvider
      theme={{ algorithm: theme.darkAlgorithm }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
)
