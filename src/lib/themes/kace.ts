/**
 * 「卡册」卡片分块式特殊排版 —— 第二套特殊排版结构
 *
 * 与松烟手札不同的**全新排版**：每个 `##` 章节整段包成一张独立圆角大卡，
 * 顶部主色全宽色带内放白字章节标题 + PART 序号，卡身 padding 区承接该章内容。
 * 卡片之间留白分隔，Notion / 仪表盘观感。由 applyCardLayout 渲染器产出
 * （renderer:'card'），不复用 applyLayout。
 *
 * 用 makeCardConfig(palette) 从调色板生成完整 LayoutConfig，换色即换皮；
 * 新增配色只需加一条 PALETTES 项。松烟专用组件字段（cover/chapter/...）
 * 在此留空（undefined），卡册专用字段（cardShell/cardBand/...）填卡册样式。
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

/** 卡册的若干配色方案 */
const PALETTES: Palette[] = [
  {
    id: 'kace-moyan',
    name: '卡册·墨岩',
    description: '深石墨墨主色 + 透明白底，冷峻仪表盘感，适合产品发布、功能盘点、官方文档',
    colors: {
      ink: '#3a3f4a', inkLight: '#6a7080', paper: 'transparent', paperDeep: '#f4f5f7',
      text: '#2a2d34', textSoft: '#6a6f7a', rule: '#e4e6eb', gold: '#a89060', alert: '#8a4a4a',
    },
  },
  {
    id: 'kace-subai',
    name: '卡册·素白',
    description: '冷藏青墨 + 纯白无底色，最干净通透，适合极简、教程、知识整理',
    colors: {
      ink: '#33415c', inkLight: '#5a6a8c', paper: 'transparent', paperDeep: '#f3f5f8',
      text: '#2a3142', textSoft: '#6a7180', rule: '#e2e6ee', gold: '#a89060', alert: '#8a4a4a',
    },
  },
  {
    id: 'kace-dianlan',
    name: '卡册·靛蓝',
    description: '靛蓝主色 + 淡蓝纸底，科技工具感，适合测评、工具对比、技术复盘',
    colors: {
      ink: '#2f4a7a', inkLight: '#5a7ab0', paper: '#f7f9fc', paperDeep: '#eef3fa',
      text: '#2a3340', textSoft: '#5a6580', rule: '#dde4ee', gold: '#b89048', alert: '#9a4a3a',
    },
  },
  {
    id: 'kace-zhehong',
    name: '卡册·赭红',
    description: '暖调赭红主色 + 暖白纸底，人文杂志感，适合随笔、人物特稿、生活记录',
    colors: {
      ink: '#9a3f3a', inkLight: '#c46a5e', paper: '#fbf8f5', paperDeep: '#f3ebe4',
      text: '#3a2d28', textSoft: '#7a6a60', rule: '#e8ddd4', gold: '#c08850', alert: '#7a3a5a',
    },
  },
  {
    id: 'kace-canglu',
    name: '卡册·苍绿',
    description: '自然苍绿主色 + 浅米纸底，清新克制，适合知识整理、读书笔记、方法论',
    colors: {
      ink: '#3d6b5a', inkLight: '#6a9a86', paper: '#f7f9f4', paperDeep: '#edf1e6',
      text: '#2a3328', textSoft: '#5a7060', rule: '#dde6d2', gold: '#b09048', alert: '#9a5a3a',
    },
  },
];

