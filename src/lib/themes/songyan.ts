/**
 * 「松烟手札」结构化排版 —— 特殊排版集合
 *
 * 这是一个**特殊排版集合**：所有主题共享同一套排版结构（封面卡 / 编号章节标题 /
 * 金句卡 / 胶囊列表 / 居中分隔 / 文末三连卡），由 applyLayout 一个渲染器产出，
 * 差别只在**配色**。每套配色作为一个独立主题注册在「特殊排版」分类下。
 *
 * 用 makeSongyanConfig(palette) 从一份调色板生成完整 LayoutConfig，
 * 换色即换皮；新增配色只需加一条 PALETTES 项。
 */

import type { LayoutConfig, LayoutTheme, ThemeColors, ThemeFonts } from './types';

interface Palette {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
}

const FONTS: ThemeFonts = {
  family: `-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif`,
  bodySize: '15px',
  lineHeight: '1.85',
};

/** 松烟手札的若干配色方案 */
const PALETTES: Palette[] = [
  {
    id: 'songyan-moye',
    name: '松烟·墨叶',
    description: '沉静墨绿，纸底金缀，适合教程、复盘、知识整理',
    colors: {
      ink: '#2f4f3e', inkLight: '#5a7a68', paper: '#f7f5ef', paperDeep: '#efeae0',
      text: '#2b2b28', textSoft: '#6b675c', rule: '#d9d3c6', gold: '#b08948', alert: '#a85a3c',
    },
  },
  {
    id: 'songyan-zheshi',
    name: '松烟·赭石',
    description: '温润赭石褐，暖纸底，适合人文、随笔、人物特稿',
    colors: {
      ink: '#7a4422', inkLight: '#a8694a', paper: '#faf6ef', paperDeep: '#f0e6d6',
      text: '#3a2d22', textSoft: '#7a6a5c', rule: '#e0d4c0', gold: '#c8a050', alert: '#9a3a2c',
    },
  },
  {
    id: 'songyan-qingci',
    name: '松烟·青瓷',
    description: '清冷青瓷蓝绿，留白理性，适合科技评论、设计、工具测评',
    colors: {
      ink: '#3a6b6b', inkLight: '#6a9a9a', paper: '#f6f8f7', paperDeep: '#e6eceb',
      text: '#2a3332', textSoft: '#62757a', rule: '#cdd9d6', gold: '#b89048', alert: '#9a5a4a',
    },
  },
  {
    id: 'songyan-baiyu',
    name: '松烟·白玉',
    description: '冷藏青墨 + 纯白无底色，最干净通透，适合极简、官方文档类',
    colors: {
      ink: '#3a4a66', inkLight: '#6a7a96', paper: 'transparent', paperDeep: '#f4f5f7',
      text: '#2a2f3a', textSoft: '#6a7180', rule: '#e4e6eb', gold: '#a89060', alert: '#8a4a4a',
    },
  },
];

