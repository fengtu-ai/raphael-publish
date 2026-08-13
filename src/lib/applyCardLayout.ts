/**
 * 卡册（现代杂志风）特殊排版渲染器 —— 第二套特殊排版结构
 *
 * 借鉴 gzh-design 摸鱼绿/石墨极简的**结构密度**：每个元素都做成多 section 嵌套的
 * 视觉组合，而非裸 p。但视觉语言为本项目原创，不复用其现成主题。
 *
 * 设计理念：
 * 1. **结构化组合**：章节标题=编号块+竖分隔线+双行标题（中文+英文副标）；
 *    引用=描边圆角框+REF 小标签+内文；列表=胶囊标记+标题+描述。每个块都有层次。
 * 2. **强调容器克制**：只有引用、代码、数据卡、文末 CTA 用容器，正文散排呼吸。
 * 3. **不固化目录**：无目录卡，封面后直接进内容。
 * 4. **视觉语言与松烟拉开**：深色实底编号块（松烟是渐变）、描边引用框（松烟是左竖线）、
 *    胶囊列表（松烟是圆点行）。
 *
 * 共享约定（与 applyLayout 一致，wechatCompat 自动兼容，不改 wechatCompat）：
 * - 根 `<section style=container>`：step1 自动 unwrap + 剥 max-width/padding + 加 12px。
 * - 多图 `<section class="image-grid">` + flex：step2 flex→table。
 * - pre 原样 + hljs token 内联（共享 markdown.ts 的 HLJS_LIGHT）：step3 pre→table 卡片。
 * - 装饰/标题文字用 `<span leaf="">`（关键字号/颜色用 makeStyledLeaf 显式内联到 span）。
 * - 渐变带纯色 fallback；hr 用 `<hr>` 元素。
 * - 自标 data-md-type/data-md-index（与 flat indexer 同序单全局计数）→
 *   markdownIndexer.ts:61-63 检测到已有标记即早返回，点击定位/滚动同步自动对齐。
 */

import type { LayoutConfig, LayoutTheme } from './themes/types';
import { THEMES } from './themes';
import type { ElementType } from './indexerRules';
import { HLJS_LIGHT } from './markdown';

function resolveLayoutTheme(themeId: string): LayoutTheme | null {
  const t = THEMES.find(th => th.id === themeId);
  if (t && t.kind === 'layout') return t;
  return null;
}

function makeLeafText(doc: Document, text: string): HTMLElement {
  const span = doc.createElement('span');
  span.setAttribute('leaf', '');
  span.textContent = text;
  return span;
}

function makeStyledLeaf(doc: Document, text: string, style: string): HTMLElement {
  const span = doc.createElement('span');
  span.setAttribute('leaf', '');
  span.setAttribute('style', style);
  span.textContent = text;
  return span;
}

function leafBr(doc: Document): HTMLElement {
  const span = doc.createElement('span');
  span.setAttribute('leaf', '');
  span.appendChild(doc.createElement('br'));
  return span;
}

function mergeStyle(existing: string | null, extra: string): string {
  return `${existing || ''}; ${extra}`.replace(/^;\s*/, '').trim();
}

type Role =
  | 'cover' | 'preamble' | 'chapter' | 'subtitle' | 'paragraph'
  | 'quote' | 'unordered-list' | 'ordered-list' | 'code'
  | 'divider' | 'image' | 'table' | 'passthrough';

interface RoleItem { el: Element; role: Role; }

function isConclusionTitle(text: string): boolean {
  return /(总结|结语|结尾|结束|结论|写在最后|后记|POSTSCRIPT|EPILOGUE|THE END)/i.test(text);
}

