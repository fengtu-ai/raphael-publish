import type { LayoutTheme, LayoutConfig } from './types';

/**
 * 极光智刊（Aurora Editorial）现代高定杂志专栏配置生成器
 */
function makeEditorialConfig(c: {
  paper: string;
  ink: string;
  gold: string;
  crimson: string;
  text: string;
  muted: string;
  border: string;
  cardBg: string;
}): LayoutConfig {
  const colors = {
    ink: c.ink,
    inkLight: c.crimson,
    paper: c.paper,
    paperDeep: c.cardBg,
    text: c.text,
    textSoft: c.muted,
    rule: c.border,
    gold: c.gold,
    alert: c.crimson,
  };

  const fonts = {
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    bodySize: '15px',
    lineHeight: '1.88',
  };

  return {
    colors,
    fonts,
    components: {
      container: `max-width:677px;margin:0 auto;background:${c.paper};font-family:${fonts.family};color:${c.text};font-size:${fonts.bodySize};line-height:${fonts.lineHeight};letter-spacing:0.3px;word-wrap:break-word;padding:24px 18px 40px;box-sizing:border-box;`,
      paragraph: `margin:0 0 18px;line-height:${fonts.lineHeight};text-align:justify;color:${c.text};font-size:${fonts.bodySize};letter-spacing:0.4px;`,
      hr: `margin:36px 0;border:none;`,
      image: `text-align:center;margin:22px auto;border-radius:14px;overflow:hidden;`,
      imageGrid: `display:flex;justify-content:center;gap:8px;align-items:flex-start;margin:22px auto;`,
      orderedItem: `display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;`,
      tableTh: `background:${c.ink};color:#ffffff;font-weight:700;padding:10px 14px;text-align:left;border:1px solid ${c.ink};font-size:13.5px;`,
      tableTd: `padding:9px 14px;border:1px solid ${c.border};color:${c.text};font-size:13px;`,
      footerCta: ``,
      cover: ``,
      coverTop: ``,
      coverTitle: ``,
      coverSubtitle: ``,
      gradientLine: ``,
      coverFooter: ``,
      toc: ``,
      tocTitle: ``,
      tocScroll: ``,
      tocCard: ``,
      tocCardDim: ``,
      chapter: ``,
      chapterNum: ``,
      chapterPart: ``,
      chapterTitle: ``,
      chapterLabel: ``,
      onelinerCard: ``,
      quoteBox: ``,
      subtitle: ``,
      pillItem: ``,
      orderedNum: ``,
    },
    inline: {
      bold: `color:${c.ink} !important;font-weight:750;`,
      highlight: `background:linear-gradient(180deg,transparent 55%,${c.crimson}33 55%) !important;padding:0 3px !important;border-radius:2px !important;color:${c.ink} !important;font-weight:600;`,
      code: `background-color:${c.ink}0d !important;color:${c.crimson} !important;font-family:'SF Mono',Consolas,Monaco,Menlo,monospace !important;font-size:13.5px !important;padding:2px 6px !important;border-radius:5px !important;border:1px solid ${c.border} !important;font-weight:600;`,
      link: `color:${c.crimson} !important;text-decoration:none !important;border-bottom:1.5px solid ${c.crimson}80 !important;padding-bottom:1px !important;font-weight:500;`,
    },
  };
}

export const gazetteThemes: LayoutTheme[] = [
  {
    kind: 'layout',
    renderer: 'editorial',
    id: 'editorial-subai',
    name: '极光 · 素白',
    description: '冷藏青墨 + 纯白透明底，最干净通透，适合极简、知识整理与全场景通用排版',
    layout: makeEditorialConfig({
      paper: 'transparent',
      ink: '#1e293b',
      gold: '#3b82f6',
      crimson: '#2563eb',
      text: '#1e293b',
      muted: '#64748b',
      border: '#e2e8f0',
      cardBg: '#f8fafc',
    }),
  },
  {
    kind: 'layout',
    renderer: 'editorial',
    id: 'editorial-cyber',
    name: '极光 · 曜石星芒',
    description: '现代先锋科技专栏，曜石黑与极光蓝紫，流光双层立体卡片排版',
    layout: makeEditorialConfig({
      paper: '#f8fafc',
      ink: '#0f172a',
      gold: '#6366f1',
      crimson: '#4f46e5',
      text: '#1e293b',
      muted: '#64748b',
      border: '#e2e8f0',
      cardBg: '#ffffff',
    }),
  },
  {
    kind: 'layout',
    renderer: 'editorial',
    id: 'editorial-emerald',
    name: '极光 · 墨玉翡翠',
    description: '高定轻奢观察特稿，幽深墨玉与祖母绿流光，极具质感的人文专栏',
    layout: makeEditorialConfig({
      paper: '#f6f9f8',
      ink: '#064e3b',
      gold: '#059669',
      crimson: '#0d9488',
      text: '#1f2937',
      muted: '#4b5563',
      border: '#d1fae5',
      cardBg: '#ffffff',
    }),
  },
  {
    kind: 'layout',
    renderer: 'editorial',
    id: 'editorial-sunset',
    name: '极光 · 赤霞暮金',
    description: '前沿商业风尚周刊，酒红曜石与赤霞暮金，大气磅礴的出版物视觉',
    layout: makeEditorialConfig({
      paper: '#faf8f5',
      ink: '#831843',
      gold: '#db2777',
      crimson: '#be185d',
      text: '#292524',
      muted: '#78716c',
      border: '#fbcfe8',
      cardBg: '#ffffff',
    }),
  },
];
