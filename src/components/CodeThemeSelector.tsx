import { useState, useRef, useEffect } from 'react';
import { Code2, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CODE_THEMES, type CodeTheme } from '../lib/codeThemes';

interface CodeThemeSelectorProps {
    activeCodeTheme: string;
    onCodeThemeChange: (themeId: string) => void;
}

/** 渲染代码主题的迷你预览色块条 */
function CodeThemeSwatch({ theme }: { theme: CodeTheme }) {
    const tokens = Object.values(theme.tokenColors).map(style => {
        const colorMatch = style.match(/color:\s*([^;!]+)/i);
        return colorMatch ? colorMatch[1].trim() : '#fff';
    }).slice(0, 4);

    return (
        <div
            className="flex items-center gap-1 px-2 py-1 rounded-md border shrink-0"
            style={{
                backgroundColor: theme.background,
                borderColor: theme.borderColor || (theme.category === 'dark' ? '#333' : '#e2e8f0'),
                width: '68px',
                height: '24px',
            }}
        >
            {theme.headerStyle === 'mac-dots' ? (
                <div className="flex gap-0.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff5f56]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ffbd2e]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#27c93f]" />
                </div>
            ) : theme.headerStyle === 'accent-line' ? (
                <div className="w-1 h-3 rounded-sm" style={{ backgroundColor: theme.accentColor || '#3b82f6' }} />
            ) : theme.headerStyle === 'terminal' ? (
                <span className="text-[8px] font-mono leading-none" style={{ color: theme.accentColor || '#10b981' }}>&gt;_</span>
            ) : null}

            <div className="flex gap-0.5 flex-1 justify-end items-center">
                {tokens.map((c, i) => (
                    <span key={i} className="w-1 h-2 rounded-[1px]" style={{ backgroundColor: c }} />
                ))}
            </div>
        </div>
    );
}

export default function CodeThemeSelector({ activeCodeTheme, onCodeThemeChange }: CodeThemeSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentTheme = CODE_THEMES.find(t => t.id === activeCodeTheme) || CODE_THEMES[0];

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative shrink-0" ref={dropdownRef}>
            {/* 触发按钮 */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`apple-export-btn flex items-center gap-1.5 !px-3 !py-1.5 !text-[12.5px] transition-all rounded-full ${isOpen
                    ? 'bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] border-[#00000015] dark:border-[#ffffff15] shadow-sm'
                    : 'border-[#00000010] dark:border-[#ffffff10] bg-white/60 dark:bg-[#1c1c1e]/60 hover:bg-white dark:hover:bg-[#2c2c2e] text-[#48484a] dark:text-[#d1d1d6] shadow-none'
                    }`}
                title="选择代码块样式"
            >
                <Code2 size={13} className="text-[#0066cc] dark:text-[#0a84ff]" />
                <span className="font-medium truncate max-w-[110px] sm:max-w-[130px]">{currentTheme.name}</span>
                <ChevronDown size={13} className={`transition-transform duration-200 text-[#86868b] ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* 下拉面板 */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 6 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed left-4 right-4 sm:absolute sm:left-0 sm:right-auto top-auto sm:top-10 w-auto sm:w-[320px] bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-apple-lg border border-[#00000015] dark:border-[#ffffff15] z-50 overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#00000008] dark:border-[#ffffff08] bg-[#00000003] dark:bg-[#ffffff03]">
                            <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                                代码块风格 · {CODE_THEMES.length} 款
                            </span>
                            <span className="text-[11px] text-[#86868b] dark:text-[#636366]">
                                涵盖无栏/Mac/色条/终端
                            </span>
                        </div>

                        <div className="p-1.5 max-h-[340px] overflow-y-auto divide-y divide-[#00000006] dark:divide-[#ffffff06]">
                            {CODE_THEMES.map(theme => {
                                const isSelected = theme.id === activeCodeTheme;
                                return (
                                    <button
                                        key={theme.id}
                                        type="button"
                                        onClick={() => {
                                            onCodeThemeChange(theme.id);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${isSelected
                                            ? 'bg-[#0066cc0d] dark:bg-[#0a84ff18] text-[#0066cc] dark:text-[#0a84ff]'
                                            : 'hover:bg-[#00000006] dark:hover:bg-[#ffffff08] text-[#1d1d1f] dark:text-[#f5f5f7]'
                                            }`}
                                    >
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[13px] font-medium leading-snug truncate ${isSelected ? 'font-semibold' : ''}`}>
                                                    {theme.name}
                                                </span>
                                                <span className="px-1.5 py-0.2 text-[10px] rounded-md bg-[#00000008] dark:bg-[#ffffff10] text-[#86868b] dark:text-[#a1a1a6] shrink-0 font-normal">
                                                    {theme.headerStyleLabel}
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-[#86868b] dark:text-[#8e8e93] leading-tight truncate mt-0.5">
                                                {theme.description}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <CodeThemeSwatch theme={theme} />
                                            <div className="w-4 flex items-center justify-center">
                                                {isSelected && <Check size={14} className="text-[#0066cc] dark:text-[#0a84ff] stroke-[2.5]" />}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