export function applyCardLayout(html: string, themeId: string): string {
  const theme = resolveLayoutTheme(themeId);
  if (!theme) return html;
  const c = theme.layout;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const sourceChildren = Array.from(doc.body.children);

  // --- Phase 1: 角色分类 ---
  const items: RoleItem[] = [];
  let h1El: Element | null = null;
  for (const el of sourceChildren) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'h1' && !h1El) { h1El = el; items.push({ el, role: 'cover' }); }
    else if (tag === 'h2') items.push({ el, role: 'chapter' });
    else if (tag === 'h3') items.push({ el, role: 'subtitle' });
    else if (tag === 'p') {
      const imgs = el.querySelectorAll('img');
      const text = (el.textContent || '').trim();
      if (imgs.length >= 1 && text === '') items.push({ el, role: 'image' });
      else items.push({ el, role: 'paragraph' });
    }
    else if (tag === 'blockquote') items.push({ el, role: 'quote' });
    else if (tag === 'ul') items.push({ el, role: 'unordered-list' });
    else if (tag === 'ol') items.push({ el, role: 'ordered-list' });
    else if (tag === 'pre') items.push({ el, role: 'code' });
    else if (tag === 'hr') items.push({ el, role: 'divider' });
    else if (tag === 'img') items.push({ el, role: 'image' });
    else if (tag === 'table') items.push({ el, role: 'table' });
    else items.push({ el, role: 'passthrough' });
  }

  // 首个 blockquote（在首个 h2 之前）→ 引言（封面后的引用框）
  const firstChapterIdx = items.findIndex(it => it.role === 'chapter');
  let introAssigned = false;
  for (const it of items) {
    if (it.role === 'quote' && !introAssigned) {
      const idx = items.indexOf(it);
      if (firstChapterIdx === -1 || idx < firstChapterIdx) {
        it.role = 'preamble';
        introAssigned = true;
      }
    }
  }

  const chapterItems = items.filter(it => it.role === 'chapter');

  // --- Phase 2: 构建输出树 + 自标索引 ---
  const out = doc.createElement('section');
  out.setAttribute('style', c.components.container);

  let mdIndex = 0;
  const mark = (el: Element, type: ElementType) => {
    el.setAttribute('data-md-type', type);
    el.setAttribute('data-md-index', String(mdIndex++));
  };

  // 2a. 封面：结构化开篇卡（顶部标签行 + 大标题 + 渐变线 + 副标题）
  if (h1El) {
    out.appendChild(buildCover(doc, c, h1El, mark));
  }

  // 2b. 主遍历：全散排，每个元素做成结构化组合
  let chapterCounter = 0;
  for (const it of items) {
    switch (it.role) {
      case 'cover': break;
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
        out.appendChild(buildImage(doc, c, it.el, mark));
        break;
      case 'table':
        out.appendChild(buildTable(c, it.el, mark));
        break;
      default: {
        const clone = it.el.cloneNode(true) as Element;
        out.appendChild(clone);
      }
    }
  }

  // 2c. 文末：END 线 + 三连 CTA
  out.appendChild(buildEndLine(doc, c));
  out.appendChild(buildFooterCta(doc, c));

  // --- Phase 3: 代码块高亮内联化 + 行内样式注入 ---
  out.querySelectorAll('.hljs span').forEach(span => {
    let s = span.getAttribute('style') || '';
    if (s && !s.endsWith(';')) s += '; ';
    span.classList.forEach(cls => { if (HLJS_LIGHT[cls]) s += HLJS_LIGHT[cls] + '; '; });
    if (s) span.setAttribute('style', s);
  });
  out.querySelectorAll('pre').forEach(pre => {
    const cur = pre.getAttribute('style') || '';
    pre.setAttribute('style', `${cur}; font-variant-ligatures: none; tab-size: 2;`);
  });
  out.querySelectorAll('pre code, pre .hljs, .hljs').forEach(node => {
    const cur = node.getAttribute('style') || '';
    node.setAttribute('style', `${cur}; display: block; font-size: inherit !important; line-height: inherit !important; font-style: normal !important; white-space: pre; word-break: normal; overflow-wrap: normal;`);
  });

  transformInline(out, c);

  return out.outerHTML;
}

// ============ 组件 builders ============

