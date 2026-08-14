/**
 * 极光智刊（Aurora Editorial）高定杂志专栏渲染器 —— 第三套特殊排版结构
 *
 * 采用全套高定 HTML/CSS 新媒体组件化架构：
 * 1. 杂志刊头卡 (H1)：顶部双色渐变暗条 + 独立题头画框 + 底部金规
 * 2. 标尺章节 (H2)：立体重影胶囊 + 大标题 + 双轨渐变贯通金规
 * 3. 胶囊微勋章 (H3)：浮雕胶囊药丸框 + 闪烁金珠 + 标题
 * 4. 浮光金句卡 (Preamble/Quote)：双引号浮光徽章 + 微浮雕卡片 + 呼吸感排版
 * 5. 结构化微卡列表 (UL/OL)：每项独立圆角卡片，左侧嵌入微徽章
 * 6. 几何微星分割线 (HR)：双向渐变发丝线 + 居中 ◆ ✦ ◆ 晶石
 * 7. 100% 严格忠于原文，零伪造文案，底层复用 layoutCommon 公共引擎
 */

import type { LayoutConfig, LayoutTheme } from './themes/types';
import { THEMES } from './themes';
import type { ElementType } from './indexerRules';
import { applyCodeThemeToDom } from './codeThemes';
import {
  makeStyledLeaf,
  leafBr,
  classifyRoleItems,
  buildCommonImage,
  buildCommonTable,
  buildCommonFooterCta,
  transformCommonInlines,
  isConclusionTitle,
} from './layoutCommon';

function resolveLayoutTheme(themeId: string): LayoutTheme | null {
  const t = THEMES.find(th => th.id === themeId);
  if (t && t.kind === 'layout') return t;
  return null;
}

export function applyEditorialLayout(html: string, themeId: string, codeThemeId?: string): string {
  const theme = resolveLayoutTheme(themeId);
  if (!theme) return html;
  const c = theme.layout;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // --- Phase 1: 统一角色分类 ---
  const { items, h1El, chapterItems } = classifyRoleItems(doc);

  // --- Phase 2: 构建输出树 + 自标索引 ---
  const out = doc.createElement('section');
  out.setAttribute('data-theme', themeId);
  out.setAttribute('style', c.components.container);

  let mdIndex = 0;
  const mark = (el: Element, type: ElementType) => {
    el.setAttribute('data-md-type', type);
    el.setAttribute('data-md-index', String(mdIndex++));
  };

  // 2a. 封面：新媒体杂志刊头画框卡片
  if (h1El) {
    out.appendChild(buildCover(doc, c, h1El, mark));
  }

  // 2b. 主内容遍历
  let chapterCounter = 0;
  for (const it of items) {
    switch (it.role) {
      case 'cover':
        break;
      case 'preamble':
        out.appendChild(buildPreamble(doc, c, it.el, mark));
        break;
      case 'chapter': {
        chapterCounter++;
        const isLast = (it === chapterItems[chapterItems.length - 1]);
        const conclusion = isLast && isConclusionTitle(it.el.textContent || '');
        out.appendChild(buildChapter(doc, c, it.el, chapterCounter, conclusion, mark));
        break;
      }
      case 'subtitle':
        out.appendChild(buildSubtitle(doc, c, it.el, mark));
        break;
      case 'paragraph':
        out.appendChild(buildParagraph(c, it.el, mark));
        break;
      case 'quote':
        out.appendChild(buildQuote(doc, c, it.el, mark));
        break;
      case 'unordered-list':
        out.appendChild(buildPillList(doc, c, it.el, mark));
        break;
      case 'ordered-list':
        out.appendChild(buildOrderedList(doc, c, it.el, mark));
        break;
      case 'code': {
        const pre = it.el.cloneNode(true) as Element;
        mark(pre, 'code');
        out.appendChild(pre);
        break;
      }
      case 'divider':
        out.appendChild(buildHr(doc, c, mark));
        break;
      case 'image':
        out.appendChild(buildCommonImage(doc, c, it.el, mark));
        break;
      case 'table':
        out.appendChild(buildCommonTable(c, it.el, mark));
        break;
      default: {
        const clone = it.el.cloneNode(true) as Element;
        out.appendChild(clone);
      }
    }
  }

  // 2c. 公共居中文末三连卡
  out.appendChild(buildCommonFooterCta(doc, c));

  // --- Phase 3: 代码块高亮与主题化 + 行内强调注入 ---
  applyCodeThemeToDom(out, codeThemeId);
  transformCommonInlines(out, c);

  return out.outerHTML;
}

