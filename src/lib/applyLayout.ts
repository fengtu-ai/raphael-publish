/**
 * 松烟手札（东方书卷风）特殊排版渲染器 —— 第一套特殊排版结构
 *
 * 核心特征：
 * - 东方书卷感，印章、宣纸、章节大字编号
 * - 紧凑型目录导读横滑卡（2+ 章节自动渲染）
 * - 金句卡、胶囊列表、居中分隔
 * - 底层复用 layoutCommon 公共引擎（角色分类、多图并排、表格、行内强调、底部三连 CTA）。
 */

import type { LayoutConfig, LayoutTheme } from './themes/types';
import { THEMES } from './themes';
import type { ElementType } from './indexerRules';
import { applyCodeThemeToDom } from './codeThemes';
import {
  makeLeafText,
  makeStyledLeaf,
  leafBr,
  classifyRoleItems,
  buildCommonImage,
  buildCommonTable,
  buildCommonFooterCta,
  transformCommonInlines,
  isConclusionTitle,
  type RoleItem,
} from './layoutCommon';

function resolveLayoutTheme(themeId: string): LayoutTheme | null {
  const t = THEMES.find(th => th.id === themeId);
  if (t && t.kind === 'layout') return t;
  return null;
}

export function applyLayout(html: string, themeId: string, codeThemeId?: string): string {
  const theme = resolveLayoutTheme(themeId);
  if (!theme) return html;
  const c = theme.layout;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // --- Phase 1: 统一角色分类 ---
  const { items, h1El, chapterItems } = classifyRoleItems(doc);

  // --- Phase 2: 构建输出树 + 自标索引 ---
  const out = doc.createElement('section');
  out.setAttribute('style', c.components.container);

  let mdIndex = 0;
  const mark = (el: Element, type: ElementType) => {
    el.setAttribute('data-md-type', type);
    el.setAttribute('data-md-index', String(mdIndex++));
  };

  // 2a. 封面（来自 h1）
  if (h1El) {
    const cover = buildCover(doc, c, h1El, mark);
    out.appendChild(cover);
  }

  // 2b. 目录（2+ 章节时，紧跟封面之下）
  if (chapterItems.length >= 2) {
    out.appendChild(buildToc(doc, c, chapterItems));
  }

  // 2c. 主遍历
  let chapterCounter = 0;
  for (const it of items) {
    switch (it.role) {
      case 'cover':
        break;
      case 'preamble':
        out.appendChild(buildOnelinerCard(doc, c, it.el, mark));
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
        out.appendChild(buildQuoteBox(doc, c, it.el, mark));
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

  // 2d. 公共文末三连卡
  out.appendChild(buildCommonFooterCta(doc, c));

  // --- Phase 3: 代码块高亮与容器主题化 + 行内样式注入 ---
  applyCodeThemeToDom(out, codeThemeId);
  transformCommonInlines(out, c);

  return out.outerHTML;
}

// ============ 松烟专属组件 builders ============

/** 封面卡：顶部栏（红印+渐变线）+ 大标题 + 副标 + 底部墨底色带 */
function buildCover(doc: Document, c: LayoutConfig, h1: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors, components } = c;
  const card = doc.createElement('section');
  card.setAttribute('style', components.cover);

  const inner = doc.createElement('section');
  inner.setAttribute('style', 'padding:32px 24px 28px;');

  const top = doc.createElement('section');
  top.setAttribute('style', components.coverTop);

  const seal = doc.createElement('span');
  seal.setAttribute('style', `display:inline-block;background-color:${colors.alert};background:linear-gradient(135deg,${colors.alert},#7a2010);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:1px;`);
  seal.appendChild(makeLeafText(doc, '手札'));
  top.appendChild(seal);

  const line = doc.createElement('span');
  line.setAttribute('style', components.gradientLine);
  line.appendChild(leafBr(doc));
  top.appendChild(line);
  inner.appendChild(top);

  const title = doc.createElement('p');
  title.setAttribute('style', components.coverTitle);
  title.appendChild(makeStyledLeaf(doc, (h1.textContent || '').trim() || '无题', `font-size:26px;font-weight:900;color:${colors.text};line-height:1.3;letter-spacing:-0.5px;`));
  mark(title, 'heading');
  inner.appendChild(title);

  card.appendChild(inner);

  const footer = doc.createElement('section');
  footer.setAttribute('style', components.coverFooter);
  footer.appendChild(makeLeafText(doc, '✦ 卷首 · 阅毕约需三五分钟'));
  card.appendChild(footer);

  return card;
}

/** 目录导读卡 */
function buildToc(doc: Document, c: LayoutConfig, chapterItems: RoleItem[]): Element {
  const { colors, components } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', components.toc);

  const titleBar = doc.createElement('section');
  titleBar.setAttribute('style', components.tocTitle);

  const titleP = doc.createElement('p');
  titleP.setAttribute('style', `margin:0;font-size:11px;font-weight:700;color:${colors.textSoft};letter-spacing:2px;`);
  titleP.appendChild(makeLeafText(doc, '目 录 导 引'));
  titleBar.appendChild(titleP);

  const hintP = doc.createElement('p');
  hintP.setAttribute('style', `margin:0;font-size:10px;color:${colors.textSoft};opacity:0.75;`);
  hintP.appendChild(makeLeafText(doc, '左右滑动 浏览章节 ⇢'));
  titleBar.appendChild(hintP);
  wrap.appendChild(titleBar);

  const scroll = doc.createElement('section');
  scroll.setAttribute('style', components.tocScroll);

  chapterItems.forEach((it, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === chapterItems.length - 1;
    const conclusion = isLast && isConclusionTitle(it.el.textContent || '');

    const card = doc.createElement('section');
    card.setAttribute('style', isFirst ? components.tocCard : components.tocCardDim);

    const numP = doc.createElement('p');
    numP.setAttribute('style', `margin:0 0 4px;font-size:16px;font-weight:900;color:${isFirst ? '#fff' : colors.ink};line-height:1;`);
    numP.appendChild(makeStyledLeaf(doc, conclusion ? '∞' : String(idx + 1).padStart(2, '0'), `font-size:16px;font-weight:900;color:${isFirst ? '#fff' : colors.ink};line-height:1;`));
    card.appendChild(numP);

    const titleText = (it.el.textContent || '').trim();
    const titleP2 = doc.createElement('p');
    titleP2.setAttribute('style', `margin:0;font-size:11px;font-weight:700;color:${isFirst ? 'rgba(255,255,255,0.92)' : colors.text};line-height:1.35;word-break:break-all;`);
    titleP2.appendChild(makeStyledLeaf(doc, titleText, `font-size:11px;font-weight:700;color:${isFirst ? 'rgba(255,255,255,0.92)' : colors.text};line-height:1.35;`));
    card.appendChild(titleP2);

    scroll.appendChild(card);
  });

  wrap.appendChild(scroll);
  return wrap;
}

/** 章节标题 H2：左侧大号数字 + 右侧标题行 */
function buildChapter(doc: Document, c: LayoutConfig, h2: Element, idx: number, conclusion: boolean, mark: (e: Element, t: ElementType) => void): Element {
  const { colors, components } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', components.chapter);

  const numBox = doc.createElement('section');
  numBox.setAttribute('style', 'flex-shrink:0;text-align:right;min-width:32px;');
  const numP = doc.createElement('p');
  numP.setAttribute('style', components.chapterNum);
  numP.appendChild(makeStyledLeaf(doc, conclusion ? '∞' : String(idx).padStart(2, '0'), `font-size:28px;font-weight:900;color:${colors.ink};line-height:1;letter-spacing:-1px;`));
  numBox.appendChild(numP);
  const partP = doc.createElement('p');
  partP.setAttribute('style', components.chapterPart);
  partP.appendChild(makeLeafText(doc, conclusion ? 'END' : 'PART'));
  numBox.appendChild(partP);
  wrap.appendChild(numBox);

  const right = doc.createElement('section');
  right.setAttribute('style', 'flex:1;min-width:0;');
  const labelP = doc.createElement('p');
  labelP.setAttribute('style', components.chapterLabel);
  labelP.appendChild(makeLeafText(doc, conclusion ? '— 结语 · 收束 —' : `— 第 ${idx} 节 · 导读 —`));
  right.appendChild(labelP);

  const titleP = doc.createElement('p');
  titleP.setAttribute('style', components.chapterTitle);
  titleP.appendChild(makeStyledLeaf(doc, (h2.textContent || '').trim(), `font-size:17px;font-weight:800;color:${colors.text};letter-spacing:0.3px;line-height:1.3;`));
  mark(titleP, 'heading');
  right.appendChild(titleP);

  wrap.appendChild(right);
  return wrap;
}

/** 金句引言卡 */
function buildOnelinerCard(doc: Document, c: LayoutConfig, bq: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors, components } = c;
  const card = doc.createElement('section');
  card.setAttribute('style', components.onelinerCard);

  const tag = doc.createElement('span');
  tag.setAttribute('style', `display:inline-block;font-size:9px;font-weight:700;color:${colors.gold};letter-spacing:2px;margin-bottom:8px;`);
  tag.appendChild(makeLeafText(doc, '✦ 金句 · 引言'));
  card.appendChild(tag);

  const p = doc.createElement('p');
  p.setAttribute('style', `margin:0;font-size:15px;font-weight:600;color:${colors.ink};line-height:1.75;letter-spacing:0.3px;`);
  Array.from(bq.childNodes).forEach(n => p.appendChild(n.cloneNode(true)));
  mark(p, 'quote');
  card.appendChild(p);

  return card;
}