/** 封面：结构化开篇——顶部标签行（主色实底标签+引导线）+ 大标题 + 渐变粗线 + 副标题 */
function buildCover(doc: Document, c: LayoutConfig, h1: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', `margin:0 0 36px;padding:4px 0 0;`);

  // 顶部标签行：主色实底小标签 + 渐变细线（结构化组合，非单 p）
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
  rule.setAttribute('style', `background-color:${co.ink};background:linear-gradient(to right,${co.ink},${co.inkLight});width:56px;height:3px;border-radius:2px;margin:18px 0 14px;`);
  rule.appendChild(leafBr(doc));
  wrap.appendChild(rule);

  // 副标题（首个 h2 文本）
  const firstH2 = doc.querySelector('h2');
  if (firstH2) {
    const sub = doc.createElement('p');
    sub.setAttribute('style', `margin:0;font-size:13px;color:${co.textSoft};line-height:1.6;letter-spacing:0.3px;`);
    sub.appendChild(makeStyledLeaf(doc, (firstH2.textContent || '').trim(), `font-size:13px;color:${co.textSoft};line-height:1.6;letter-spacing:0.3px;`));
    wrap.appendChild(sub);
  }
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

  // 底部主色渐变细线（章节收尾装饰）
  const bottomLine = doc.createElement('section');
  bottomLine.setAttribute('style', `background-color:${co.rule};background:linear-gradient(to right,${co.inkLight},${co.rule});height:1px;margin-top:16px;`);
  bottomLine.appendChild(leafBr(doc));
  wrap.appendChild(bottomLine);

  return wrap;
}

/** h3 小节：主色左竖条 + 标题（结构化：竖条+文字 inline-flex） */
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