// ============ 组件 Builders ============

/** 1. 封面：新媒体杂志刊头画框卡片 */
function buildCover(doc: Document, c: LayoutConfig, h1: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `margin: 4px 0 36px; padding: 0; border-radius: 18px; overflow: hidden; background: #ffffff; border: 1px solid ${co.rule}; box-shadow: 0 6px 24px rgba(0,0,0,0.05); box-sizing: border-box;`);

  // 顶栏：主色渐变标题条
  const topBand = doc.createElement('section');
  topBand.setAttribute('style', `background: linear-gradient(135deg, ${co.ink}, ${co.inkLight}); padding: 12px 20px; display: flex; align-items: center; justify-content: space-between;`);
  
  const topBadge = doc.createElement('span');
  topBadge.setAttribute('style', `display: inline-flex; align-items: center; gap: 6px; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 1px; font-family: 'SF Mono', Consolas, monospace;`);
  topBadge.appendChild(makeStyledLeaf(doc, '● PUBLISH SPECIAL', `color: #ffffff !important; font-weight: 700 !important;`));
  
  const topDots = doc.createElement('span');
  topDots.setAttribute('style', `display: inline-flex; gap: 4px;`);
  [0.4, 0.7, 1.0].forEach(op => {
    const d = doc.createElement('span');
    d.setAttribute('style', `display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #ffffff; opacity: ${op};`);
    d.appendChild(leafBr(doc));
    topDots.appendChild(d);
  });
  
  topBand.appendChild(topBadge);
  topBand.appendChild(topDots);
  wrap.appendChild(topBand);

  // 主体：大标题
  const body = doc.createElement('section');
  body.setAttribute('style', `padding: 26px 22px 22px; background: ${co.paperDeep};`);
  
  const title = doc.createElement('h1');
  title.setAttribute('style', `margin: 0; font-size: 26px; font-weight: 900; color: ${co.ink}; line-height: 1.35; letter-spacing: -0.5px;`);
  title.appendChild(makeStyledLeaf(doc, (h1.textContent || '').trim() || '无题', `font-size: 26px !important; font-weight: 900 !important; color: ${co.ink} !important; line-height: 1.35 !important;`));
  mark(title, 'heading');
  body.appendChild(title);

  // 底部双轨标尺
  const bottomBar = doc.createElement('section');
  bottomBar.setAttribute('style', `display: flex; align-items: center; gap: 6px; margin-top: 18px;`);
  
  const bar = doc.createElement('span');
  bar.setAttribute('style', `display: inline-block; width: 44px; height: 3.5px; background: ${co.gold}; border-radius: 2px;`);
  bar.appendChild(leafBr(doc));
  
  const line = doc.createElement('span');
  line.setAttribute('style', `flex: 1; height: 1px; background: linear-gradient(to right, ${co.rule}, transparent);`);
  line.appendChild(leafBr(doc));
  
  bottomBar.appendChild(bar);
  bottomBar.appendChild(line);
  body.appendChild(bottomBar);

  wrap.appendChild(body);
  return wrap;
}

