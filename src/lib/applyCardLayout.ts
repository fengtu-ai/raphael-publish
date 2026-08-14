/**
 * 卡册（现代杂志风）特殊排版渲染器 —— 第二套特殊排版结构
 *
 * 核心特征：
 * - 结构化组合：章节标题=编号块+竖分隔线+双行标题（中文+英文副标）；
 * - 引用=描边圆角框+REF 小标签+内文；列表=胶囊标记+标题+描述。每个块都有层次。
 * - 强调容器克制：正文散排呼吸，引用、代码、数据卡用容器。
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
} from './layoutCommon';

function resolveLayoutTheme(themeId: string): LayoutTheme | null {
  const t = THEMES.find(th => th.id === themeId);
  if (t && t.kind === 'layout') return t;
  return null;
}

export function applyCardLayout(html: string, themeId: string, codeThemeId?: string): string {
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

  // 2a. 封面：结构化开篇卡
  if (h1El) {
    out.appendChild(buildCover(doc, c, h1El, mark));
  }

  // 2b. 主遍历
  let chapterCounter = 0;
  for (const it of items) {
    switch (it.role) {
      case 'cover':
        break;
      case 'preamble':
        out.appendChild(buildQuoteBlock(doc, c, it.el, mark, true));
        break;
      case 'chapter': {
        chapterCounter++;
        const isLast = (it === chapterItems[chapterItems.length - 1]);
        const conclusion = isLast && isConclusionTitle(it.el.textContent || '');
        out.appendChild(buildChapterTitle(doc, c, it.el, chapterCounter, conclusion, mark));
        break;
      }
      case 'subtitle':
        out.appendChild(buildSubtitle(doc, c, it.el, mark));
        break;
      case 'paragraph':
        out.appendChild(buildParagraph(c, it.el, mark));
        break;
      case 'quote':
        out.appendChild(buildQuoteBlock(doc, c, it.el, mark, false));
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

  // 2c. 文末：END 线 + 公共三连 CTA
  out.appendChild(buildEndLine(doc, c));
  out.appendChild(buildCommonFooterCta(doc, c));

  // --- Phase 3: 代码块高亮与容器主题化 + 行内样式注入 ---
  applyCodeThemeToDom(out, codeThemeId);
  transformCommonInlines(out, c);

  return out.outerHTML;
}

// ============ 卡册专属组件 builders ============

/** 封面：结构化开篇——顶部标签行（主色实底标签+引导线）+ 大标题 + 渐变粗线 + 副标题 */
function buildCover(doc: Document, c: LayoutConfig, h1: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `margin:0 0 36px;padding:4px 0 0;`);

  // 顶部标签行：主色实底小标签 + 渐变细线
  const tagRow = doc.createElement('section');
  tagRow.setAttribute('style', `display:flex;align-items:center;gap:10px;margin-bottom:22px;`);
  const tag = doc.createElement('span');
  tag.setAttribute('style', `display:inline-block;background:${co.ink};color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:3px;letter-spacing:1px;`);
  tag.appendChild(makeLeafText(doc, 'ARTICLE'));
  tagRow.appendChild(tag);
  const tagLine = doc.createElement('span');
  tagLine.setAttribute('style', `flex:1;height:1px;background-color:${co.rule};background:linear-gradient(to right,${co.inkLight},${co.rule});`);
  tagLine.appendChild(leafBr(doc));
  tagRow.appendChild(tagLine);
  wrap.appendChild(tagRow);

  // 大标题（h1 → heading 索引）
  const title = doc.createElement('p');
  title.setAttribute('style', `margin:0;font-size:28px;font-weight:900;color:${co.text};line-height:1.25;letter-spacing:-0.5px;`);
  title.appendChild(makeStyledLeaf(doc, (h1.textContent || '').trim() || '无题', `font-size:28px;font-weight:900;color:${co.text};line-height:1.25;letter-spacing:-0.5px;`));
  mark(title, 'heading');
  wrap.appendChild(title);

  // 主色渐变粗短线
  const rule = doc.createElement('section');
  rule.setAttribute('style', `background-color:${co.ink};background:linear-gradient(to right,${co.ink},${co.inkLight});width:56px;height:3px;border-radius:2px;margin:18px 0 0;`);
  rule.appendChild(leafBr(doc));
  wrap.appendChild(rule);
  return wrap;
}