/** 小节标题 H3 */
function buildSubtitle(doc: Document, c: LayoutConfig, h3: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors, components } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', 'margin:26px 0 14px;');

  const p = doc.createElement('p');
  p.setAttribute('style', components.subtitle);
  p.appendChild(makeStyledLeaf(doc, (h3.textContent || '').trim(), `font-size:15px;font-weight:800;color:${colors.text};line-height:1.3;`));
  mark(p, 'heading');
  wrap.appendChild(p);

  return wrap;
}

/** 正文段落 */
function buildParagraph(c: LayoutConfig, p: Element, mark: (e: Element, t: ElementType) => void): Element {
  const clone = p.cloneNode(true) as HTMLElement;
  clone.setAttribute('style', c.components.paragraph);
  mark(clone, 'paragraph');
  return clone;
}

/** 正文普通引用块 */
function buildQuoteBox(doc: Document, c: LayoutConfig, bq: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors, components } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', components.quoteBox);

  const p = doc.createElement('p');
  p.setAttribute('style', `margin:0;font-size:14px;color:${colors.textSoft};line-height:1.8;`);
  Array.from(bq.childNodes).forEach(n => p.appendChild(n.cloneNode(true)));
  mark(p, 'quote');
  wrap.appendChild(p);

  return wrap;
}

