import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { PenLine, Eye } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { md, preprocessMarkdown, applyTheme } from './lib/markdown';
import { markElementIndexes } from './lib/markdownIndexer';
import { makeWeChatCompatible, cleanInternalAttributes } from './lib/wechatCompat';
import { THEMES } from './lib/themes';
import { defaultContent } from './defaultContent';
import { findImagePosition } from './lib/imageSelector';
import { findElementPosition, getElementLocations, type ElementLocation } from './lib/markdownLocator';
import Header from './components/Header';
import ThemeSelector from './components/ThemeSelector';
import Toolbar from './components/Toolbar';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';

export default function App() {
    const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
    const [markdownInput, setMarkdownInput] = useState<string>(defaultContent);
    const [renderedHtml, setRenderedHtml] = useState<string>('');
    const [activeTheme, setActiveTheme] = useState(THEMES[0].id);
    const [copied, setCopied] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'pc'>('pc');
    const [activePanel, setActivePanel] = useState<'editor' | 'preview'>('editor');
    const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);
    const previewRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const previewOuterScrollRef = useRef<HTMLDivElement>(null);
    const previewInnerScrollRef = useRef<HTMLDivElement>(null);
    const scrollSyncLockRef = useRef<'editor' | 'preview' | null>(null);
    const scrollLockReleaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const markdownLocations = useMemo(() => getElementLocations(markdownInput), [markdownInput]);

    useEffect(() => {
        // Enforce light mode as default, do not follow system preferences
    }, []);

    const toggleTheme = () => {
        setThemeMode((prev) => {
            const next = prev === 'light' ? 'dark' : 'light';
            if (next === 'dark') document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
            return next;
        });
    };

    useEffect(() => {
        // Core rendering: markdown → HTML → styled HTML
        const rawHtml = md.render(preprocessMarkdown(markdownInput));
        const styledHtml = applyTheme(rawHtml, activeTheme);

        // Enhancement layer: add index markers for click-to-locate
        // This is decoupled from core rendering logic
        const indexedHtml = markElementIndexes(styledHtml);

        setRenderedHtml(indexedHtml);
    }, [markdownInput, activeTheme]);

    useEffect(() => {
        if (!scrollSyncEnabled) {
            scrollSyncLockRef.current = null;
            if (scrollLockReleaseTimeoutRef.current) {
                clearTimeout(scrollLockReleaseTimeoutRef.current);
                scrollLockReleaseTimeoutRef.current = null;
            }
        }
    }, [scrollSyncEnabled]);

    useEffect(() => {
        scrollSyncLockRef.current = null;
        if (scrollLockReleaseTimeoutRef.current) {
            clearTimeout(scrollLockReleaseTimeoutRef.current);
            scrollLockReleaseTimeoutRef.current = null;
        }
    }, [previewDevice]);

    useEffect(() => {
        return () => {
            if (scrollLockReleaseTimeoutRef.current) {
                clearTimeout(scrollLockReleaseTimeoutRef.current);
            }
        };
    }, []);

    const getActivePreviewScrollElement = () => {
        if (previewDevice === 'pc') return previewOuterScrollRef.current;
        return previewInnerScrollRef.current;
    };

    const interpolateScrollPosition = (
        position: number,
        sourceAnchors: number[],
        targetAnchors: number[]
    ) => {
        if (sourceAnchors.length < 2 || sourceAnchors.length !== targetAnchors.length) return 0;

        let upperIndex = sourceAnchors.findIndex((anchor) => anchor >= position);
        if (upperIndex < 0) upperIndex = sourceAnchors.length - 1;
        if (upperIndex === 0) return targetAnchors[0];

        const lowerIndex = upperIndex - 1;
        const sourceSpan = sourceAnchors[upperIndex] - sourceAnchors[lowerIndex];
        if (sourceSpan <= 0) return targetAnchors[upperIndex];

        const progress = (position - sourceAnchors[lowerIndex]) / sourceSpan;
        return targetAnchors[lowerIndex]
            + progress * (targetAnchors[upperIndex] - targetAnchors[lowerIndex]);
    };

    const getScrollAnchors = (
        editor: MonacoEditor.IStandaloneCodeEditor,
        previewElement: HTMLElement
    ) => {
        const model = editor.getModel();
        const editorMax = Math.max(editor.getScrollHeight() - editor.getLayoutInfo().height, 0);
        const previewMax = Math.max(previewElement.scrollHeight - previewElement.clientHeight, 0);
        const previewRect = previewElement.getBoundingClientRect();
        const previewNodes = Array.from(previewElement.querySelectorAll<HTMLElement>('[data-md-index]'));
        const previewNodeByIndex = new Map<number, HTMLElement>();

        previewNodes.forEach((node) => {
            const index = Number(node.dataset.mdIndex);
            if (Number.isFinite(index) && !previewNodeByIndex.has(index)) {
                previewNodeByIndex.set(index, node);
            }
        });

        const editorAnchors = [0];
        const previewAnchors = [0];
        let previousEditorAnchor = 0;
        let previousPreviewAnchor = 0;

        if (model) {
            markdownLocations.forEach((location, index) => {
                const previewNode = previewNodeByIndex.get(index);
                if (!previewNode) return;

                const position = model.getPositionAt(location.start);
                const editorAnchor = Math.min(Math.max(editor.getTopForLineNumber(position.lineNumber), 0), editorMax);
                const previewAnchor = Math.min(Math.max(
                    previewNode.getBoundingClientRect().top - previewRect.top + previewElement.scrollTop,
                    0
                ), previewMax);

                if (editorAnchor <= previousEditorAnchor || previewAnchor <= previousPreviewAnchor) return;
                editorAnchors.push(editorAnchor);
                previewAnchors.push(previewAnchor);
                previousEditorAnchor = editorAnchor;
                previousPreviewAnchor = previewAnchor;
            });
        }

        if (editorAnchors[editorAnchors.length - 1] !== editorMax
            || previewAnchors[previewAnchors.length - 1] !== previewMax) {
            editorAnchors.push(editorMax);
            previewAnchors.push(previewMax);
        }

        return { editorAnchors, previewAnchors };
    };

    const syncScrollPosition = (
        editor: MonacoEditor.IStandaloneCodeEditor,
        previewElement: HTMLElement,
        sourcePanel: 'editor' | 'preview'
    ) => {
        if (!scrollSyncEnabled) return;
        if (scrollSyncLockRef.current && scrollSyncLockRef.current !== sourcePanel) return;

        const { editorAnchors, previewAnchors } = getScrollAnchors(editor, previewElement);
        scrollSyncLockRef.current = sourcePanel;

        if (sourcePanel === 'editor') {
            previewElement.scrollTop = interpolateScrollPosition(
                editor.getScrollTop(),
                editorAnchors,
                previewAnchors
            );
        } else {
            editor.setScrollTop(interpolateScrollPosition(
                previewElement.scrollTop,
                previewAnchors,
                editorAnchors
            ));
        }

        if (scrollLockReleaseTimeoutRef.current) {
            clearTimeout(scrollLockReleaseTimeoutRef.current);
        }

        scrollLockReleaseTimeoutRef.current = setTimeout(() => {
            if (scrollSyncLockRef.current === sourcePanel) {
                scrollSyncLockRef.current = null;
            }
            scrollLockReleaseTimeoutRef.current = null;
        }, 50);
    };

    const handleEditorScroll = () => {
        const editor = editorRef.current;
        const previewElement = getActivePreviewScrollElement();
        if (!editor || !previewElement) return;
        syncScrollPosition(editor, previewElement, 'editor');
    };

    const handlePreviewOuterScroll = () => {
        if (previewDevice !== 'pc') return;
        const previewElement = previewOuterScrollRef.current;
        const editor = editorRef.current;
        if (!previewElement || !editor) return;
        syncScrollPosition(editor, previewElement, 'preview');
    };

    const handlePreviewInnerScroll = () => {
        if (previewDevice === 'pc') return;
        const previewElement = previewInnerScrollRef.current;
        const editor = editorRef.current;
        if (!previewElement || !editor) return;
        syncScrollPosition(editor, previewElement, 'preview');
    };

    const handleCopy = async () => {
        if (!previewRef.current) return;
        setIsCopying(true);
        try {
            const finalHtmlForCopy = await makeWeChatCompatible(renderedHtml, activeTheme);

            const blob = new Blob([finalHtmlForCopy], { type: 'text/html' });
            const textBlob = new Blob([previewRef.current.innerText], { type: 'text/plain' });

            const clipboardItem = new ClipboardItem({
                'text/html': blob,
                'text/plain': textBlob
            });
            await navigator.clipboard.write([clipboardItem]);

            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed', err);
            alert('复制格式失败，请检查浏览器剪贴板权限');
        } finally {
            setIsCopying(false);
        }
    };

    const handleExportHtml = () => {
        // Clean internal attributes before exporting
        const cleanHtml = cleanInternalAttributes(renderedHtml);
        const blob = new Blob([cleanHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Raphael_Article_${new Date().getTime()}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPdf = () => {
        if (!previewRef.current) return;
        const element = previewRef.current;
        const opt = {
            margin: 10,
            filename: `Raphael_Article_${new Date().getTime()}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: document.documentElement.classList.contains('dark') ? '#000000' : '#ffffff' },
            jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const }
        };
        const clonedElement = element.cloneNode(true) as HTMLElement;

        // Clean internal attributes from cloned element for PDF export
        const allElements = clonedElement.querySelectorAll('*');
        allElements.forEach(el => {
            el.removeAttribute('data-md-type');
            el.removeAttribute('data-md-index');
        });

        const cloneContainer = document.createElement('div');
        cloneContainer.style.background = document.documentElement.classList.contains('dark') ? '#000000' : '#ffffff';
        cloneContainer.appendChild(clonedElement);

        document.body.appendChild(cloneContainer);
        html2pdf().set(opt).from(cloneContainer).save().then(() => {
            document.body.removeChild(cloneContainer);
        });
    };

    const handleImageClick = useCallback((info: { type: string; index: number; src?: string; alt?: string; content?: string }) => {
        const editor = editorRef.current;
        const model = editor?.getModel();
        if (!editor || !model) return;

        let location: ElementLocation | null = null;

        // Images use specialized positioning
        if (info.type === 'image' && info.src) {
            const match = findImagePosition(markdownInput, info.src, info.alt || '');
            if (match) {
                // Add type field to match ElementLocation interface
                location = {
                    start: match.start,
                    end: match.end,
                    type: 'image'
                };
            }
        } else {
            // Other elements use generic positioning
            location = findElementPosition(markdownInput, info.type, '', info.index);
        }

        if (location) {
            const start = model.getPositionAt(location.start);
            const end = model.getPositionAt(location.end);
            const range = {
                startLineNumber: start.lineNumber,
                startColumn: start.column,
                endLineNumber: end.lineNumber,
                endColumn: end.column,
            };

            editor.setSelection(range);
            editor.revealRangeInCenter(range);
            editor.focus();

            if (window.innerWidth < 768 && activePanel !== 'editor') {
                setActivePanel('editor');
                requestAnimationFrame(() => editor.layout());
            }
        }
    }, [markdownInput, activePanel]);

    const deviceWidthClass = () => {
        if (previewDevice === 'mobile') return 'w-[520px] max-w-full';
        if (previewDevice === 'tablet') return 'w-[800px] max-w-full';
        return 'w-[840px] xl:w-[1024px] max-w-[95%]';
    };

    const gridLayoutClass = () => {
        if (previewDevice === 'mobile') return 'md:grid-cols-[55fr_45fr]';
        if (previewDevice === 'tablet') return 'md:grid-cols-[45fr_55fr]';
        return 'md:grid-cols-[38.2fr_61.8fr]';
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden antialiased bg-[#fbfbfd] dark:bg-black transition-colors duration-300">

            <Header themeMode={themeMode} onToggleTheme={toggleTheme} />

            {/* 移动端 Tab 切换 */}
            <div className="md:hidden glass-toolbar flex items-center z-[90]">
                <button
                    data-testid="tab-editor"
                    onClick={() => setActivePanel('editor')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold transition-colors border-b-2 ${activePanel === 'editor' ? 'text-[#0066cc] dark:text-[#0a84ff] border-[#0066cc] dark:border-[#0a84ff]' : 'text-[#86868b] dark:text-[#a1a1a6] border-transparent'}`}
                >
                    <PenLine size={15} />
                    编辑
                </button>
                <button
                    data-testid="tab-preview"
                    onClick={() => setActivePanel('preview')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold transition-colors border-b-2 ${activePanel === 'preview' ? 'text-[#0066cc] dark:text-[#0a84ff] border-[#0066cc] dark:border-[#0a84ff]' : 'text-[#86868b] dark:text-[#a1a1a6] border-transparent'}`}
                >
                    <Eye size={15} />
                    预览
                </button>
            </div>

            {/* 排版设置 & 工具栏 (桌面端) */}
            <div className={`glass-toolbar hidden md:grid grid-cols-1 ${gridLayoutClass()} px-0 z-[90] transition-all duration-500`}>
                <ThemeSelector activeTheme={activeTheme} onThemeChange={setActiveTheme} />
                <Toolbar
                    previewDevice={previewDevice}
                    onDeviceChange={setPreviewDevice}
                    onExportPdf={handleExportPdf}
                    onExportHtml={handleExportHtml}
                    onCopy={handleCopy}
                    copied={copied}
                    isCopying={isCopying}
                    scrollSyncEnabled={scrollSyncEnabled}
                    onToggleScrollSync={() => setScrollSyncEnabled((prev) => !prev)}
                />
            </div>

            {/* 移动端工具栏：分两行避免按钮被主题栏挤出可视区 */}
            <div className="md:hidden glass-toolbar z-[90]">
                <div className="overflow-x-auto no-scrollbar border-b border-[#00000010] dark:border-[#ffffff10]">
                    <ThemeSelector activeTheme={activeTheme} onThemeChange={setActiveTheme} />
                </div>
                <Toolbar
                    previewDevice={previewDevice}
                    onDeviceChange={setPreviewDevice}
                    onExportPdf={handleExportPdf}
                    onExportHtml={handleExportHtml}
                    onCopy={handleCopy}
                    copied={copied}
                    isCopying={isCopying}
                    scrollSyncEnabled={scrollSyncEnabled}
                    onToggleScrollSync={() => setScrollSyncEnabled((prev) => !prev)}
                />
            </div>

            {/* 编辑区 & 预览区 */}
            <main className={`flex-1 overflow-hidden grid grid-cols-1 ${gridLayoutClass()} relative transition-all duration-500`}>
                <div className={`${activePanel === 'editor' ? 'flex' : 'hidden'} md:flex flex-col overflow-hidden`}>
                    <EditorPanel
                        markdownInput={markdownInput}
                        onInputChange={setMarkdownInput}
                        editorRef={editorRef}
                        onEditorScroll={handleEditorScroll}
                        scrollSyncEnabled={scrollSyncEnabled}
                        themeMode={themeMode}
                    />
                </div>
                <div className={`${activePanel === 'preview' ? 'flex' : 'hidden'} md:flex flex-col overflow-hidden`}>
                    <PreviewPanel
                        renderedHtml={renderedHtml}
                        deviceWidthClass={deviceWidthClass()}
                        previewDevice={previewDevice}
                        previewRef={previewRef}
                        previewOuterScrollRef={previewOuterScrollRef}
                        previewInnerScrollRef={previewInnerScrollRef}
                        onPreviewOuterScroll={handlePreviewOuterScroll}
                        onPreviewInnerScroll={handlePreviewInnerScroll}
                        scrollSyncEnabled={scrollSyncEnabled}
                        onImageClick={handleImageClick}
                    />
                </div>
            </main>

        </div>
    );
}