/** h2 章节标题：结构化组合——深色实底编号块 + 竖分隔线 + 中文标题行 + 英文副标行 */
function buildChapterTitle(doc: Document, c: LayoutConfig, h2: Element, idx: number, conclusion: boolean, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `margin:44px 0 26px;`);

  // 编号块 + 竖分隔线 + 标题，横向 flex 组合
  const row = doc.createElement('section');
  row.setAttribute('style', `display:flex;align-items:center;gap:16px;`);

  // 左侧深色实底编号块（白字编号 + PART 小标，纵向堆叠）
  const numBox = doc.createElement('section');
  numBox.setAttribute('style', `background-color:${co.ink};background:linear-gradient(135deg,${co.ink},${co.inkLight});border-radius:10px;padding:8px 12px;flex-shrink:0;text-align:center;min-width:52px;box-sizing:border-box;`);
  const num = doc.createElement('p');
  num.setAttribute('style', `margin:0;line-height:1;letter-spacing:-1px;`);
  num.appendChild(makeStyledLeaf(doc, conclusion ? '∞' : String(idx).padStart(2, '0'), `font-size:20px;font-weight:900;color:#fff;line-height:1;letter-spacing:-1px;`));
  numBox.appendChild(num);
  const part = doc.createElement('p');
  part.setAttribute('style', `margin:3px 0 0;letter-spacing:1.5px;`);
  part.appendChild(makeStyledLeaf(doc, conclusion ? 'LAST' : 'PART', `font-size:7px;font-weight:700;color:rgba(255,255,255,0.78);letter-spacing:1.5px;`));
  numBox.appendChild(part);
  row.appendChild(numBox);

  // 竖分隔线
  const divider = doc.createElement('span');
  divider.setAttribute('style', `width:1px;height:38px;background:${co.rule};flex-shrink:0;`);
  divider.appendChild(leafBr(doc));
  row.appendChild(divider);

  // 右侧标题组：中文标题 + 英文副标
  const titleGroup = doc.createElement('section');
  titleGroup.setAttribute('style', `flex:1;min-width:0;`);
  const title = doc.createElement('p');
  title.setAttribute('style', `margin:0 0 2px;font-size:18px;font-weight:800;color:${co.text};letter-spacing:0.3px;line-height:1.3;`);
  title.appendChild(makeStyledLeaf(doc, (h2.textContent || '').trim(), `font-size:18px;font-weight:800;color:${co.text};letter-spacing:0.3px;line-height:1.3;`));
  mark(title, 'heading');
  titleGroup.appendChild(title);
  const enLabel = doc.createElement('p');
  enLabel.setAttribute('style', `margin:0;font-size:10px;font-weight:600;color:${co.textSoft};letter-spacing:1.5px;`);
  enLabel.appendChild(makeStyledLeaf(doc, conclusion ? 'EPILOGUE' : `CHAPTER ${String(idx).padStart(2, '0')}`, `font-size:10px;font-weight:600;color:${co.textSoft};letter-spacing:1.5px;`));
  titleGroup.appendChild(enLabel);
  row.appendChild(titleGroup);

  wrap.appendChild(row);

  // 底部主色渐变细线
  const bottomLine = doc.createElement('section');
  bottomLine.setAttribute('style', `background-color:${co.rule};background:linear-gradient(to right,${co.inkLight},${co.rule});height:1px;margin-top:16px;`);
  bottomLine.appendChild(leafBr(doc));
  wrap.appendChild(bottomLine);

  return wrap;
}

/** h3 小节：主色左竖条 + 标题 */
function buildSubtitle(doc: Document, c: LayoutConfig, h3: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const row = doc.createElement('section');
  row.setAttribute('style', `display:flex;align-items:center;gap:10px;margin:26px 0 14px;`);
  const bar = doc.createElement('span');
  bar.setAttribute('style', `display:inline-block;width:4px;height:18px;background-color:${co.ink};background:linear-gradient(180deg,${co.ink},${co.inkLight});border-radius:2px;flex-shrink:0;`);
  bar.appendChild(leafBr(doc));
  row.appendChild(bar);
  const p = doc.createElement('p');
  p.setAttribute('style', `margin:0;font-size:16px;font-weight:800;color:${co.text};line-height:1.4;`);
  p.appendChild(makeStyledLeaf(doc, (h3.textContent || '').trim(), `font-size:16px;font-weight:800;color:${co.text};line-height:1.4;`));
  mark(p, 'heading');
  row.appendChild(p);
  return row;
}

/** 引用块：结构化描边圆角框 + REF 小标签 + 内文 */
function buildQuoteBlock(doc: Document, c: LayoutConfig, bq: Element, mark: (e: Element, t: ElementType) => void, isIntro: boolean): Element {
  const { colors: co } = c;
  const section = doc.createElement('section');
  const borderColor = isIntro ? co.ink : co.rule;
  const bgColor = isIntro ? `${co.ink}08` : co.paperDeep;
  section.setAttribute('style', `background:${bgColor};border:1px solid ${borderColor};border-left:3px solid ${co.ink};border-radius:8px;padding:14px 16px;margin:0 0 22px;`);
  const label = doc.createElement('p');
  label.setAttribute('style', `margin:0 0 8px;font-size:10px;color:${co.textSoft};letter-spacing:2px;font-weight:600;`);
  label.appendChild(makeLeafText(doc, isIntro ? 'QUOTE' : 'REFERENCE'));
  section.appendChild(label);
  const p = doc.createElement('p');
  p.setAttribute('style', `margin:0;font-size:${isIntro ? '15px' : '14px'};font-weight:${isIntro ? '600' : '400'};color:${isIntro ? co.text : co.textSoft};line-height:1.75;letter-spacing:0.3px;`);
  Array.from(bq.childNodes).forEach(n => p.appendChild(n.cloneNode(true)));
  mark(p, 'quote');
  section.appendChild(p);
  return section;
}

