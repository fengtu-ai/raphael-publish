import { describe, expect, it } from 'vitest';
import { md, preprocessMarkdown, applyTheme } from './markdown';
import { THEMES } from './themes';
import { DEFAULT_CODE_THEME_ID } from './codeThemes';
import { SECTIONS, UNSUPPORTED_SNIPPET } from '../components/MarkdownGuide';

function render(code: string): string {
    return applyTheme(md.render(preprocessMarkdown(code)), THEMES[0].id, DEFAULT_CODE_THEME_ID);
}

function example(sectionId: string, title: string): string {
    const section = SECTIONS.find((s) => s.id === sectionId);
    const ex = section?.examples.find((e) => e.title === title);
    if (!ex) throw new Error(`missing example ${sectionId}/${title}`);
    return ex.code;
}

describe('MarkdownGuide content', () => {
    it('has complete metadata for every section', () => {
        expect(SECTIONS.length).toBeGreaterThanOrEqual(10);
        for (const s of SECTIONS) {
            expect(s.id).toBeTruthy();
            expect(s.label).toBeTruthy();
            expect(s.summary).toBeTruthy();
            expect(s.tips.length).toBeGreaterThan(0);
            expect(s.examples.length).toBeGreaterThan(0);
        }
    });

    it('renders headings', () => {
        const html = render(example('heading', '常用标题'));
        expect(html).toContain('<h2');
        expect(html).toContain('<h3');
    });

    it('renders hard breaks inside a paragraph', () => {
        const html = render(example('paragraph', '段内换行：行尾两个空格，或一个反斜杠'));
        // 第一行行尾两个空格 + 第三行行尾反斜杠，各产生一个 <br>
        expect(html.match(/<br\s*\/?>/g)?.length).toBe(2);
    });

    it('renders all inline emphasis styles', () => {
        const html = render(example('emphasis', '五种行内样式'));
        // 主题会给标签加 inline style，只断言标签前缀
        expect(html).toContain('<strong');
        expect(html).toContain('<em');
        expect(html).toContain('<s>');
        expect(html).toContain('<code');
    });

    it('renders nested and ordered lists', () => {
        expect(render(example('list', '无序列表与嵌套'))).toContain('<ul');
        const ordered = render(example('list', '有序列表'));
        expect(ordered).toContain('<ol');
        expect(ordered.match(/<li[\s>]/g)?.length).toBe(3);
    });

    it('renders nested quotes', () => {
        const html = render(example('quote', '嵌套引用'));
        expect(html.match(/<blockquote[\s>]/g)?.length).toBe(2);
    });

    it('renders fenced code with highlight', () => {
        const html = render(example('code', '围栏代码块'));
        expect(html).toContain('<pre');
        expect(html).toContain('greet');
    });

    it('renders links and images', () => {
        const html = render(example('link-image', '链接与单图'));
        expect(html).toContain('<a href="https://example.com"');
        expect(html).toContain('<img');
    });

    it('renders tables with alignment', () => {
        const html = render(example('table', '列对齐'));
        expect(html).toContain('<table');
        expect(html).toContain('text-align:center');
        expect(html).toContain('text-align:right');
    });

    it('renders hr only when surrounded by blank lines', () => {
        expect(render(example('hr', '分隔线'))).toContain('<hr');
    });

    it('renders escapes literally and keeps inline html', () => {
        const html = render(example('escape', '转义'));
        expect(html).not.toContain('<h1');
        expect(html).toContain('# 开头');
        const html2 = render(example('escape', '内联 HTML'));
        expect(html2).toContain('<mark>');
        expect(html2).toContain('<kbd>');
    });

    it('shows unsupported syntax literally', () => {
        const html = render(UNSUPPORTED_SNIPPET);
        expect(html).toContain('[ ]');
        expect(html).toContain('[^1]');
        expect(html).toContain('==双等号高亮==');
    });
});
