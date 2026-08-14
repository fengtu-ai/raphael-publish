# 公众号排版

专为**微信公众号**与**内容创作者**打造的现代 Markdown 排版引擎。

> **在线体验**：[https://gzhweb.de5.net/](https://gzhweb.de5.net/)  
> **开源地址**：[https://github.com/fengtu-ai/raphael-publish](https://github.com/fengtu-ai/raphael-publish)

![公众号排版 截图](media/screenshot.png)

---

## ✨ 核心功能特性

### 1. 魔法粘贴
- **跨平台富文本粘贴**：直接从**飞书、Notion、Word**甚至任意网页复制富文本，粘贴瞬间自动净化为纯净 Markdown。无需手写 Markdown 语法，粘贴即用。
- **图片直贴**：支持直接粘贴截图或剪贴板图片（Ctrl/Cmd + V），自动插入 Markdown 图片语法。

### 2. 30+ 款高定主题与三大特殊排版体系
告别同质化白底模板，提供超过 30 套精心打磨的视觉主题，包含三大特殊排版架构：

- **松烟手札**：东方书卷雅致风，古典色谱与书卷留白
- **卡册**：现代杂志折页风格，多维几何卡片与精美结构
- **极光**：先锋科技与观察专栏，立体双轨标尺与浮光金句卡
- **经典系列**：Mac 纯净白、Claude 燕麦色、微信原生、NYT 纽约时报、Medium 博客风、Stripe 硅谷风、飞书效率蓝、Linear 暗夜、Retro 复古羊皮纸、Bloomberg 终端机
- **潮流系列**：Notion、GitHub、少数派、Dracula、Nord、樱花、深海、薄荷、日落、Monokai
- **更多风格**：Solarized、Cyberpunk、水墨、薰衣草、密林、冰川、咖啡、Bauhaus、赤铜、彩虹糖

<p align="center">
  <img src="media/record.gif" alt="公众号排版 功能演示" />
</p>

### 3. 一键复制到公众号（样式零丢失）
点击「**复制到公众号**」按钮，直接粘贴到微信公众号后台编辑器：

- **图片自动打包**：所有外链图片自动转换为 Base64 格式，微信后台不会出现“此图片来自第三方”的错误提示
- **样式完美保真**：背景色、圆角、行间距等高阶 CSS 样式全部精准内联
- **表格与列表不塌陷**：经过专有 `wechatCompat` 引擎重塑，在微信移动端完美呈现

### 4. 多图朋友圈并排排版
连续插入的多张 Markdown 图片会自动转换为类似朋友圈的 2-3 列网格布局，在微信公众号中自然并排呈现。

### 5. 便捷创作与一键清空
- **一键清空**：编辑器底部集成快捷清空按钮（带防误触确认保护与光标自动重置）。
- **实时字数统计**：实时显示当前文档总字符数与快捷键提示。

### 6. 多端实时预览与导出
- **三端视图切换**：支持手机 (480px)、平板 (768px)、桌面 (PC) 实时切换，所见即所得。
- **高质量导出**：支持一键导出为高质量 PDF 文件或完整带样式 HTML 源码。

---

## 🛠️ 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite 5
- **样式引擎**：Tailwind CSS 3 + Vanilla CSS
- **编辑器核心**：Monaco Editor
- **Markdown 解析**：markdown-it
- **富文本转换**：turndown + turndown-plugin-gfm
- **代码高亮**：highlight.js
- **导出支持**：html2pdf.js
- **动效库**：framer-motion

---

## 💻 本地开发

```bash
# 安装依赖
pnpm install

# 启动本地开发服务
pnpm dev
```

启动后在浏览器中打开控制台输出的本地服务地址（如 `http://localhost:5173`）即可使用。

---

## 📦 构建与部署

```bash
# 运行单元测试
pnpm test

# 打包构建生产版本
pnpm build
```

构建产物将输出至 `dist/` 目录，可直接部署到 GitHub Pages、Vercel、Netlify 或任意静态 Web 服务器。

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源。
