import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { PenLine, Eye } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { md, preprocessMarkdown, applyTheme } from './lib/markdown';
import { markElementIndexes } from './lib/markdownIndexer';
import { makeWeChatCompatible, cleanInternalAttributes } from './lib/wechatCompat';
import { THEMES } from './lib/themes';
import { DEFAULT_CODE_THEME_ID } from './lib/codeThemes';
import { defaultContent } from './defaultContent';
import { findImagePosition } from './lib/imageSelector';
import { findElementPosition, getElementLocations, type ElementLocation } from './lib/markdownLocator';
import {
    buildDualScrollAnchorsFromDom,
    isDualAnchorCacheValid,
    mapScrollPosition,
    type DualAnchorCache,
} from './lib/scrollSync';
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
    const [activeCodeTheme, setActiveCodeTheme] = useState<string>(DEFAULT_CODE_THEME_ID);
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
    const anchorsCacheRef = useRef<DualAnchorCache | null>(null);
    const anchorsDirtyRef = useRef(true);
    const syncRafRef = useRef<number | null>(null);
    const pendingSyncSourceRef = useRef<'editor' | 'preview' | null>(null);
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
        const styledHtml = applyTheme(rawHtml, activeTheme, activeCodeTheme);

        // Enhancement layer: add index markers for click-to-locate
        // This is decoupled from core rendering logic
        const indexedHtml = markElementIndexes(styledHtml);

        setRenderedHtml(indexedHtml);
    }, [markdownInput, activeTheme, activeCodeTheme]);

    useEffect(() => {
        if (!scrollSyncEnabled) {
            scrollSyncLockRef.current = null;
            pendingSyncSourceRef.current = null;
            if (scrollLockReleaseTimeoutRef.current) {
                clearTimeout(scrollLockReleaseTimeoutRef.current);
                scrollLockReleaseTimeoutRef.current = null;
            }
            if (syncRafRef.current !== null) {
                cancelAnimationFrame(syncRafRef.current);
                syncRafRef.current = null;
            }
        }
    }, [scrollSyncEnabled]);

    useEffect(() => {
        scrollSyncLockRef.current = null;
        anchorsCacheRef.current = null;
        anchorsDirtyRef.current = true;
        if (scrollLockReleaseTimeoutRef.current) {
            clearTimeout(scrollLockReleaseTimeoutRef.current);
            scrollLockReleaseTimeoutRef.current = null;
        }
    }, [previewDevice]);

    // 内容变化时只标记脏，不在渲染时直接量布局；下次滚动时重建一次并缓存
    useEffect(() => {
        anchorsDirtyRef.current = true;
    }, [renderedHtml, markdownLocations, activeTheme, activeCodeTheme]);

    // 预览区尺寸变化（窗口缩放/设备框）导致锚点失效
    useEffect(() => {
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
            anchorsDirtyRef.current = true;
        });
        if (previewOuterScrollRef.current) observer.observe(previewOuterScrollRef.current);
        if (previewInnerScrollRef.current) observer.observe(previewInnerScrollRef.current);
        return () => observer.disconnect();
    }, [previewDevice, renderedHtml]);

    useEffect(() => {
        return () => {
            if (scrollLockReleaseTimeoutRef.current) {
                clearTimeout(scrollLockReleaseTimeoutRef.current);
            }
            if (syncRafRef.current !== null) {
                cancelAnimationFrame(syncRafRef.current);
            }
        };
    }, []);

    const getActivePreviewScrollElement = () => {
        if (previewDevice === 'pc') return previewOuterScrollRef.current;
        return previewInnerScrollRef.current;
    };

    const ensureScrollAnchors = (
        editor: MonacoEditor.IStandaloneCodeEditor,
        previewElement: HTMLElement,
    ) => {
        const editorScrollHeight = editor.getScrollHeight();
        const previewScrollHeight = previewElement.scrollHeight;
        const cached = anchorsCacheRef.current;

        if (
            !anchorsDirtyRef.current &&
            cached &&
            isDualAnchorCacheValid(cached, editorScrollHeight, previewScrollHeight)
        ) {
            return cached;
        }

        const anchors = buildDualScrollAnchorsFromDom(
            editor,
            previewElement,
            previewRef.current,
            markdownLocations,
        );
        anchorsCacheRef.current = {
            ...anchors,
            editorViewport: editor.getLayoutInfo().height,
            previewViewport: previewElement.clientHeight,
        };
        anchorsDirtyRef.current = false;
        return anchorsCacheRef.current;
    };

    const doSyncScroll = (sourcePanel: 'editor' | 'preview') => {
        if (!scrollSyncEnabled) return;
        if (scrollSyncLockRef.current && scrollSyncLockRef.current !== sourcePanel) return;

        const editor = editorRef.current;
        const previewElement = getActivePreviewScrollElement();
        if (!editor || !previewElement) return;

        let anchors;
        try {
            anchors = ensureScrollAnchors(editor, previewElement);
        } catch {
            return;
        }

        // 视口高度用实时值（窗口缩放时即使锚点未重建也能保持焦点比例正确）
        const editorViewport = editor.getLayoutInfo().height;
        const previewViewport = previewElement.clientHeight;

        scrollSyncLockRef.current = sourcePanel;

        if (sourcePanel === 'editor') {
            const next = mapScrollPosition({
                sourceScroll: editor.getScrollTop(),
                sourceMax: anchors.editorMax,
                sourceViewport: editorViewport,
                targetMax: anchors.previewMax,
                targetViewport: previewViewport,
                sourceTop: anchors.editorTop,
                targetTop: anchors.previewTop,
                sourceContent: anchors.editorContent,
                targetContent: anchors.previewContent,
            });
            if (Number.isFinite(next)) {
                // 避免无意义的赋值触发多余 scroll 事件
                if (Math.abs(previewElement.scrollTop - next) > 0.5) {
                    previewElement.scrollTop = next;
                }
            }
        } else {
            const next = mapScrollPosition({
                sourceScroll: previewElement.scrollTop,
                sourceMax: anchors.previewMax,
                sourceViewport: previewViewport,
                targetMax: anchors.editorMax,
                targetViewport: editorViewport,
                sourceTop: anchors.previewTop,
                targetTop: anchors.editorTop,
                sourceContent: anchors.previewContent,
                targetContent: anchors.editorContent,
            });
            if (Number.isFinite(next)) {
                if (Math.abs(editor.getScrollTop() - next) > 0.5) {
                    editor.setScrollTop(next);
                }
            }
        }

        if (scrollLockReleaseTimeoutRef.current) {
            clearTimeout(scrollLockReleaseTimeoutRef.current);
        }

        // 滑动窗口锁：持续滚动时会不断续期，停下 120ms 后释放，
        // 覆盖 Monaco 平滑滚动的动画尾巴，避免双向打架
        scrollLockReleaseTimeoutRef.current = setTimeout(() => {
            if (scrollSyncLockRef.current === sourcePanel) {
                scrollSyncLockRef.current = null;
            }
            scrollLockReleaseTimeoutRef.current = null;
        }, 120);
    };

    // rAF 节流：高频滚动事件合并为一帧一次，锚点只算一次
    const requestSyncScroll = (sourcePanel: 'editor' | 'preview') => {
        if (!scrollSyncEnabled) return;
        pendingSyncSourceRef.current = sourcePanel;
        if (syncRafRef.current !== null) return;
        syncRafRef.current = requestAnimationFrame(() => {
            syncRafRef.current = null;
            const source = pendingSyncSourceRef.current;
            pendingSyncSourceRef.current = null;
            if (source) doSyncScroll(source);
        });
    };

    const handleEditorScroll = () => {
        requestSyncScroll('editor');
    };

    const handlePreviewOuterScroll = () => {
        if (previewDevice !== 'pc') return;
        requestSyncScroll('preview');
    };

    const handlePreviewInnerScroll = () => {
        if (previewDevice === 'pc') return;
        requestSyncScroll('preview');
    };

    const handleCopy = async () => {
        if (!previewRef.current) return;
        setIsCopying(true);
        try {
            const finalHtmlForCopy = await makeWeChatCompatible(renderedHtml, activeTheme, activeCodeTheme);

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
            const message = err instanceof Error ? err.message : '';
            alert(message
                ? `复制到公众号失败：${message}`
                : '复制格式失败，请检查浏览器剪贴板权限');
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
        return 'w-full max-w-[760px] xl:max-w-[820px]';
    };

    const gridLayoutClass = () => {
        if (previewDevice === 'mobile') return 'md:grid-cols-[58fr_42fr]';
        if (previewDevice === 'tablet') return 'md:grid-cols-[48fr_52fr]';
        return 'md:grid-cols-[50fr_50fr]';
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
                <ThemeSelector
                    activeTheme={activeTheme}
                    onThemeChange={setActiveTheme}
                    activeCodeTheme={activeCodeTheme}
                    onCodeThemeChange={setActiveCodeTheme}
                />
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
                    <ThemeSelector
                        activeTheme={activeTheme}
                        onThemeChange={setActiveTheme}
                        activeCodeTheme={activeCodeTheme}
                        onCodeThemeChange={setActiveCodeTheme}
                    />
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
