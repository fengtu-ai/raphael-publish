import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './monacoConfig'
import App from './App.tsx'
import MarkdownGuide from './components/MarkdownGuide.tsx'

const root = createRoot(document.getElementById('root')!)

// 语法指南独立页面：#/markdown-guide（新标签页打开，静态托管无需服务端路由）
if (window.location.hash.startsWith('#/markdown-guide')) {
    root.render(
        <StrictMode>
            <MarkdownGuide />
        </StrictMode>,
    )
} else {
    root.render(
        <StrictMode>
            <App />
        </StrictMode>,
    )
}