/** 从调色板生成完整 LayoutConfig（所有组件内联样式串） */
function makeSongyanConfig(p: Palette): LayoutConfig {
  const { colors: co, fonts: fo } = { colors: p.colors, fonts: FONTS };
  const fontFamily = fo.family;
  return {
    colors: co,
    fonts: fo,
    components: {
      container: `max-width:677px;margin:0 auto;background:${co.paper};font-family:${fontFamily};color:${co.text};font-size:${fo.bodySize};line-height:${fo.lineHeight};letter-spacing:0.3px;word-wrap:break-word;padding:24px 20px 40px;`,
      cover: `margin:0 0 36px;background:${co.paperDeep};border:1px solid ${co.rule};border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);width:100%;`,
      coverTop: `display:flex;align-items:center;gap:8px;margin-bottom:22px;`,
      coverTitle: `margin:0;font-size:26px;font-weight:900;color:${co.text};line-height:1.3;letter-spacing:-0.5px;text-align:center;`,
      coverSubtitle: `font-size:13px;color:${co.textSoft};margin:0;line-height:1.6;letter-spacing:0.3px;text-align:center;`,
      gradientLine: `flex:1;height:1px;overflow:hidden;background-color:${co.rule};background:linear-gradient(to right,${co.rule},transparent);`,
      coverFooter: `background-color:${co.ink};background:linear-gradient(135deg,${co.ink},${co.inkLight});padding:13px 24px;font-size:11px;color:rgba(255,255,255,0.92);font-weight:600;letter-spacing:1px;`,
      toc: `margin:0 0 30px;`,
      tocTitle: `display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;`,
      tocScroll: `overflow-x:auto;-webkit-overflow-scrolling:touch;white-space:nowrap;padding-bottom:6px;`,
      tocCard: `display:inline-block;white-space:normal;vertical-align:middle;width:88px;height:88px;background-color:${co.ink};background:linear-gradient(135deg,${co.ink},${co.inkLight});border-radius:12px;padding:10px;margin-right:8px;box-shadow:0 3px 8px ${co.ink}33;box-sizing:border-box;`,
      tocCardDim: `display:inline-block;white-space:normal;vertical-align:middle;width:88px;height:88px;background:${co.paperDeep};border:1px solid ${co.rule};border-radius:12px;padding:10px;margin-right:8px;box-shadow:0 2px 6px rgba(0,0,0,0.04);box-sizing:border-box;`,
      chapter: `display:flex;align-items:flex-start;gap:14px;margin:44px 0 24px;`,
      chapterNum: `margin:0;font-size:28px;font-weight:900;color:${co.ink};line-height:1;letter-spacing:-1px;`,
      chapterPart: `margin:0;font-size:8px;font-weight:700;color:${co.rule};letter-spacing:2px;`,
      chapterTitle: `margin:0 0 4px;font-size:17px;font-weight:800;color:${co.text};letter-spacing:0.3px;line-height:1.3;`,
      chapterLabel: `margin:0 0 6px;font-size:10px;font-weight:700;color:${co.textSoft};letter-spacing:2px;`,
      paragraph: `margin:0 0 16px;line-height:${fo.lineHeight};text-align:justify;color:${co.text};font-size:${fo.bodySize};`,
      onelinerCard: `position:relative;margin:0 0 26px;padding:18px 22px 16px;background:${co.paperDeep};border-radius:0 12px 12px 0;border-left:4px solid ${co.ink};overflow:hidden;`,
      quoteBox: `margin:0 0 22px;padding:14px 18px;background:${co.paperDeep};border-left:4px solid ${co.inkLight};border-radius:0 10px 10px 0;`,
      subtitle: `font-size:15px;font-weight:800;color:${co.text};margin:26px 0 14px;display:inline-block;padding:0 12px 4px 0;border-bottom:2px solid ${co.ink};`,
      hr: `margin:32px 0;border:none;border-top:1px solid ${co.rule};width:100%;height:0;`,
      image: `text-align:center;margin:24px auto;border-radius:12px;overflow:hidden;`,
      imageGrid: `display:flex;justify-content:center;gap:8px;align-items:flex-start;margin:24px auto;`,
      orderedItem: `display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;`,
      orderedNum: `display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:${co.ink};color:#fff;font-size:11px;font-weight:700;border-radius:50%;flex-shrink:0;margin-top:2px;`,
      pillItem: `display:inline-block;font-size:13px;font-weight:600;color:${co.ink};background:${co.paperDeep};padding:5px 12px;border-radius:999px;margin:0 6px 8px 0;border:1px solid ${co.rule};`,
      tableTh: `background:${co.ink};color:#fff;font-weight:700;padding:9px 12px;text-align:left;border:1px solid ${co.ink};`,
      tableTd: `padding:9px 12px;border:1px solid ${co.rule};color:${co.text};`,
      footerCta: `background-color:${co.paperDeep};background:radial-gradient(circle at center,${co.paperDeep} 0%,${co.paper} 100%);border:1px solid ${co.rule};border-radius:18px;padding:30px 22px;text-align:center;margin:40px 0 0;box-shadow:0 4px 14px rgba(0,0,0,0.04);`,
    },
    inline: {
      bold: `color:${co.ink};font-weight:700;`,
      highlight: `background:linear-gradient(180deg,transparent 60%,${co.gold}aa 60%);padding:0 2px;`,
      code: `background:${co.paperDeep};color:${co.ink};padding:2px 6px;border-radius:4px;font-size:13px;font-weight:600;font-family:'SF Mono',Consolas,monospace;`,
      link: `color:${co.ink};text-decoration:none;border-bottom:1px solid ${co.inkLight};padding-bottom:1px;`,
    },
  };
}

/** 注册：每套配色 → 一个 layout 主题，共享松烟手札结构与渲染器 */
export const songyanThemes: LayoutTheme[] = PALETTES.map(p => ({
  kind: 'layout',
  id: p.id,
  name: p.name,
  description: p.description,
  layout: makeSongyanConfig(p),
}));