/** 引用块：结构化描边圆角框 + REF 小标签 + 内文（区别松烟左竖线） */
function buildQuoteBlock(doc: Document, c: LayoutConfig, bq: Element, mark: (e: Element, t: ElementType) => void, isIntro: boolean): Element {
  const { colors: co } = c;
  const section = doc.createElement('section');
  // 引言用主色描边+淡底，普通引用用浅底描边
  const borderColor = isIntro ? co.ink : co.rule;
  const bgColor = isIntro ? `${co.ink}08` : co.paperDeep;
  section.setAttribute('style', `background:${bgColor};border:1px solid ${borderColor};border-left:3px solid ${co.ink};border-radius:8px;padding:14px 16px;margin:0 0 22px;`);
  // REF 小标签行
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

/** 无序列表：胶囊式标记 + 项文（结构化，每项 inline-flex 组合） */
function buildPillList(doc: Document, c: LayoutConfig, ul: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', 'margin:14px 0 20px;');
  ul.querySelectorAll(':scope > li').forEach(li => {
    const row = doc.createElement('section');
    row.setAttribute('style', 'display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;');
    // 主色描边小方块标记（旋转 45° 成菱形）
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

/** 有序列表：深色实底编号块 + 项文（结构化组合，区别松烟渐变圆） */
function buildOrderedList(doc: Document, c: LayoutConfig, ol: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors: co } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', 'margin:14px 0 20px;');
  let n = 0;
  ol.querySelectorAll(':scope > li').forEach(li => {
    n++;
    const row = doc.createElement('section');
    row.setAttribute('style', 'display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;');
    // 深色实底圆角编号块（非圆形，圆角方形——区别松烟圆形）
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

/** hr：居中装饰——细线 + 主色菱形 + 细线（结构化 flex 组合） */
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

function buildImage(doc: Document, c: LayoutConfig, el: Element, mark: (e: Element, t: ElementType) => void): Element {
  const imgs = el.tagName.toLowerCase() === 'img' ? [el as HTMLImageElement] : Array.from(el.querySelectorAll('img'));
  const wrap = doc.createElement('section');
  if (imgs.length > 1) {
    wrap.classList.add('image-grid');
    wrap.setAttribute('style', c.components.imageGrid);
    const w = 100 / imgs.length;
    imgs.forEach(img => {
      const clone = img.cloneNode(true) as HTMLImageElement;
      clone.setAttribute('style', `width:calc(${w}% - ${8 * (imgs.length - 1) / imgs.length}px);margin:0;border-radius:8px;height:auto;display:block;`);
      wrap.appendChild(clone);
      mark(clone, 'image');
    });
  } else {
    wrap.setAttribute('style', c.components.image);
    imgs.forEach(img => {
      const clone = img.cloneNode(true) as HTMLImageElement;
      const existing = clone.getAttribute('style') || '';
      clone.setAttribute('style', `${existing};display:block;width:100%;max-width:100%;height:auto;margin:0 auto;border-radius:10px;box-sizing:border-box;box-shadow:0 12px 28px rgba(15,23,42,0.16),0 2px 8px rgba(15,23,42,0.10);border:1px solid rgba(15,23,42,0.08);`);
      wrap.appendChild(clone);
      mark(clone, 'image');
    });
  }
  if (el.tagName.toLowerCase() === 'p') {
    const txt = (el.textContent || '').trim();
    if (txt) mark(wrap, 'paragraph');
  }
  return wrap;
}

function buildTable(c: LayoutConfig, table: Element, mark: (e: Element, t: ElementType) => void): Element {
  const clone = table.cloneNode(true) as HTMLElement;
  clone.setAttribute('style', `width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;`);
  clone.querySelectorAll('th').forEach(th => th.setAttribute('style', c.components.tableTh));
  clone.querySelectorAll('td').forEach(td => td.setAttribute('style', c.components.tableTd));
  clone.querySelectorAll('tr').forEach(tr => mark(tr, 'table'));
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

function buildFooterCta(doc: Document, c: LayoutConfig): Element {
  const { colors: co, components: k } = c;
  const card = doc.createElement('section');
  card.setAttribute('style', k.footerCta || `margin:0;background:${co.paperDeep};border:1px solid ${co.rule};border-radius:16px;padding:26px 22px;text-align:center;`);

  const lead = doc.createElement('p');
  lead.setAttribute('style', `font-size:13px;font-weight:600;color:${co.text};margin:0 0 18px;line-height:1.6;text-align:center;`);
  lead.appendChild(makeLeafText(doc, '读到这里，如果觉得有用，随手点个赞、转发给需要的朋友吧。'));
  card.appendChild(lead);

  const row = doc.createElement('section');
  row.setAttribute('style', 'display:flex;justify-content:center;gap:32px;margin-bottom:14px;');
  const actions = [
    { name: '关注', svg: '<path d="M12 5v14"></path><path d="M5 12h14"></path>', color: '#fff', bg: co.ink, border: co.inkLight },
    { name: '点赞', svg: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>', color: co.text, bg: '#fff', border: co.rule },
    { name: '转发', svg: '<path d="M4 18v-4a8 8 0 0 1 8-8h8"></path><polyline points="16 2 20 6 16 10"></polyline>', color: co.text, bg: '#fff', border: co.rule },
  ];
  for (const a of actions) {
    const cell = doc.createElement('section');
    cell.setAttribute('style', 'text-align:center;');
    const box = doc.createElement('section');
    box.setAttribute('style', `width:40px;height:40px;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;background:${a.bg};border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.05);border:1px solid ${a.border};`);
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20'); svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', a.color); svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = a.svg;
    box.appendChild(svg);
    cell.appendChild(box);
    const cap = doc.createElement('span');
    cap.setAttribute('style', `font-size:10px;font-weight:600;color:${a.color === '#fff' ? co.ink : co.textSoft};`);
    cap.appendChild(makeLeafText(doc, a.name));
    cell.appendChild(cap);
    row.appendChild(cell);
  }
  card.appendChild(row);

  return card;
}

// ============ 行内样式注入 ============

function transformInline(root: Element, c: LayoutConfig): void {
  const { inline } = c;
  root.querySelectorAll('strong').forEach(s => {
    s.setAttribute('style', mergeStyle(s.getAttribute('style'), inline.bold));
  });
  root.querySelectorAll('code').forEach(code => {
    if (code.closest('pre')) return;
    code.setAttribute('style', mergeStyle(code.getAttribute('style'), inline.code));
  });
  root.querySelectorAll('a').forEach(a => {
    if ((a.getAttribute('href') || '').startsWith('#ch-')) return;
    a.setAttribute('style', mergeStyle(a.getAttribute('style'), inline.link));
  });
  root.querySelectorAll('mark').forEach(m => {
    m.setAttribute('style', mergeStyle(m.getAttribute('style'), inline.highlight));
  });
}
