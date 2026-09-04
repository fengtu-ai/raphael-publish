import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    Bold,
    Braces,
    Check,
    ChevronUp,
    Code,
    Copy,
    Eye,
    Heading,
    Image as ImageIcon,
    Info,
    Lightbulb,
    List,
    Minus,
    Moon,
    PencilLine,
    Quote,
    RotateCcw,
    Search,
    Sun,
    Table as TableIcon,
    Type,
    type LucideIcon,
} from 'lucide-react';
import { md, preprocessMarkdown, applyTheme } from '../lib/markdown';
import { THEMES } from '../lib/themes';
import { DEFAULT_CODE_THEME_ID } from '../lib/codeThemes';

interface GuideExample {
    title: string;
    code: string;
}

interface GuideSection {
    id: string;
    label: string;
    icon: LucideIcon;
    summary: string;
    tips: string[];
    examples: GuideExample[];
}

export const SECTIONS: GuideSection[] = [    {
        id: 'heading',
        label: '标题',
        icon: Heading,
        summary: '`#` 的个数代表级别，`#` 后面必须空一格；推文正文建议只用二、三级标题。',
        tips: [
            '`#` 后面不加空格，标题就渲染不出来。',
            '不要跳级（比如二级后面直接跟四级），层级一乱目录也没法看。',
            '一级标题 `#` 全文只出现一次，一般留给文章大标题。',
        ],
        examples: [
            {
                title: '常用标题',
                code: [
                    '## 二级标题：拿来当章节名',
                    '### 三级标题：拿来当小节名',
                    '#### 四级标题：再往下就不建议用了',
                ].join('\n'),
            },
        ],
    },
    {
        id: 'paragraph',
        label: '段落与换行',
        icon: Type,
        summary: '空一行就是另起一段；段内直接回车换行是不生效的，想换行得用下面的办法。',
        tips: [
            '连续多行文字如果中间没空行，会被合并成同一段。',
            '行尾空格看不见、容易被编辑器吞掉，段内换行更推荐用反斜杠。',
            '首行缩进（空两格）在 Markdown 里没有意义，不用写。',
        ],
        examples: [
            {
                title: '分段：段落之间空一行',
                code: [
                    '春水初生，春林初盛，春风十里，不如你。',
                    '',
                    '上面空了一行，所以这是第二段。',
                    '段内直接回车换行是不生效的，',
                    '这两行最终显示为同一段。',
                ].join('\n'),
            },
            {
                title: '段内换行：行尾两个空格，或一个反斜杠',
                code: [
                    '想在段内另起一行，就在上一行末尾敲两个空格（本行末尾真有两个空格），  ',
                    '然后回车，这一行就会另起一行，但还属于同一段。',
                    '看不见空格？行尾改用一个反斜杠 \\',
                    '效果完全一样，还不会被编辑器误吞。',
                ].join('\n'),
            },
        ],
    },
    {
        id: 'emphasis',
        label: '强调与行内代码',
        icon: Bold,
        summary: '两对星号划重点、一对星号表轻读；短命令、快捷键用反引号包起来。',
        tips: [
            '加粗前后最好各留一个空格；紧贴中文标点也行，比如“升至**5%**。”。',
            '标记符号紧贴空格会失效，比如 `** 这样 ** `是渲染不出来的。',
            '行内代码里如果本身含反引号，外层改用双反引号包裹。',
        ],
        examples: [
            {
                title: '五种行内样式',
                code: [
                    '**粗体**：划重点，一眼抓住人',
                    '*斜体*：轻声细语，英文书名常用',
                    '***粗斜体***：存在感拉满，中文里慎用',
                    '~~删除线~~：原价 129，现价 69',
                    '快捷键 `Ctrl + F` 记得用行内代码包起来',
                ].join('\n'),
            },
        ],
    },
    {
        id: 'list',
        label: '列表',
        icon: List,
        summary: '`-` 做无序列表，`1.` 做有序列表；子项在前面缩进两格。',
        tips: [
            '有序列表序号全写 `1.` 也会自动编号，中间增删条目不怕乱。',
            '`-`、`*`、`+` 都能做无序列表，同一篇里统一用一种。',
            '列表项里可以再套加粗、代码甚至图片，随便混写。',
        ],
        examples: [
            {
                title: '无序列表与嵌套',
                code: [
                    '- Mac 纯净白：干净清爽',
                    '- 微信原生：熟悉亲切',
                    '  - 子项前面缩进两格',
                    '  - 再来一个子项',
                    '- Medium 博客风：大气耐看',
                ].join('\n'),
            },
            {
                title: '有序列表',
                code: [
                    '1. 从飞书 / Notion 复制一段富文本',
                    '2. 粘贴到左侧编辑器，自动变成 Markdown',
                    '3. 点「复制到公众号」，去后台粘贴发布',
                ].join('\n'),
            },
        ],
    },
    {
        id: 'quote',
        label: '引用',
        icon: Quote,
        summary: '`>` 开头的就是引用，适合放金句、摘要和转述；再套一层就是嵌套引用。',
        tips: [
            '本站主题会把文首的引用渲染成「金句卡」，适合做开篇引言。',
            '引用里面可以继续用加粗、列表，甚至再嵌套一层引用。',
            '连续多行 `>` 开头的内容同属一段，空一行则另起一段引用。',
        ],
        examples: [
            {
                title: '单层引用',
                code: [
                    '> 所有的相遇，都是久别重逢。',
                    '> 引用可以写多行，它们同属一段。',
                ].join('\n'),
            },
            {
                title: '嵌套引用',
                code: [
                    '> 转述对方的观点',
                    '>> 再缩进一层，写你的锐评',
                ].join('\n'),
            },
        ],
    },
    {
        id: 'code',
        label: '代码块',
        icon: Code,
        summary: '三个反引号围起来就是代码块，后面标注语言即可获得语法高亮。',
        tips: [
            '标注语言（javascript、python、bash……）后才有高亮，不标就是纯文本。',
            '代码块右上角可以切换高亮主题，Mac 风、终端风都有。',
            '短命令别用代码块，用行内代码 `` ` `` 包一下就行。',
        ],
        examples: [
            {
                title: '围栏代码块',
                code: [
                    '```javascript',
                    'function greet(name) {',
                    '  return `你好，${name}！`;',
                    '}',
                    '```',
                ].join('\n'),
            },
            {
                title: '行内代码',
                code: [
                    '终端里跑 `npm run dev` 启动预览，',
                    '编辑器里按 `Ctrl + F` 可以搜索。',
                ].join('\n'),
            },
        ],
    },
    {
        id: 'link-image',
        label: '链接与图片',
        icon: ImageIcon,
        summary: '`[文字](地址)` 是链接，前面加个 `!` 就是图片；本站支持多图自动并排。',
        tips: [
            '两张图之间只换行、不空行，会自动左右并排；中间空一行则上下竖排。',
            '外链图片在「复制到公众号」时会自动转 Base64，不会挂。',
            '方括号里写清楚图片描述，加载失败时至少还有占位文字。',
        ],
        examples: [
            {
                title: '链接与单图',
                code: [
                    '[点这里访问官网](https://example.com)',
                    '',
                    '![封面图：一只好奇的猫](https://picsum.photos/seed/cat/600/400)',
                ].join('\n'),
            },
            {
                title: '两张图自动并排（本站独家）',
                code: [
                    '![](https://picsum.photos/seed/a/600/400)',
                    '![](https://picsum.photos/seed/b/600/400)',
                ].join('\n'),
            },
        ],
    },
    {
        id: 'table',
        label: '表格',
        icon: TableIcon,
        summary: '用 `|` 画格子，第二行的 `---` 声明表头，冒号控制列对齐。',
        tips: [
            '每行竖线数量要一致，对不齐整张表都会垮。',
            '单元格里可以用加粗和行内代码，但不能再套一张表。',
            '列数一多手机上会挤，推文里表格尽量控制在 3～4 列。',
        ],
        examples: [
            {
                title: '基础表格',
                code: [
                    '| 版本 | 价格 | 适合谁 |',
                    '| --- | --- | --- |',
                    '| 免费版 | ¥0 | 偶尔写写 |',
                    '| 专业版 | ¥99 / 年 | 高频创作者 |',
                ].join('\n'),
            },
            {
                title: '列对齐',
                code: [
                    '| 功能 | 数量 | 金额 |',
                    '| :--- | :---: | ---: |',
                    '| 需求分析 | 42 | 9,800 |',
                    '| 快速验证 | 7 | 300 |',
                ].join('\n'),
            },
        ],
    },
    {
        id: 'hr',
        label: '分隔线',
        icon: Minus,
        summary: '单独一行写三个以上的 `-`、`*` 或 `_`，前后各空一行。',
        tips: [
            '`***` 和 `___` 效果一样，选一种顺手的就行。',
            '特殊排版主题会把它渲染成装饰纹样，而不是一条直线。',
            '分隔线夹在两个标题之间时，记得上下都空行。',
        ],
        examples: [
            {
                title: '分隔线',
                code: [
                    '上个章节到此结束。',
                    '',
                    '---',
                    '',
                    '下个章节从这里开始。',
                ].join('\n'),
            },
        ],
    },
    {
        id: 'escape',
        label: '转义与内联 HTML',
        icon: Braces,
        summary: '想原样显示符号就在前面加反斜杠；HTML 标签可以直接混写。',
        tips: [
            '只转义“会惹事”的符号就行，普通文字前的反斜杠会原样显示出来。',
            '内联 HTML 適合做 Markdown 做不到的样式，比如按键、上下标。',
            '块级 HTML（div、table 手写）容易和主题样式打架，能不用就不用。',
        ],
        examples: [
            {
                title: '转义',
                code: [
                    '\\*加了反斜杠，星号就只显示星号\\*',
                    '\\# 开头的井号也不会变成标题',
                    '\\`反引号也能原样显示\\`',
                ].join('\n'),
            },
            {
                title: '内联 HTML',
                code: [
                    '支持直接写 HTML：<mark>划线高亮</mark>、<u>下划线</u>、',
                    '<kbd>Ctrl</kbd> + <kbd>C</kbd> 这样的按键样式。',
                ].join('\n'),
            },
        ],
    },
];

