/**
 * 代码块主题与视觉风格定义
 *
 * 提供多种不同的代码块容器外观与语法高亮：
 * - 纯净无顶栏（Clean Light / Dark）
 * - 经典 Mac 窗口（Mac Dots）
 * - 左侧彩色强调条（Accent Line）
 * - 终端命令行风（Terminal）
 * - 暖纸复古（Solarized Paper）
 * - 极简灰阶 / 语言标
 */

export type CodeHeaderStyle =
    | 'none'            // 纯净无顶栏
    | 'mac-dots'        // 经典红黄绿三圆点
    | 'monochrome-dots' // 极简灰白三圆点
    | 'accent-line'     // 左侧强调色竖条
    | 'terminal'        // 终端命令行（>_ terminal）
    | 'paper';          // 复古纸质双边框/细框

export interface CodeTheme {
    id: string;
    name: string;
    category: 'light' | 'dark';
    headerStyle: CodeHeaderStyle;
    headerStyleLabel: string;
    description: string;
    // 容器与卡片样式
    background: string;       // 卡片外壳背景色
    codeBackground: string;   // 内部代码区背景色
    textColor: string;        // 默认文本颜色
    borderColor?: string;     // 边框颜色
    accentColor?: string;     // 强调色（用于左侧条或终端提示符等）
    borderRadius?: string;    // 圆角大小，默认 8px
    // 语法高亮映射表
    tokenColors: Record<string, string>;
}