/** 从调色板生成完整 LayoutConfig */
function makeCardConfig(p: Palette): LayoutConfig {
  const { colors: co, fonts: fo } = { colors: p.colors, fonts: FONTS };
  const fontFamily = fo.family;
  return {
    colors: co,
    fonts: fo,
    components: {
      // —— 共享字段（卡册自填） ——
      container: `max-width:677px;margin:0 auto;background:${co.paper};font-family:${fontFamily};color:${co.text};font-size:${fo.bodySize};line-height:${fo.lineHeight};letter-spacing:0.3px;word-wrap:break-word;padding:24px 20px 40px;`,
      paragraph: `margin:0 0 16px;line-height:${fo.lineHeight};text-align:justify;color:${co.text};font-size:${fo.bodySize};`,
      hr: `margin:24px 0;border:none;`,
      image: `text-align:center;margin:18px auto;border-radius:12px;overflow:hidden;`,
      imageGrid: `display:flex;justify-content:center;gap:8px;align-items:flex-start;margin:18px auto;`,
      orderedItem: `display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;`,
      tableTh: `background:${co.ink};color:#fff;font-weight:700;padding:9px 12px;text-align:left;border:1px solid ${co.ink};`,
      tableTd: `padding:9px 12px;border:1px solid ${co.rule};color:${co.text};`,
      footerCta: `margin:24px 0 0;background:${co.paperDeep};border:1px solid ${co.rule};border-radius:16px;padding:26px 22px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,0.04);`,
      // —— 松烟专用字段：卡册不用，留空 ——
      cover: '', coverTop: '', coverTitle: '', coverSubtitle: '', gradientLine: '', coverFooter: '',
      chapter: '', chapterNum: '', chapterPart: '', chapterTitle: '', chapterLabel: '',
      onelinerCard: '', quoteBox: '', subtitle: '', pillItem: '', orderedNum: '',
      toc: '', tocTitle: '', tocScroll: '', tocCard: '', tocCardDim: '',
      // —— 卡册专用字段 ——
      cardShell: `margin:0 0 22px;background:${co.paperDeep};border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.05);border:1px solid ${co.rule};`,
      cardBand: `background-color:${co.ink};background:linear-gradient(135deg,${co.ink},${co.inkLight});padding:14px 20px;`,
      cardBandTitle: `margin:0;font-size:17px;font-weight:800;color:#fff;letter-spacing:0.3px;line-height:1.3;flex:1;min-width:0;`,
      cardBandLabel: `margin:0;font-size:10px;font-weight:700;color:rgba(255,255,255,0.82);letter-spacing:1.5px;text-align:right;flex-shrink:0;`,
      cardBody: `padding:20px 22px 22px;`,
      cardCoverTitle: `margin:0;font-size:26px;font-weight:900;color:${co.text};line-height:1.3;letter-spacing:-0.5px;text-align:center;`,
      cardCoverSub: `font-size:13px;color:${co.textSoft};margin:0;line-height:1.6;letter-spacing:0.3px;text-align:center;`,
      cardCoverRule: `background-color:${co.ink};background:linear-gradient(to right,${co.inkLight},${co.ink},${co.inkLight});width:44px;height:3px;border-radius:2px;margin:16px auto 12px;`,
      cardSubtitle: `margin:0;font-size:15px;font-weight:800;color:${co.text};line-height:1.3;`,
      cardQuote: `margin:0 0 16px;padding:14px 16px;background:${co.paper};border-radius:10px;border:1px solid ${co.rule};`,
      cardHrMark: `display:inline-block;width:8px;height:8px;background-color:${co.ink};background:linear-gradient(135deg,${co.ink},${co.inkLight});border-radius:1px;transform:rotate(45deg);`,
      cardSquareMarker: `display:inline-block;width:8px;height:8px;background:${co.ink};border-radius:2px;`,
    },
    inline: {
      bold: `color:${co.ink};font-weight:700;`,
      highlight: `background:linear-gradient(180deg,transparent 60%,${co.gold}aa 60%);padding:0 2px;`,
      code: `background:${co.paperDeep};color:${co.ink};padding:2px 6px;border-radius:4px;font-size:13px;font-weight:600;font-family:'SF Mono',Consolas,monospace;`,
      link: `color:${co.ink};text-decoration:none;border-bottom:1px solid ${co.inkLight};padding-bottom:1px;`,
    },
  };
}

/** 注册：每套配色 → 一个 layout 主题，renderer:'card'，共享卡册结构与 applyCardLayout 渲染器 */
export const kaceThemes: LayoutTheme[] = PALETTES.map(p => ({
  kind: 'layout',
  id: p.id,
  name: p.name,
  description: p.description,
  layout: makeCardConfig(p),
  renderer: 'card',
}));