/** 2. 开篇引言导读卡：浮光双引号金句卡 */
function buildPreamble(doc: Document, c: LayoutConfig, bq: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `margin: 26px 0 32px; padding: 22px 24px 20px; background: linear-gradient(135deg, ${co.paperDeep}, #ffffff); border-radius: 16px; border: 1px solid ${co.rule}; box-shadow: 0 4px 20px rgba(0,0,0,0.04); position: relative; box-sizing: border-box; overflow: hidden;`);

  // 顶部浮光引号条
  const topRow = doc.createElement('section');
  topRow.setAttribute('style', `display: flex; align-items: center; gap: 8px; margin-bottom: 12px;`);

  const quoteBadge = doc.createElement('span');
  quoteBadge.setAttribute('style', `display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, ${co.ink}, ${co.inkLight}); color: #ffffff; font-size: 13px; font-weight: 900; line-height: 1; box-shadow: 0 2px 6px ${co.ink}33;`);
  quoteBadge.appendChild(makeStyledLeaf(doc, '“', `color: #ffffff !important; font-weight: 900 !important; font-size: 13px !important;`));
  topRow.appendChild(quoteBadge);

  const topRule = doc.createElement('span');
  topRule.setAttribute('style', `flex: 1; height: 1px; background: linear-gradient(to right, ${co.rule}, transparent);`);
  topRule.appendChild(leafBr(doc));
  topRow.appendChild(topRule);

  wrap.appendChild(topRow);

  // 引言内容
  const p = doc.createElement('p');
  p.setAttribute('style', `margin: 0; font-size: 15px; font-weight: 600; color: ${co.ink}; line-height: 1.88; letter-spacing: 0.3px;`);
  Array.from(bq.childNodes).forEach(n => p.appendChild(n.cloneNode(true)));
  mark(p, 'quote');
  wrap.appendChild(p);

  return wrap;
}

/** 3. 章节 H2：工艺级立体编号胶囊 + 大标题 + 双轨贯穿标尺 */
function buildChapter(doc: Document, c: LayoutConfig, h2: Element, idx: number, conclusion: boolean, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `margin: 44px 0 22px; padding: 0; box-sizing: border-box;`);

  const numStr = conclusion ? '∞' : String(idx).padStart(2, '0');
  const titleText = (h2.textContent || '').trim();

  // 顶部胶囊编号行
  const topRow = doc.createElement('section');
  topRow.setAttribute('style', `display: flex; align-items: center; gap: 8px; margin-bottom: 8px;`);

  const badge = doc.createElement('span');
  badge.setAttribute('style', `display: inline-flex; align-items: center; justify-content: center; background-color: ${co.ink}; background: linear-gradient(135deg, ${co.ink}, ${co.inkLight}); color: #ffffff; font-size: 11.5px; font-weight: 800; font-family: 'SF Mono', Consolas, monospace; padding: 2px 9px; border-radius: 4px; box-shadow: 0 2px 6px ${co.ink}26; letter-spacing: 0.5px;`);
  badge.appendChild(makeStyledLeaf(doc, `PART ${numStr}`, `color: #ffffff !important; font-weight: 800 !important; font-size: 11.5px !important;`));
  topRow.appendChild(badge);

  const dot = doc.createElement('span');
  dot.setAttribute('style', `display: inline-block; width: 4px; height: 4px; border-radius: 50%; background-color: ${co.gold};`);
  dot.appendChild(leafBr(doc));
  topRow.appendChild(dot);

  wrap.appendChild(topRow);

  // 主标题
  const title = doc.createElement('h2');
  title.setAttribute('style', `margin: 0 0 12px; font-size: 19px; font-weight: 800; color: ${co.text}; line-height: 1.38; letter-spacing: 0.2px;`);
  title.appendChild(makeStyledLeaf(doc, titleText, `font-size: 19px !important; font-weight: 800 !important; color: ${co.text} !important; line-height: 1.38 !important;`));
  mark(title, 'heading');
  wrap.appendChild(title);

  // 底部双轨渐变标尺（左侧粗短金色条 + 右侧贯穿发丝线）
  const gaugeRow = doc.createElement('section');
  gaugeRow.setAttribute('style', `display: flex; align-items: center; gap: 0; width: 100%;`);

  const gaugeAccent = doc.createElement('span');
  gaugeAccent.setAttribute('style', `display: inline-block; width: 40px; height: 3px; background-color: ${co.gold}; border-radius: 2px; flex-shrink: 0;`);
  gaugeAccent.appendChild(leafBr(doc));

  const gaugeLine = doc.createElement('span');
  gaugeLine.setAttribute('style', `flex: 1; height: 1px; background-color: ${co.rule}; background: linear-gradient(to right, ${co.rule}, transparent);`);
  gaugeLine.appendChild(leafBr(doc));

  gaugeRow.appendChild(gaugeAccent);
  gaugeRow.appendChild(gaugeLine);
  wrap.appendChild(gaugeRow);

  return wrap;
}