export const CODE_THEMES: CodeTheme[] = [
    {
        id: 'clean-light',
        name: 'GitHub 极简浅色',
        category: 'light',
        headerStyle: 'none',
        headerStyleLabel: '纯净无栏',
        description: '纯白浅灰底，无多余装饰，经典清爽',
        background: '#f6f8fa',
        codeBackground: '#f6f8fa',
        textColor: '#24292e',
        borderColor: '#e1e4e8',
        borderRadius: '8px',
        tokenColors: {
            'hljs-comment': 'color: #6a737d; font-style: normal;',
            'hljs-quote': 'color: #6a737d; font-style: normal;',
            'hljs-keyword': 'color: #d73a49; font-weight: 600;',
            'hljs-selector-tag': 'color: #d73a49; font-weight: 600;',
            'hljs-string': 'color: #032f62;',
            'hljs-title': 'color: #6f42c1; font-weight: 600;',
            'hljs-section': 'color: #6f42c1; font-weight: 600;',
            'hljs-type': 'color: #005cc5; font-weight: 600;',
            'hljs-number': 'color: #005cc5;',
            'hljs-literal': 'color: #005cc5;',
            'hljs-built_in': 'color: #005cc5;',
            'hljs-variable': 'color: #e36209;',
            'hljs-template-variable': 'color: #e36209;',
            'hljs-tag': 'color: #22863a;',
            'hljs-name': 'color: #22863a;',
            'hljs-attr': 'color: #6f42c1;',
        },
    },
    {
        id: 'one-dark-clean',
        name: 'One Dark 纯净暗黑',
        category: 'dark',
        headerStyle: 'none',
        headerStyleLabel: '纯净无栏',
        description: 'VS Code / Atom 经典沉浸暗灰，无顶栏',
        background: '#282c34',
        codeBackground: '#282c34',
        textColor: '#abb2bf',
        borderColor: '#353b45',
        borderRadius: '8px',
        tokenColors: {
            'hljs-comment': 'color: #5c6370; font-style: italic;',
            'hljs-quote': 'color: #5c6370; font-style: italic;',
            'hljs-keyword': 'color: #c678dd; font-weight: 600;',
            'hljs-selector-tag': 'color: #c678dd; font-weight: 600;',
            'hljs-string': 'color: #98c379;',
            'hljs-title': 'color: #61afef; font-weight: 600;',
            'hljs-section': 'color: #61afef; font-weight: 600;',
            'hljs-type': 'color: #e5c07b; font-weight: 600;',
            'hljs-number': 'color: #d19a66;',
            'hljs-literal': 'color: #d19a66;',
            'hljs-built_in': 'color: #e5c07b;',
            'hljs-variable': 'color: #e06c75;',
            'hljs-template-variable': 'color: #e06c75;',
            'hljs-tag': 'color: #e06c75;',
            'hljs-name': 'color: #e06c75;',
            'hljs-attr': 'color: #d19a66;',
        },
    },
    {
        id: 'accent-line-light',
        name: '左侧色条 · 晨蓝',
        category: 'light',
        headerStyle: 'accent-line',
        headerStyleLabel: '左侧色条',
        description: '左侧 4px 亮蓝强调色条，科技干练',
        background: '#f8fafc',
        codeBackground: '#f8fafc',
        textColor: '#1e293b',
        borderColor: '#e2e8f0',
        accentColor: '#3b82f6',
        borderRadius: '0 8px 8px 0',
        tokenColors: {
            'hljs-comment': 'color: #94a3b8; font-style: italic;',
            'hljs-quote': 'color: #94a3b8; font-style: italic;',
            'hljs-keyword': 'color: #2563eb; font-weight: 600;',
            'hljs-selector-tag': 'color: #2563eb; font-weight: 600;',
            'hljs-string': 'color: #059669;',
            'hljs-title': 'color: #7c3aed; font-weight: 600;',
            'hljs-section': 'color: #7c3aed; font-weight: 600;',
            'hljs-type': 'color: #0284c7; font-weight: 600;',
            'hljs-number': 'color: #d97706;',
            'hljs-literal': 'color: #d97706;',
            'hljs-built_in': 'color: #0284c7;',
            'hljs-variable': 'color: #ea580c;',
            'hljs-template-variable': 'color: #ea580c;',
            'hljs-tag': 'color: #2563eb;',
            'hljs-name': 'color: #2563eb;',
            'hljs-attr': 'color: #7c3aed;',
        },
    },
    {
        id: 'mac-classic-dark',
        name: 'Mac 经典 · 极客黑',
        category: 'dark',
        headerStyle: 'mac-dots',
        headerStyleLabel: 'Mac 窗口',
        description: '红黄绿三圆点顶栏 + 沉浸暗黑外壳',
        background: '#21252b',
        codeBackground: '#282c34',
        textColor: '#abb2bf',
        borderColor: '#1b1d23',
        borderRadius: '10px',
        tokenColors: {
            'hljs-comment': 'color: #5c6370; font-style: italic;',
            'hljs-quote': 'color: #5c6370; font-style: italic;',
            'hljs-keyword': 'color: #c678dd; font-weight: 600;',
            'hljs-selector-tag': 'color: #c678dd; font-weight: 600;',
            'hljs-string': 'color: #98c379;',
            'hljs-title': 'color: #61afef; font-weight: 600;',
            'hljs-section': 'color: #61afef; font-weight: 600;',
            'hljs-type': 'color: #e5c07b; font-weight: 600;',
            'hljs-number': 'color: #d19a66;',
            'hljs-literal': 'color: #d19a66;',
            'hljs-built_in': 'color: #e5c07b;',
            'hljs-variable': 'color: #e06c75;',
            'hljs-template-variable': 'color: #e06c75;',
            'hljs-tag': 'color: #e06c75;',
            'hljs-name': 'color: #e06c75;',
            'hljs-attr': 'color: #d19a66;',
        },
    },
    {
        id: 'mac-classic-light',
        name: 'Mac 经典 · 冰川白',
        category: 'light',
        headerStyle: 'mac-dots',
        headerStyleLabel: 'Mac 窗口',
        description: '红黄绿三圆点顶栏 + 现代白底卡片',
        background: '#f1f3f5',
        codeBackground: '#ffffff',
        textColor: '#24292e',
        borderColor: '#e9ecef',
        borderRadius: '10px',
        tokenColors: {
            'hljs-comment': 'color: #6a737d; font-style: italic;',
            'hljs-quote': 'color: #6a737d; font-style: italic;',
            'hljs-keyword': 'color: #d73a49; font-weight: 600;',
            'hljs-selector-tag': 'color: #d73a49; font-weight: 600;',
            'hljs-string': 'color: #032f62;',
            'hljs-title': 'color: #6f42c1; font-weight: 600;',
            'hljs-section': 'color: #6f42c1; font-weight: 600;',
            'hljs-type': 'color: #005cc5; font-weight: 600;',
            'hljs-number': 'color: #005cc5;',
            'hljs-literal': 'color: #005cc5;',
            'hljs-built_in': 'color: #005cc5;',
            'hljs-variable': 'color: #e36209;',
            'hljs-template-variable': 'color: #e36209;',
            'hljs-tag': 'color: #22863a;',
            'hljs-name': 'color: #22863a;',
            'hljs-attr': 'color: #6f42c1;',
        },
    },
    {
        id: 'terminal-console',
        name: '黑客终端 (Terminal)',
        category: 'dark',
        headerStyle: 'terminal',
        headerStyleLabel: '终端命令行',
        description: '顶部 >_ 命令行微标 + 纯黑极客高亮',
        background: '#121214',
        codeBackground: '#18181b',
        textColor: '#e4e4e7',
        borderColor: '#27272a',
        accentColor: '#10b981',
        borderRadius: '8px',
        tokenColors: {
            'hljs-comment': 'color: #71717a; font-style: italic;',
            'hljs-quote': 'color: #71717a; font-style: italic;',
            'hljs-keyword': 'color: #34d399; font-weight: 600;',
            'hljs-selector-tag': 'color: #34d399; font-weight: 600;',
            'hljs-string': 'color: #fbbf24;',
            'hljs-title': 'color: #60a5fa; font-weight: 600;',
            'hljs-section': 'color: #60a5fa; font-weight: 600;',
            'hljs-type': 'color: #a78bfa; font-weight: 600;',
            'hljs-number': 'color: #f472b6;',
            'hljs-literal': 'color: #f472b6;',
            'hljs-built_in': 'color: #38bdf8;',
            'hljs-variable': 'color: #fb923c;',
            'hljs-template-variable': 'color: #fb923c;',
            'hljs-tag': 'color: #34d399;',
            'hljs-name': 'color: #34d399;',
            'hljs-attr': 'color: #60a5fa;',
        },
    },
    {
        id: 'dracula-glow',
        name: 'Dracula 德古拉',
        category: 'dark',
        headerStyle: 'monochrome-dots',
        headerStyleLabel: '极简微圆点',
        description: '经典吸血鬼紫黑底色 + 鲜艳霓虹高亮',
        background: '#1e1f29',
        codeBackground: '#282a36',
        textColor: '#f8f8f2',
        borderColor: '#343746',
        borderRadius: '8px',
        tokenColors: {
            'hljs-comment': 'color: #6272a4; font-style: italic;',
            'hljs-quote': 'color: #6272a4; font-style: italic;',
            'hljs-keyword': 'color: #ff79c6; font-weight: 600;',
            'hljs-selector-tag': 'color: #ff79c6; font-weight: 600;',
            'hljs-string': 'color: #f1fa8c;',
            'hljs-title': 'color: #50fa7b; font-weight: 600;',
            'hljs-section': 'color: #50fa7b; font-weight: 600;',
            'hljs-type': 'color: #8be9fd; font-weight: 600;',
            'hljs-number': 'color: #bd93f9;',
            'hljs-literal': 'color: #bd93f9;',
            'hljs-built_in': 'color: #8be9fd;',
            'hljs-variable': 'color: #ffb86c;',
            'hljs-template-variable': 'color: #ffb86c;',
            'hljs-tag': 'color: #ff79c6;',
            'hljs-name': 'color: #ff79c6;',
            'hljs-attr': 'color: #50fa7b;',
        },
    },
    {
        id: 'solarized-paper',
        name: '暖阳纸质 (Solarized)',
        category: 'light',
        headerStyle: 'paper',
        headerStyleLabel: '暖纸细框',
        description: '温暖羊皮纸米黄底色，柔和复古不刺眼',
        background: '#fdf6e3',
        codeBackground: '#fdf6e3',
        textColor: '#657b83',
        borderColor: '#d8cfb4',
        borderRadius: '8px',
        tokenColors: {
            'hljs-comment': 'color: #93a1a1; font-style: normal;',
            'hljs-quote': 'color: #93a1a1; font-style: normal;',
            'hljs-keyword': 'color: #859900; font-weight: 600;',
            'hljs-selector-tag': 'color: #859900; font-weight: 600;',
            'hljs-string': 'color: #2aa198;',
            'hljs-title': 'color: #268bd2; font-weight: 600;',
            'hljs-section': 'color: #268bd2; font-weight: 600;',
            'hljs-type': 'color: #b58900; font-weight: 600;',
            'hljs-number': 'color: #d33682;',
            'hljs-literal': 'color: #d33682;',
            'hljs-built_in': 'color: #b58900;',
            'hljs-variable': 'color: #cb4b16;',
            'hljs-template-variable': 'color: #cb4b16;',
            'hljs-tag': 'color: #268bd2;',
            'hljs-name': 'color: #268bd2;',
            'hljs-attr': 'color: #859900;',
        },
    },
];