export const UNSUPPORTED_SNIPPET = [
    '- [ ] 任务列表：暂不支持，会原样显示',
    '[^1] 脚注：暂不支持，会原样显示',
    '==双等号高亮==：暂不支持，会原样显示',
].join('\n');

function renderPreview(code: string): string {
    try {
        return applyTheme(md.render(preprocessMarkdown(code)), THEMES[0].id, DEFAULT_CODE_THEME_ID);
    } catch {
        return '<p>渲染失败，换个写法试试。</p>';
    }
}

async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch {
            return false;
        }
    }
}

function buildCheatSheetMarkdown(): string {
    const lines: string[] = [
        '# Markdown 速查手册',
        '',
        '> 左边改源码、右边看效果的一份速查表，示例都可以直接改着玩。',
        '',
    ];
    SECTIONS.forEach((section, index) => {
        lines.push(`## ${String(index + 1).padStart(2, '0')} ${section.label}`, '', section.summary, '');
        section.examples.forEach((example) => {
            lines.push(`### ${example.title}`, '');
            // 用 4 空格缩进代码块，避免示例里的围栏反引号与外层冲突
            example.code.split('\n').forEach((line) => lines.push(line ? `    ${line}` : ''));
            lines.push('');
        });
        lines.push('**要点**', '');
        section.tips.forEach((tip) => lines.push(`- ${tip}`));
        lines.push('');
    });
    return lines.join('\n');
}