/** 4. 小节 H3：胶囊气泡微勋章标题 */
function buildSubtitle(doc: Document, c: LayoutConfig, h3: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `margin: 28px 0 16px; padding: 0; box-sizing: border-box;`);

  // 胶囊药丸容器
  const pill = doc.createElement('section');
  pill.setAttribute('style', `display: inline-flex; align-items: center; gap: 8px; background: ${co.paperDeep}; border: 1px solid ${co.rule}; border-left: 4px solid ${co.gold}; padding: 6px 14px; border-radius: 0 20px 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.02);`);

  const dot = doc.createElement('span');
  dot.setAttribute('style', `display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${co.gold}; flex-shrink: 0;`);
  dot.appendChild(leafBr(doc));
  pill.appendChild(dot);

  const title = doc.createElement('h3');
  title.setAttribute('style', `margin: 0; font-size: 16px; font-weight: 800; color: ${co.ink}; line-height: 1.35;`);
  title.appendChild(makeStyledLeaf(doc, (h3.textContent || '').trim(), `font-size: 16px !important; font-weight: 800 !important; color: ${co.ink} !important;`));
  mark(title, 'heading');
  pill.appendChild(title);

  wrap.appendChild(pill);
  return wrap;
}

/** 5. 正文段落 */
function buildParagraph(c: LayoutConfig, p: Element, mark: (e: Element, t: ElementType) => void): Element {
  const clone = p.cloneNode(true) as HTMLElement;
  clone.setAttribute('style', c.components.paragraph);
  mark(clone, 'paragraph');
  return clone;
}

/** 6. 正文普通引用卡：极简几何双色光柱引用卡 */
function buildQuote(doc: Document, c: LayoutConfig, bq: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `margin: 22px 0; padding: 16px 20px 16px 22px; background-color: ${co.paperDeep}; border: 1px solid ${co.rule}; border-left: 4px solid ${co.gold}; border-radius: 0 14px 14px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.02); box-sizing: border-box;`);

  // 顶栏微引号图标
  const topRow = doc.createElement('section');
  topRow.setAttribute('style', `display: flex; align-items: center; gap: 6px; margin-bottom: 8px;`);

  const quoteSign = doc.createElement('span');
  quoteSign.setAttribute('style', `font-size: 16px; font-weight: 900; color: ${co.gold}; line-height: 1; display: inline-block; transform: translateY(2px);`);
  quoteSign.appendChild(makeStyledLeaf(doc, '“', `color: ${co.gold} !important; font-weight: 900 !important; font-size: 16px !important;`));
  topRow.appendChild(quoteSign);

  const topRule = doc.createElement('span');
  topRule.setAttribute('style', `flex: 1; height: 1px; background: linear-gradient(to right, ${co.rule}, transparent);`);
  topRule.appendChild(leafBr(doc));
  topRow.appendChild(topRule);

  wrap.appendChild(topRow);

  const p = doc.createElement('p');
  p.setAttribute('style', `margin: 0; font-size: 14.5px; font-weight: 500; color: ${co.text}; line-height: 1.85; letter-spacing: 0.3px;`);
  Array.from(bq.childNodes).forEach(n => p.appendChild(n.cloneNode(true)));
  mark(p, 'quote');
  wrap.appendChild(p);

  return wrap;
}