export const DEFAULT_CODE_THEME_ID = 'clean-light';

export function getCodeTheme(id?: string): CodeTheme {
    return CODE_THEMES.find(t => t.id === id) || CODE_THEMES[0];
}

/**
 * 将代码主题样式统一应用到 DOM 容器内的 pre 与 code
 */
export function applyCodeThemeToDom(container: Element | Document, codeThemeId?: string): void {
    const codeTheme = getCodeTheme(codeThemeId);

    // 1. 内联语法高亮 token
    container.querySelectorAll('.hljs span').forEach(span => {
        let inlineStyle = span.getAttribute('style') || '';
        if (inlineStyle && !inlineStyle.endsWith(';')) inlineStyle += '; ';
        span.classList.forEach(cls => {
            if (codeTheme.tokenColors[cls]) {
                inlineStyle += codeTheme.tokenColors[cls] + ' ';
            }
        });
        if (inlineStyle) {
            span.setAttribute('style', inlineStyle.trim());
        }
    });

    // 2. 装饰 pre 与 code 容器
    const isDualLayer = codeTheme.background !== codeTheme.codeBackground;
    const padding = isDualLayer
        ? '16px 18px 18px'
        : (codeTheme.headerStyle === 'accent-line' ? '20px 22px 20px 24px' : '20px 24px');

    container.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code');
        if (!code) return;

        // 清理可能已有的 header
        const existingHeader = pre.querySelector('[data-code-header]');
        if (existingHeader) existingHeader.remove();

        const doc = pre.ownerDocument || document;

        // 外层卡片边框与圆角
        const borderStyle = codeTheme.borderColor ? `border: 1px solid ${codeTheme.borderColor};` : 'border: none;';
        const accentLeft = codeTheme.headerStyle === 'accent-line' && codeTheme.accentColor
            ? `border-left: 4px solid ${codeTheme.accentColor} !important;`
            : '';
        const paperBorder = codeTheme.headerStyle === 'paper' && codeTheme.borderColor
            ? `border: 1px dashed ${codeTheme.borderColor} !important;`
            : '';
        const scrollbarColor = codeTheme.category === 'dark'
            ? 'rgba(255, 255, 255, 0.2) transparent'
            : 'rgba(0, 0, 0, 0.18) transparent';

        const preStyle = `margin: 22px 0; padding: ${padding}; background-color: ${codeTheme.background} !important; color: ${codeTheme.textColor} !important; border-radius: ${codeTheme.borderRadius || '8px'}; ${borderStyle} ${accentLeft} ${paperBorder} overflow-x: auto; scrollbar-width: thin; scrollbar-color: ${scrollbarColor}; font-variant-ligatures: none; tab-size: 2; box-sizing: border-box;`;
        pre.setAttribute('style', preStyle);

        // 内层代码区样式：双层卡片给 code 加内边距和圆角；单层卡片代码背景透明无内缩
        const codePadding = isDualLayer ? '14px 16px !important; border-radius: 6px;' : '0 !important;';
        const codeBg = isDualLayer ? `${codeTheme.codeBackground} !important;` : 'transparent !important;';
        const codeStyle = `display: block; font-size: inherit !important; line-height: 1.75 !important; font-style: normal !important; white-space: pre; word-break: normal; overflow-wrap: normal; background-color: ${codeBg} color: ${codeTheme.textColor} !important; padding: ${codePadding} margin: 0; border: none;`;
        code.setAttribute('style', codeStyle);

        // 顶部顶栏装饰
        if (codeTheme.headerStyle === 'mac-dots') {
            const header = doc.createElement('div');
            header.setAttribute('data-code-header', 'mac-dots');
            header.setAttribute('style', 'display: block; margin-bottom: 12px; line-height: 10px; height: 10px; white-space: nowrap;');
            header.innerHTML = '<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #ff5f56; margin-right: 6px;"></span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #ffbd2e; margin-right: 6px;"></span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #27c93f;"></span>';
            pre.insertBefore(header, code);
        } else if (codeTheme.headerStyle === 'monochrome-dots') {
            const header = doc.createElement('div');
            header.setAttribute('data-code-header', 'monochrome-dots');
            header.setAttribute('style', 'display: block; margin-bottom: 12px; line-height: 8px; height: 8px; white-space: nowrap;');
            header.innerHTML = '<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #6272a4; opacity: 0.6; margin-right: 6px;"></span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #6272a4; opacity: 0.6; margin-right: 6px;"></span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #6272a4; opacity: 0.6;"></span>';
            pre.insertBefore(header, code);
        } else if (codeTheme.headerStyle === 'terminal') {
            const header = doc.createElement('div');
            header.setAttribute('data-code-header', 'terminal');
            header.setAttribute('style', `display: block; margin-bottom: 12px; font-size: 11px; font-weight: 700; font-family: 'SF Mono', Consolas, monospace; color: ${codeTheme.accentColor || '#10b981'}; letter-spacing: 0.5px; opacity: 0.9;`);
            header.textContent = '>_ terminal';
            pre.insertBefore(header, code);
        }
    });
}
