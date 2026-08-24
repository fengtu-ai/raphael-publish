import { useMemo, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { ArrowLeft } from 'lucide-react';
import { md, preprocessMarkdown, applyTheme } from '../lib/markdown';
import { THEMES } from '../lib/themes';
import { DEFAULT_CODE_THEME_ID } from '../lib/codeThemes';

interface GuideSection {
    id: string;
    label: string;
    code: string;
}

const SECTIONS: GuideSection[] = [
    {
        id: 'heading',
        label: '标题',
        code: [
            '# 一级标题',
            '',
            '## 二级标题',
            '',
            '### 三级标题',
            '',
            '#### 四级标题',
            '',
            '##### 五级标题',
            '',
            '###### 六级标题',
        ].join('\n'),
    },
    {
        id: 'paragraph',
        label: '段落与换行',
        code: [
            '这是一个段落。段落之间以空行分隔，连续多行文字会被合并为同一段落。',
            '如需在段内强制换行，可以在上一行行尾添加两个空格，',
            '这样这句话就会另起一行显示。',
        ].join('\n'),
    },
    {
        id: 'emphasis',
        label: '字体样式',
        code: [
            '**这是粗体**',
            '',
            '*这是斜体*',
            '',
            '***这是粗斜体***',
            '',
            '~~这是删除线~~',
            '',
            '`这是行内代码`',
        ].join('\n'),
    },
    {
        id: 'list',
        label: '列表',
        code: [
            '- 无序列表项一',
            '- 无序列表项二',
            '  - 嵌套列表项（缩进两个空格）',
            '    - 更深层嵌套',
            '',
            '1. 有序列表项一',
            '2. 有序列表项二',
            '   1. 嵌套有序列表项',
        ].join('\n'),
    },
    {
        id: 'quote',
        label: '引用',
        code: [
            '> 这是一段引用文字，支持多行内容，',
            '> 常用于摘录与强调。',
            '',
            '> 第一层引用',
            '>> 第二层嵌套引用',
        ].join('\n'),
    },
    {
        id: 'code',
        label: '代码块',
        code: [
            '```javascript',
            '// 围栏代码块：三个反引号开头，并可标注语言以获得高亮',
            'function greet(name) {',
            '  console.log(`Hello, ${name}!`);',
            '}',
            '```',
            '',
            '行内代码用单个反引号包裹，例如 `npm install`。',
        ].join('\n'),
    },
    {
        id: 'link',
        label: '链接与图片',
        code: [
            '[链接文字](https://example.com)',
            '',
            '![图片描述](https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=400&fit=crop)',
        ].join('\n'),
    },
    {
        id: 'table',
        label: '表格',
        code: [
            '| 语法 | 说明 |',
            '| --- | --- |',
            '| 标题 | `#` 到 `######` 共六级 |',
            '| 粗体 | `**文字**` |',
            '| 斜体 | `*文字*` |',
            '| 删除线 | `~~文字~~` |',
        ].join('\n'),
    },
    {
        id: 'hr',
        label: '分隔线',
        code: [
            '三个及以上连续的连字符、星号或下划线会渲染为分隔线：',
            '',
            '---',
            '',
            '分隔线上方与下方的内容。',
        ].join('\n'),
    },
    {
        id: 'escape',
        label: '转义与内联 HTML',
        code: [
            '\\* 星号前加反斜杠即可原样显示星号*',
            '',
            '支持内联 HTML 标签，例如 <mark>高亮标记</mark> 与 <u>下划线</u>。',
        ].join('\n'),
    },
];

const FULL_MARKDOWN = SECTIONS.map(s => s.code).join('\n\n');

/** 每个小节在完整文档中的起始行（0 基），用于编辑器联动定位 */
const SECTION_LINE_STARTS: Record<string, number> = (() => {
    const starts: Record<string, number> = {};
    let line = 0;
    SECTIONS.forEach((s) => {
        starts[s.id] = line;
        line += s.code.split('\n').length + 1; // 小节之间以一个空行分隔
    });
    return starts;
})();

export default function MarkdownGuide() {
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const previewPaneRef = useRef<HTMLDivElement>(null);
    const [activeId, setActiveId] = useState<string>('');

    const sectionPreviews = useMemo(() => SECTIONS.map(s => ({
        id: s.id,
        label: s.label,
        html: applyTheme(md.render(preprocessMarkdown(s.code)), THEMES[0].id, DEFAULT_CODE_THEME_ID),
    })), []);

    const handleMount: OnMount = (editor) => {
        editorRef.current = editor;
    };

    const jumpTo = (id: string) => {
        setActiveId(id);
        const startLine = SECTION_LINE_STARTS[id];
        if (typeof startLine === 'number') {
            editorRef.current?.revealLineInCenter(startLine + 1);
        }
        previewPaneRef.current
            ?.querySelector(`[data-guide-section="${id}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="h-screen flex flex-col overflow-hidden">
            <header className="glass flex items-center justify-between px-4 sm:px-6 py-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-black dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_12px_rgba(255,255,255,0.15)]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16.5 7.5L5 19H10.5C13.5376 19 16 16.5376 16 13.5C16 10.4624 13.5376 8 10.5 8H8.5V11.5L16.5 7.5Z" fill="var(--color-fg)" className="fill-white dark:fill-black" />
                            <path d="M8.5 4H10.5C15.7467 4 20 8.25329 20 13.5C20 18.7467 15.7467 23 10.5 23H4V4H8.5Z" fill="none" strokeWidth="2.5" stroke="currentColor" className="text-white dark:text-black" />
                            <path d="M4 11.5H8.5" strokeWidth="2.5" strokeLinecap="round" stroke="currentColor" className="text-white dark:text-black" />
                        </svg>
                    </div>
                    <div className="leading-tight">
                        <div className="font-bold text-[15px] tracking-tight text-black dark:text-white">Markdown 语法指南</div>
                        <div className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6]">左侧为源码，右侧为渲染效果，点击下方分类快速定位</div>
                    </div>
                </div>
                <a
                    href="/"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium text-[#0066cc] dark:text-[#0a84ff] hover:bg-[#0066cc0d] dark:hover:bg-[#0a84ff1a] transition-colors shrink-0"
                >
                    <ArrowLeft size={15} />
                    <span>返回编辑器</span>
                </a>
            </header>

            <nav className="shrink-0 flex items-center gap-2 overflow-x-auto no-scrollbar px-4 sm:px-6 py-2.5 border-b border-[#00000010] dark:border-[#ffffff10] bg-white/40 dark:bg-[#1c1c1e]/40">
                {SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => jumpTo(s.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition-all cursor-pointer ${
                            activeId === s.id
                                ? 'bg-[#0066cc] text-white border-[#0066cc] dark:bg-[#0a84ff] dark:border-[#0a84ff]'
                                : 'bg-white text-[#4b4b50] border-[#00000015] hover:text-[#0066cc] hover:border-[#0066cc55] dark:bg-[#2c2c2e] dark:text-[#d5d5d9] dark:border-[#ffffff15] dark:hover:text-[#0a84ff] dark:hover:border-[#0a84ff66]'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
            </nav>

            <main className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[45%_55%] lg:grid-rows-1 lg:grid-cols-2">
                <section className="min-h-0 lg:border-r border-[#00000012] dark:border-[#ffffff14]">
                    <Editor
                        height="100%"
                        language="markdown"
                        value={FULL_MARKDOWN}
                        theme="vs"
                        onMount={handleMount}
                        loading={<div className="h-full flex items-center justify-center text-sm text-[#86868b]">正在加载编辑器…</div>}
                        options={{
                            automaticLayout: true,
                            readOnly: true,
                            domReadOnly: true,
                            wordWrap: 'on',
                            minimap: { enabled: false },
                            lineNumbers: 'on',
                            lineNumbersMinChars: 3,
                            folding: true,
                            fontSize: 14,
                            lineHeight: 24,
                            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                            padding: { top: 20, bottom: 20 },
                            scrollBeyondLastLine: false,
                            smoothScrolling: true,
                            renderLineHighlight: 'line',
                            overviewRulerBorder: false,
                            overviewRulerLanes: 0,
                            contextmenu: false,
                            scrollbar: {
                                horizontal: 'visible',
                                vertical: 'visible',
                                horizontalScrollbarSize: 10,
                                verticalScrollbarSize: 10,
                                alwaysConsumeMouseWheel: false,
                            },
                        }}
                    />
                </section>

                <section ref={previewPaneRef} className="min-h-0 overflow-y-auto bg-white dark:bg-[#1c1c1e] editor-scrollbar">
                    {sectionPreviews.map((s, idx) => (
                        <div
                            key={s.id}
                            data-guide-section={s.id}
                            className={`px-6 sm:px-10 py-7 scroll-mt-2 ${idx > 0 ? 'border-t border-[#0000000a] dark:border-[#ffffff10]' : ''}`}
                        >
                            <div dangerouslySetInnerHTML={{ __html: s.html }} />
                        </div>
                    ))}
                </section>
            </main>
        </div>
    );
}
