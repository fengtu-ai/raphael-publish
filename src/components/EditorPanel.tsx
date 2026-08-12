import { useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { Wand2 } from 'lucide-react';
import { getSmartPasteResult } from '../lib/htmlToMarkdown';

interface EditorPanelProps {
    markdownInput: string;
    onInputChange: (value: string) => void;
    editorRef: React.MutableRefObject<MonacoEditor.IStandaloneCodeEditor | null>;
    onEditorScroll: () => void;
    scrollSyncEnabled: boolean;
    themeMode: 'light' | 'dark';
}

export default function EditorPanel({
    markdownInput,
    onInputChange,
    editorRef,
    onEditorScroll,
    scrollSyncEnabled,
    themeMode,
}: EditorPanelProps) {
    const scrollSyncEnabledRef = useRef(scrollSyncEnabled);
    const onEditorScrollRef = useRef(onEditorScroll);
    const mountedEditorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const [editorMounted, setEditorMounted] = useState(false);

    useEffect(() => {
        scrollSyncEnabledRef.current = scrollSyncEnabled;
        onEditorScrollRef.current = onEditorScroll;
    }, [scrollSyncEnabled, onEditorScroll]);

    useEffect(() => {
        if (!editorMounted) return;
        const editor = mountedEditorRef.current;
        if (!editor) return;

        const domNode = editor.getDomNode();
        const scrollNode = domNode?.querySelector<HTMLElement>('.monaco-scrollable-element');
        scrollNode?.setAttribute('data-testid', 'editor-input');

        const handlePaste = (event: ClipboardEvent) => {
            if (!event.clipboardData) return;
            const result = getSmartPasteResult(event.clipboardData);
            if (!result.handled) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            result.content
                ?.then((content) => {
                    if (!content) return;
                    const model = editor.getModel();
                    const selection = editor.getSelection();
                    if (!model || !selection) return;

                    editor.executeEdits('smart-paste', [{
                        range: selection,
                        text: content,
                        forceMoveMarkers: true,
                    }]);
                    editor.pushUndoStop();
                    editor.focus();
                })
                .catch((err) => {
                    console.error('Clipboard image conversion failed:', err);
                    alert('粘贴图片失败，请重试');
                });
        };

        domNode?.addEventListener('paste', handlePaste, true);
        const scrollDisposable = editor.onDidScrollChange((event) => {
            if (event.scrollTopChanged && scrollSyncEnabledRef.current) {
                onEditorScrollRef.current();
            }
        });

        return () => {
            domNode?.removeEventListener('paste', handlePaste, true);
            scrollNode?.removeAttribute('data-testid');
            scrollDisposable.dispose();
        };
    }, [editorMounted]);

    useEffect(() => () => {
        if (editorRef.current === mountedEditorRef.current) editorRef.current = null;
        mountedEditorRef.current = null;
    }, [editorRef]);

    const handleMount: OnMount = (editor) => {
        mountedEditorRef.current = editor;
        editorRef.current = editor;
        setEditorMounted(true);
    };

    return (
        <div className="border-r border-[#00000015] dark:border-[#ffffff15] flex flex-col relative z-30 bg-transparent flex-1 min-h-0">
            <div className="flex-1 min-h-0">
                <Editor
                    height="100%"
                    language="markdown"
                    value={markdownInput}
                    theme={themeMode === 'dark' ? 'vs-dark' : 'light'}
                    onChange={(value) => onInputChange(value ?? '')}
                    onMount={handleMount}
                    loading={<div className="h-full flex items-center justify-center text-sm text-[#86868b]">正在加载编辑器…</div>}
                    options={{
                        automaticLayout: true,
                        wordWrap: 'off',
                        minimap: { enabled: false },
                        lineNumbers: 'on',
                        lineNumbersMinChars: 3,
                        glyphMargin: false,
                        folding: true,
                        fontSize: 15,
                        lineHeight: 27,
                        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                        fontLigatures: true,
                        padding: { top: 24, bottom: 24 },
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                        renderLineHighlight: 'line',
                        renderWhitespace: 'selection',
                        overviewRulerBorder: false,
                        overviewRulerLanes: 0,
                        hideCursorInOverviewRuler: true,
                        contextmenu: true,
                        cursorSmoothCaretAnimation: 'on',
                        cursorBlinking: 'smooth',
                        scrollbar: {
                            horizontal: 'visible',
                            vertical: 'visible',
                            horizontalScrollbarSize: 10,
                            verticalScrollbarSize: 10,
                            alwaysConsumeMouseWheel: false,
                        },
                    }}
                />
            </div>

            <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-[#00000010] dark:border-[#ffffff10] bg-[#fbfbfd]/50 dark:bg-[#1c1c1e]/50 backdrop-blur-md">
                <div className="flex items-center gap-2 min-w-0">
                    <Wand2 size={14} className="text-[#0066cc] dark:text-[#0a84ff] shrink-0" />
                    <span className="text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                        <span className="hidden sm:inline">支持直接粘贴 <span className="text-[#86868b] dark:text-[#a1a1a6]">飞书、Notion或Word等</span> 富文本，自动净化为 Markdown</span>
                        <span className="sm:hidden">支持直接粘贴富文本，自动转化</span>
                    </span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[#86868b] dark:text-[#a1a1a6]">
                    <span className="hidden lg:inline">Ctrl/Cmd + F 搜索</span>
                    <span className="font-mono">{markdownInput.length} 字</span>
                </div>
            </div>
        </div>
    );
}