/** 7. 结构化胶囊列表 UL */
function buildPillList(doc: Document, c: LayoutConfig, ul: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `margin: 16px 0 22px; padding: 0;`);

  ul.querySelectorAll(':scope > li').forEach(li => {
    const row = doc.createElement('section');
    row.setAttribute('style', `display: flex; align-items: flex-start; gap: 12px; padding: 10px 14px; background: ${co.paperDeep}; border-radius: 10px; margin-bottom: 8px; border: 1px solid ${co.rule}; box-sizing: border-box;`);

    const dot = doc.createElement('span');
    dot.setAttribute('style', `display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: ${co.ink}; color: #ffffff; font-size: 8px; flex-shrink: 0; margin-top: 3px;`);
    dot.appendChild(makeStyledLeaf(doc, '✦', `color: #ffffff !important; font-size: 8px !important;`));
    row.appendChild(dot);

    const txt = doc.createElement('p');
    txt.setAttribute('style', `margin: 0; font-size: ${c.fonts.bodySize}; line-height: ${c.fonts.lineHeight}; color: ${co.text}; flex: 1;`);
    Array.from(li.childNodes).forEach(n => txt.appendChild(n.cloneNode(true)));
    mark(txt, 'list');
    row.appendChild(txt);

    wrap.appendChild(row);
  });

  return wrap;
}

/** 8. 结构化胶囊列表 OL */
function buildOrderedList(doc: Document, c: LayoutConfig, ol: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `margin: 16px 0 22px; padding: 0;`);

  let n = 0;
  ol.querySelectorAll(':scope > li').forEach(li => {
    n++;
    const row = doc.createElement('section');
    row.setAttribute('style', `display: flex; align-items: flex-start; gap: 12px; padding: 10px 14px; background: ${co.paperDeep}; border-radius: 10px; margin-bottom: 8px; border: 1px solid ${co.rule}; box-sizing: border-box;`);

    const numBadge = doc.createElement('span');
    numBadge.setAttribute('style', `display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; background: linear-gradient(135deg, ${co.ink}, ${co.inkLight}); color: #ffffff; font-size: 11px; font-weight: 800; font-family: 'SF Mono', Consolas, monospace; flex-shrink: 0; margin-top: 1px; box-shadow: 0 2px 6px ${co.ink}33;`);
    numBadge.appendChild(makeStyledLeaf(doc, String(n).padStart(2, '0'), `color: #ffffff !important; font-weight: 800 !important; font-size: 11px !important;`));
    row.appendChild(numBadge);

    const txt = doc.createElement('p');
    txt.setAttribute('style', `margin: 0; font-size: ${c.fonts.bodySize}; line-height: ${c.fonts.lineHeight}; color: ${co.text}; flex: 1;`);
    Array.from(li.childNodes).forEach(n => txt.appendChild(n.cloneNode(true)));
    mark(txt, 'list');
    row.appendChild(txt);

    wrap.appendChild(row);
  });

  return wrap;
}

/** 9. 几何晶石分割线 */
function buildHr(doc: Document, c: LayoutConfig, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `display: flex; align-items: center; justify-content: center; gap: 16px; margin: 32px 0; padding: 0;`);

  const line1 = doc.createElement('span');
  line1.setAttribute('style', `height: 1px; flex: 1; max-width: 90px; background-color: ${co.rule}; background: linear-gradient(to left, ${co.rule}, transparent);`);
  line1.appendChild(leafBr(doc));
  wrap.appendChild(line1);

  const dot = doc.createElement('span');
  dot.setAttribute('style', `font-size: 10px; color: ${co.gold}; font-weight: 700; letter-spacing: 4px;`);
  dot.appendChild(makeStyledLeaf(doc, '◆ ✦ ◆', `color: ${co.gold} !important; font-size: 10px !important;`));
  wrap.appendChild(dot);

  const line2 = doc.createElement('span');
  line2.setAttribute('style', `height: 1px; flex: 1; max-width: 90px; background-color: ${co.rule}; background: linear-gradient(to right, ${co.rule}, transparent);`);
  line2.appendChild(leafBr(doc));
  wrap.appendChild(line2);

  const hr = doc.createElement('hr');
  hr.setAttribute('style', `display: none;`);
  mark(hr, 'hr');
  wrap.appendChild(hr);

  return wrap;
}