function ExampleBlock({ title, initialCode }: { title: string; initialCode: string }) {
    const [code, setCode] = useState(initialCode);
    const [copied, setCopied] = useState(false);
    const taRef = useRef<HTMLTextAreaElement>(null);
    const edited = code !== initialCode;

    useEffect(() => {
        const el = taRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 480)}px`;
    }, [code]);

    const html = useMemo(() => renderPreview(code), [code]);

    const handleCopy = async () => {
        if (await copyText(code)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <div>
            <div className="mb-2 text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{title}</div>
            <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
                <div className="grid md:grid-cols-2 md:divide-x md:divide-black/10 md:dark:divide-white/10">
                    <div className="bg-[#f5f5f7]/80 dark:bg-black/40">
                        <div className="flex items-center justify-between px-3.5 py-2 border-b border-black/[0.06] dark:border-white/10">
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#86868b] dark:text-[#a1a1a6]">
                                <PencilLine size={13} />
                                源码 · 可编辑
                                {edited && <span className="w-1.5 h-1.5 rounded-full bg-[#ff9f0a]" title="已修改" />}
                            </span>
                            <span className="flex items-center gap-1">
                                {edited && (
                                    <button
                                        type="button"
                                        onClick={() => setCode(initialCode)}
                                        title="恢复示例"
                                        className="p-1.5 rounded-full text-[#86868b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                    >
                                        <RotateCcw size={13} />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    title="复制源码"
                                    className="p-1.5 rounded-full text-[#86868b] dark:text-[#a1a1a6] hover:text-[#0066cc] dark:hover:text-[#0a84ff] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    {copied ? <Check size={13} className="text-[#34c759]" /> : <Copy size={13} />}
                                </button>
                            </span>
                        </div>
                        <textarea
                            ref={taRef}
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            spellCheck={false}
                            className="block w-full resize-none bg-transparent px-3.5 py-3 font-mono text-[13px] leading-[1.7] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                        />
                    </div>
                    <div className="bg-white dark:bg-[#1c1c1e] border-t md:border-t-0 border-black/[0.06] dark:border-white/10">
                        <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-black/[0.06] dark:border-white/10 text-[12px] font-medium text-[#86868b] dark:text-[#a1a1a6]">
                            <Eye size={13} />
                            效果
                        </div>
                        <div className="overflow-x-auto">
                            <div dangerouslySetInnerHTML={{ __html: html }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MarkdownGuide() {
    const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() =>
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    );
    const [query, setQuery] = useState('');
    const [activeId, setActiveId] = useState(SECTIONS[0].id);
    const [copiedAll, setCopiedAll] = useState(false);

    useEffect(() => {
        document.title = 'Markdown 速查手册';
    }, []);

    const toggleTheme = () => {
        setThemeMode((prev) => {
            const next = prev === 'light' ? 'dark' : 'light';
            document.documentElement.classList.toggle('dark', next === 'dark');
            return next;
        });
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return SECTIONS;
        return SECTIONS.filter((s) =>
            [s.label, s.summary, ...s.tips, ...s.examples.map((e) => `${e.title}\n${e.code}`)]
                .join('\n')
                .toLowerCase()
                .includes(q),
        );
    }, [query]);

    // 滚动监听：高亮左侧目录
    useEffect(() => {
        if (query.trim()) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id.replace(/^guide-/, ''));
                    }
                });
            },
            { rootMargin: '-25% 0px -65% 0px' },
        );
        SECTIONS.forEach((s) => {
            const el = document.getElementById(`guide-${s.id}`);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [query]);

    const jumpTo = (id: string) => {
        setActiveId(id);
        document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleCopyAll = async () => {
        if (await copyText(buildCheatSheetMarkdown())) {
            setCopiedAll(true);
            setTimeout(() => setCopiedAll(false), 2000);
        }
    };

    const exampleCount = useMemo(() => SECTIONS.reduce((n, s) => n + s.examples.length, 0), []);

    return (
        <div className="min-h-screen bg-[#fbfbfd] dark:bg-black text-[#1d1d1f] dark:text-[#f5f5f7] antialiased transition-colors duration-300">
            <header className="glass sticky top-0 z-[100]">
                <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-black dark:bg-white shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16.5 7.5L5 19H10.5C13.5376 19 16 16.5376 16 13.5C16 10.4624 13.5376 8 10.5 8H8.5V11.5L16.5 7.5Z" className="fill-white dark:fill-black" />
                            <path d="M8.5 4H10.5C15.7467 4 20 8.25329 20 13.5C20 18.7467 15.7467 23 10.5 23H4V4H8.5Z" fill="none" strokeWidth="2.5" stroke="currentColor" className="text-white dark:text-black" />
                            <path d="M4 11.5H8.5" strokeWidth="2.5" strokeLinecap="round" stroke="currentColor" className="text-white dark:text-black" />
                        </svg>
                    </div>
                    <div className="leading-tight min-w-0">
                        <div className="font-bold text-[15px] tracking-tight">Markdown 速查手册</div>
                        <div className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] truncate">左边改源码，右边即时看效果</div>
                    </div>
                    <div className="flex-1" />
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/[0.04] dark:bg-white/10 w-56 focus-within:ring-2 focus-within:ring-[#0066cc]/40 transition-shadow">
                        <Search size={14} className="text-[#86868b] dark:text-[#a1a1a6] shrink-0" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="搜索语法，比如“表格”"
                            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#86868b]/70 dark:placeholder:text-[#a1a1a6]/70"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={toggleTheme}
                        title={themeMode === 'light' ? '切换深色' : '切换浅色'}
                        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    >
                        {themeMode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <a
                        href="/"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium bg-black text-white dark:bg-white dark:text-black hover:opacity-85 active:scale-95 transition-all shrink-0"
                    >
                        <ArrowLeft size={15} />
                        <span className="hidden sm:inline">返回编辑器</span>
                        <span className="sm:hidden">返回</span>
                    </a>
                </div>
                <div className="md:hidden px-4 pb-2.5">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/[0.04] dark:bg-white/10 focus-within:ring-2 focus-within:ring-[#0066cc]/40 transition-shadow">
                        <Search size={14} className="text-[#86868b] dark:text-[#a1a1a6] shrink-0" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="搜索语法，比如“表格”"
                            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#86868b]/70 dark:placeholder:text-[#a1a1a6]/70"
                        />
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-20 flex gap-8 items-start">
                <aside className="hidden lg:block w-52 shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto no-scrollbar py-8">
                    <div className="text-[11px] font-semibold tracking-widest text-[#86868b] dark:text-[#a1a1a6] px-3 mb-2">目录</div>
                    <nav className="space-y-0.5">
                        {SECTIONS.map((s, index) => {
                            const Icon = s.icon;
                            const active = activeId === s.id;
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => jumpTo(s.id)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-all cursor-pointer text-left ${
                                        active
                                            ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                                            : 'text-[#4b4b50] dark:text-[#d5d5d9] hover:bg-black/5 dark:hover:bg-white/10'
                                    }`}
                                >
                                    <span className={`font-mono text-[11px] ${active ? 'opacity-60' : 'text-[#86868b] dark:text-[#a1a1a6]'}`}>
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <Icon size={15} className="shrink-0" />
                                    <span className="truncate">{s.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                    <a
                        href="/"
                        className="mt-4 block rounded-2xl p-4 bg-gradient-to-br from-[#0066cc] to-[#004999] dark:from-[#0a84ff] dark:to-[#0066cc] text-white hover:opacity-95 active:scale-[0.98] transition-all"
                    >
                        <div className="text-[13px] font-bold">去编辑器实战</div>
                        <div className="mt-0.5 text-[12px] text-white/75">把刚学会的语法粘过去试试</div>
                    </a>
                </aside>

                <main className="flex-1 min-w-0 py-6 sm:py-8 space-y-5">
                    <div className="rounded-[24px] bg-black text-white dark:bg-[#1c1c1e] dark:ring-1 dark:ring-white/10 px-6 sm:px-9 py-8 sm:py-10 relative overflow-hidden">
                        <div
                            className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-25 blur-3xl"
                            style={{ background: 'radial-gradient(circle, #0a84ff 0%, transparent 70%)' }}
                        />
                        <div className="text-[11px] font-semibold tracking-[0.2em] text-white/50">CHEAT SHEET</div>
                        <h1 className="mt-2 text-[26px] sm:text-[32px] font-bold tracking-tight leading-tight">
                            Markdown 速查手册
                        </h1>
                        <p className="mt-2.5 text-[14px] leading-relaxed text-white/70 max-w-xl">
                            {SECTIONS.length} 组语法，{exampleCount} 个可运行示例。每个示例都能直接改，
                            右边即时看效果——改崩了点一下即可恢复。
                        </p>
                        <div className="mt-5 flex flex-wrap items-center gap-2.5">
                            <button
                                type="button"
                                onClick={handleCopyAll}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13.5px] font-semibold bg-white text-black hover:bg-white/90 active:scale-95 transition-all cursor-pointer"
                            >
                                {copiedAll ? <Check size={15} className="text-[#34c759]" /> : <Copy size={15} />}
                                {copiedAll ? '已复制，去编辑器粘贴' : '复制整份速查 Markdown'}
                            </button>
                            <button
                                type="button"
                                onClick={() => jumpTo(SECTIONS[0].id)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13.5px] font-semibold bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                            >
                                开始速查
                            </button>
                        </div>
                    </div>

                    {filtered.length === 0 && (
                        <div className="rounded-[22px] bg-white dark:bg-[#1c1c1e] ring-1 ring-black/[0.06] dark:ring-white/10 px-6 py-12 text-center">
                            <div className="text-[15px] font-semibold">没有找到“{query}”相关的语法</div>
                            <div className="mt-1.5 text-[13px] text-[#86868b] dark:text-[#a1a1a6]">换个关键词试试，比如“表格”“图片”“代码”</div>
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="mt-4 px-5 py-2 rounded-full text-[13px] font-semibold bg-black text-white dark:bg-white dark:text-black hover:opacity-85 active:scale-95 transition-all cursor-pointer"
                            >
                                清空搜索
                            </button>
                        </div>
                    )}

                    {filtered.map((section) => {
                        const Icon = section.icon;
                        const globalIndex = SECTIONS.indexOf(section);
                        return (
                            <section
                                key={section.id}
                                id={`guide-${section.id}`}
                                className="scroll-mt-32 rounded-[22px] bg-white dark:bg-[#1c1c1e] ring-1 ring-black/[0.06] dark:ring-white/10 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] dark:shadow-none px-5 sm:px-7 py-6 sm:py-7"
                            >
                                <div className="flex items-start gap-3.5">
                                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-black text-white dark:bg-white dark:text-black shrink-0">
                                        <Icon size={19} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-[12px] text-[#86868b] dark:text-[#a1a1a6]">
                                                {String(globalIndex + 1).padStart(2, '0')}
                                            </span>
                                            <h2 className="text-[18px] font-bold tracking-tight">{section.label}</h2>
                                            <span className="text-[11.5px] font-medium px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/10 text-[#86868b] dark:text-[#a1a1a6]">
                                                {section.examples.length} 个示例
                                            </span>
                                        </div>
                                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#4b4b50] dark:text-[#d5d5d9]">
                                            {section.summary}
                                        </p>
                                    </div>
                                </div>

                                <ul className="mt-4 space-y-1.5 rounded-2xl bg-[#f5f5f7]/80 dark:bg-black/30 px-4 py-3">
                                    {section.tips.map((tip) => (
                                        <li key={tip} className="flex items-start gap-2 text-[13px] leading-relaxed text-[#4b4b50] dark:text-[#d5d5d9]">
                                            <Lightbulb size={14} className="mt-[3px] shrink-0 text-[#ff9f0a]" />
                                            <span>{tip}</span>
                                        </li>
                                    ))}
                                </ul>

                                <div className="mt-4 space-y-4">
                                    {section.examples.map((example) => (
                                        <ExampleBlock
                                            key={`${section.id}-${example.title}`}
                                            title={example.title}
                                            initialCode={example.code}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })}

                    <section className="rounded-[22px] bg-white dark:bg-[#1c1c1e] ring-1 ring-black/[0.06] dark:ring-white/10 px-5 sm:px-7 py-6 sm:py-7">
                        <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-[#ff9f0a]/15 text-[#ff9f0a] shrink-0">
                                <Info size={19} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-[18px] font-bold tracking-tight">这些写法暂不支持</h2>
                                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#4b4b50] dark:text-[#d5d5d9]">
                                    下面这些写了也不会生效，会原样显示出来——不是你写错了，是渲染器还没支持。
                                </p>
                            </div>
                        </div>
                        <div className="mt-4">
                            <ExampleBlock title="原样显示的三种写法" initialCode={UNSUPPORTED_SNIPPET} />
                        </div>
                    </section>

                    <div className="flex items-center justify-center pt-2">
                        <button
                            type="button"
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium text-[#86868b] dark:text-[#a1a1a6] hover:text-[#0066cc] dark:hover:text-[#0a84ff] hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer"
                        >
                            <ChevronUp size={15} />
                            回到顶部
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
}
