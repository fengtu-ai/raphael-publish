import { describe, expect, it } from 'vitest';
import { applyTheme, md, preprocessMarkdown } from './markdown';
import { makeWeChatCompatible } from './wechatCompat';

function renderMarkdown(markdown: string) {
    return md.render(preprocessMarkdown(markdown));
}

describe('preprocessMarkdown', () => {
    it('keeps bold rendering intact next to trailing punctuation', () => {
        const html = renderMarkdown('2025年初，伦敦黄金市场的一个月拆借利率一度升至**5%**。');

        expect(html).toContain('<strong>5%</strong>。');
        expect(html).not.toContain('**5%**');
    });

    it('repairs bold segments that start with a symbol and attach to previous text', () => {
        const html = renderMarkdown('利率变化至**-5%**。');
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const strong = doc.querySelector('strong');

        expect(strong?.textContent?.replace(/\u200B/g, '')).toBe('-5%');
    });

    it('does not merge separate bold blocks across blank lines', () => {
        const html = renderMarkdown('**5 %**\n\n**5%**');
        const doc = new DOMParser().parseFromString(html, 'text/html');

        expect(doc.querySelectorAll('strong')).toHaveLength(2);
    });
});

describe('applyTheme', () => {
    it('groups images separated by a single newline into an image grid', () => {
        const themed = applyTheme(renderMarkdown('![](a.png)\n![](b.png)'), 'apple');
        const doc = new DOMParser().parseFromString(themed, 'text/html');
        const grid = doc.querySelector('.image-grid');

        expect(grid).not.toBeNull();
        expect(grid?.querySelectorAll('img')).toHaveLength(2);
    });

    it('keeps images separated by a blank line stacked vertically', () => {
        const themed = applyTheme(renderMarkdown('![](a.png)\n\n![](b.png)'), 'apple');
        const doc = new DOMParser().parseFromString(themed, 'text/html');

        expect(doc.querySelector('.image-grid')).toBeNull();
        expect(doc.querySelectorAll('p')).toHaveLength(2);
        expect(doc.querySelectorAll('img')).toHaveLength(2);
    });

    it('keeps highlighted comments non-italic for apple', () => {
        const rawHtml = renderMarkdown('```javascript\n// 中文注释\nconst raphael = 1;\n```');
        const themed = applyTheme(rawHtml, 'apple');
        const doc = new DOMParser().parseFromString(themed, 'text/html');
        const code = doc.querySelector('pre code');
        const comment = doc.querySelector('.hljs-comment');

        expect(code?.getAttribute('style')).toContain('font-style: normal !important;');
        expect(code?.getAttribute('style')).toContain('white-space: pre;');
        expect(comment?.getAttribute('style')).toContain('font-style: normal;');
    });

    it('does not override bloomberg block-code font inheritance', () => {
        const rawHtml = renderMarkdown('```javascript\n// terminal theme\nconst raphael = 1;\n```');
        const themed = applyTheme(rawHtml, 'bloomberg');
        const doc = new DOMParser().parseFromString(themed, 'text/html');
        const container = doc.querySelector('body > div');
        const pre = doc.querySelector('pre');
        const code = doc.querySelector('pre code');

        expect(container?.getAttribute('style')).toContain('"Courier New"');
        expect(pre?.getAttribute('style')).not.toContain('font-family:');
        expect(code?.getAttribute('style')).not.toContain('font-family:');
        expect(themed).not.toContain('"SF Mono", "Cascadia Code", "Fira Code", Consolas, Menlo, Monaco, monospace');
    });

    it('renders clean-light code theme without mac dots header', () => {
        const rawHtml = renderMarkdown('```typescript\nconst a = 123;\n```');
        const themed = applyTheme(rawHtml, 'apple', 'clean-light');
        const doc = new DOMParser().parseFromString(themed, 'text/html');

        expect(doc.querySelector('[data-code-header]')).toBeNull();
        expect(doc.querySelector('pre')?.getAttribute('style')).toContain('background-color: #f6f8fa');
    });

    it('renders mac-classic-dark code theme with mac dots header', () => {
        const rawHtml = renderMarkdown('```typescript\nconst a = 123;\n```');
        const themed = applyTheme(rawHtml, 'apple', 'mac-classic-dark');
        const doc = new DOMParser().parseFromString(themed, 'text/html');

        expect(doc.querySelector('[data-code-header="mac-dots"]')).not.toBeNull();
        expect(doc.querySelector('pre')?.getAttribute('style')).toContain('background-color: #21252b');
    });

    it('renders accent-line-light code theme with left border', () => {
        const rawHtml = renderMarkdown('```typescript\nconst a = 123;\n```');
        const themed = applyTheme(rawHtml, 'apple', 'accent-line-light');
        const doc = new DOMParser().parseFromString(themed, 'text/html');

        expect(doc.querySelector('[data-code-header]')).toBeNull();
        expect(doc.querySelector('pre')?.getAttribute('style')).toContain('border-left: 4px solid #3b82f6');
    });

    it('renders terminal-console code theme with terminal header', () => {
        const rawHtml = renderMarkdown('```typescript\nconst a = 123;\n```');
        const themed = applyTheme(rawHtml, 'apple', 'terminal-console');
        const doc = new DOMParser().parseFromString(themed, 'text/html');

        expect(doc.querySelector('[data-code-header="terminal"]')?.textContent).toBe('>_ terminal');
        expect(doc.querySelector('pre')?.getAttribute('style')).toContain('background-color: #121214');
    });

    it('renders editorial column layout theme with cover, preamble, section numbers, toc, and list', async () => {
        const markdown = `# 智库报告标题

> 这是一句核心观点的开篇引言导读。

## 第一章 核心洞察

- 数据驱动分析
- 商业价值闭环

## 第二章 实施路径

1. 第一步执行
2. 第二步验证

---
`;
        const rawHtml = renderMarkdown(markdown);
        const themed = applyTheme(rawHtml, 'editorial-cyber', 'clean-light');
        const doc = new DOMParser().parseFromString(themed, 'text/html');

        // 验证真实 H1 标题
        expect(doc.querySelector('h1')?.textContent).toContain('智库报告标题');

        // 验证真实引言导读
        expect(themed).toContain('这是一句核心观点的开篇引言导读。');

        // 验证纯数字胶囊章节
        expect(themed).toContain('01');
        expect(themed).toContain('02');
        expect(doc.querySelector('h2')?.textContent).toContain('第一章 核心洞察');

        // 验证几何微星分割线
        expect(themed).toContain('◆ ✦ ◆');

        // 验证统一公共居中底部三连卡
        expect(themed).toContain('读到这里，如果觉得有用，随手点个赞、转发给需要的朋友吧。');
        expect(themed).toContain('关注');
        expect(themed).toContain('点赞');
        expect(themed).toContain('转发');

        // 验证索引自标
        expect(doc.querySelector('[data-md-type="heading"]')).not.toBeNull();
        expect(doc.querySelector('[data-md-type="quote"]')).not.toBeNull();
        expect(doc.querySelector('[data-md-type="list"]')).not.toBeNull();

        // 验证微信复制兼容转换
        const wechatOutput = await makeWeChatCompatible(themed, 'editorial-cyber', 'clean-light');
        expect(wechatOutput).toContain('智库报告标题');
        expect(wechatOutput).toContain('01');
        expect(wechatOutput).toContain('第一章 核心洞察');
    });

    it('renders image grid with side-by-side layout in editorial layout theme', () => {
        const markdown = `![](https://images.unsplash.com/photo-1?w=600)\n![](https://images.unsplash.com/photo-2?w=600)`;
        const rawHtml = renderMarkdown(markdown);
        const themed = applyTheme(rawHtml, 'editorial-cyber', 'clean-light');
        const doc = new DOMParser().parseFromString(themed, 'text/html');

        const grid = doc.querySelector('.image-grid');
        expect(grid).not.toBeNull();
        const imgs = grid?.querySelectorAll('img');
        expect(imgs?.length).toBe(2);
        expect(imgs?.[0].getAttribute('style')).toContain('calc(50%');
    });

    it('renders editorial-subai with transparent background', () => {
        const markdown = `# 素白测试\n\n正文内容`;
        const rawHtml = renderMarkdown(markdown);
        const themed = applyTheme(rawHtml, 'editorial-subai', 'clean-light');
        const doc = new DOMParser().parseFromString(themed, 'text/html');

        expect(doc.querySelector('section')?.getAttribute('style')).toContain('background:transparent');
    });
});