/** 无序列表：胶囊式小项 */
function buildPillList(doc: Document, c: LayoutConfig, ul: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors, components } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', 'margin:14px 0 20px;');

  ul.querySelectorAll(':scope > li').forEach(li => {
    const span = doc.createElement('span');
    span.setAttribute('style', components.pillItem);
    const dot = doc.createElement('span');
    dot.setAttribute('style', `color:${colors.gold};margin-right:6px;`);
    dot.appendChild(makeLeafText(doc, '◆'));
    span.appendChild(dot);

    const txt = doc.createElement('span');
    Array.from(li.childNodes).forEach(n => txt.appendChild(n.cloneNode(true)));
    mark(txt, 'list');
    span.appendChild(txt);

    wrap.appendChild(span);
  });

  return wrap;
}

/** 有序列表：圆圈数字序号行 */
function buildOrderedList(doc: Document, c: LayoutConfig, ol: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors, components } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', 'margin:14px 0 20px;');

  let n = 0;
  ol.querySelectorAll(':scope > li').forEach(li => {
    n++;
    const row = doc.createElement('section');
    row.setAttribute('style', components.orderedItem);

    const num = doc.createElement('span');
    num.setAttribute('style', components.orderedNum);
    num.appendChild(makeStyledLeaf(doc, String(n), `color:#fff;font-size:11px;font-weight:700;`));
    row.appendChild(num);

    const txt = doc.createElement('p');
    txt.setAttribute('style', `margin:0;line-height:1.75;font-size:14px;flex:1;color:${colors.text};`);
    Array.from(li.childNodes).forEach(nd => txt.appendChild(nd.cloneNode(true)));
    mark(txt, 'list');
    row.appendChild(txt);

    wrap.appendChild(row);
  });

  return wrap;
}

/** 分隔线 */
function buildHr(doc: Document, c: LayoutConfig, mark: (e: Element, t: ElementType) => void): Element {
  const hr = doc.createElement('hr');
  hr.setAttribute('style', c.components.hr);
  mark(hr, 'hr');
  return hr;
}