/** 无序列表：胶囊式标记 + 项文 */
function buildPillList(doc: Document, c: LayoutConfig, ul: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', 'margin:14px 0 20px;');
  ul.querySelectorAll(':scope > li').forEach(li => {
    const row = doc.createElement('section');
    row.setAttribute('style', 'display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;');
    const dot = doc.createElement('span');
    dot.setAttribute('style', `display:inline-block;width:8px;height:8px;background-color:${co.ink};background:linear-gradient(135deg,${co.ink},${co.inkLight});border-radius:1px;transform:rotate(45deg);margin-top:8px;flex-shrink:0;`);
    dot.appendChild(leafBr(doc));
    row.appendChild(dot);
    const txt = doc.createElement('p');
    txt.setAttribute('style', 'margin:0;line-height:1.8;font-size:14px;flex:1;color:inherit;');
    Array.from(li.childNodes).forEach(n => txt.appendChild(n.cloneNode(true)));
    mark(txt, 'list');
    row.appendChild(txt);
    wrap.appendChild(row);
  });
  return wrap;
}

/** 有序列表：深色实底编号块 + 项文 */
function buildOrderedList(doc: Document, c: LayoutConfig, ol: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', 'margin:14px 0 20px;');
  let n = 0;
  ol.querySelectorAll(':scope > li').forEach(li => {
    n++;
    const row = doc.createElement('section');
    row.setAttribute('style', 'display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;');
    const num = doc.createElement('span');
    num.setAttribute('style', `display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background-color:${co.ink};background:linear-gradient(135deg,${co.ink},${co.inkLight});color:#fff;font-size:11px;font-weight:700;border-radius:6px;flex-shrink:0;margin-top:1px;box-shadow:0 2px 6px ${co.ink}33;box-sizing:border-box;`);
    num.appendChild(makeLeafText(doc, String(n)));
    row.appendChild(num);
    const txt = doc.createElement('p');
    txt.setAttribute('style', 'margin:0;line-height:1.8;font-size:14px;flex:1;color:inherit;padding-top:1px;');
    Array.from(li.childNodes).forEach(nd => txt.appendChild(nd.cloneNode(true)));
    mark(txt, 'list');
    row.appendChild(txt);
    wrap.appendChild(row);
  });
  return wrap;
}

/** hr：居中装饰——细线 + 主色菱形 + 细线 */
function buildHr(doc: Document, c: LayoutConfig, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `display:flex;align-items:center;justify-content:center;gap:12px;margin:30px 0;`);
  const line1 = doc.createElement('span');
  line1.setAttribute('style', `height:1px;flex:1;background:${co.rule};max-width:140px;`);
  line1.appendChild(leafBr(doc));
  wrap.appendChild(line1);
  const sq = doc.createElement('span');
  sq.setAttribute('style', `display:inline-block;width:7px;height:7px;background-color:${co.ink};background:linear-gradient(135deg,${co.ink},${co.inkLight});transform:rotate(45deg);`);
  sq.appendChild(leafBr(doc));
  wrap.appendChild(sq);
  const line2 = doc.createElement('span');
  line2.setAttribute('style', `height:1px;flex:1;background:${co.rule};max-width:140px;`);
  line2.appendChild(leafBr(doc));
  wrap.appendChild(line2);
  const hr = doc.createElement('hr');
  hr.setAttribute('style', `display:none;`);
  mark(hr, 'hr');
  wrap.appendChild(hr);
  return wrap;
}

function buildParagraph(c: LayoutConfig, p: Element, mark: (e: Element, t: ElementType) => void): Element {
  const clone = p.cloneNode(true) as HTMLElement;
  clone.setAttribute('style', c.components.paragraph);
  mark(clone, 'paragraph');
  return clone;
}

/** END 收尾线：结构化——细线 + END 字 + 细线 */
function buildEndLine(doc: Document, c: LayoutConfig): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `display:flex;align-items:center;justify-content:center;gap:16px;margin:40px 0 28px;`);
  const line1 = doc.createElement('span');
  line1.setAttribute('style', `height:1px;width:48px;background:${co.rule};`);
  line1.appendChild(leafBr(doc));
  wrap.appendChild(line1);
  const endTxt = doc.createElement('span');
  endTxt.setAttribute('style', `font-size:10px;color:${co.textSoft};letter-spacing:4px;font-weight:600;`);
  endTxt.appendChild(makeLeafText(doc, 'END'));
  wrap.appendChild(endTxt);
  const line2 = doc.createElement('span');
  line2.setAttribute('style', `height:1px;width:48px;background:${co.rule};`);
  line2.appendChild(leafBr(doc));
  wrap.appendChild(line2);
  return wrap;
}
