/**
 * 特殊排版重构渲染器
 *
 * 把 markdown-it 产出的扁平 HTML（h1/h2/p/blockquote/ul/ol/pre/hr/img/table…）
 * 重构为结构化组件树：封面卡 → 编号章节标题 → 金句卡 → 段落/列表 → 文末三连卡。
 *
 * 设计参照 gzh-design skill「扁平→结构化重组」的思路，但组件与视觉为本项目原创，
 * 不复用 skill 的现成主题。所有特殊排版主题共享这一个渲染器，换色即换皮（LayoutConfig）。
 *
 * 关键约束：
 * - 全程内联 style，用 <section>/<p>/<span>，不用 div/class/id（WeChat 会剥/改写）。
 * - 装饰空元素内放 <span leaf=""><br></span> 占位，防 WeChat 剥样式。
 * - 文字节点用 <span leaf=""> 包裹（结构化文案）；正文 <p> 内文字沿用 flat 习惯。
 * - 渐变背景自带纯色 fallback（background-color 在前，background:gradient 在后）。
 * - 自己按 Markdown 顺序盖 data-md-type/data-md-index（与 flat indexer 同序），
 *   因为 layout 顶层是装饰 <section>，现有 markElementIndexes 的 tag 匹配会落空。
 *   装饰块（封面/目录/三连）无 Markdown 源，不消费索引。
 */

import type { LayoutConfig, LayoutTheme } from './themes/types';
import { THEMES } from './themes';
import type { ElementType } from './indexerRules';
import { HLJS_LIGHT } from './markdown';

/** 判断章节是否为结语类（末章用 ∞） */
function isConclusionTitle(text: string): boolean {
  return /(总结|结语|结尾|结束|结论|写在最后|后记|POSTSCRIPT|EPILOGUE|THE END)/i.test(text);
}

/** 创建带 leaf 包裹的文本 span */
function makeLeafText(doc: Document, text: string): HTMLElement {
  const span = doc.createElement('span');
  span.setAttribute('leaf', '');
  span.textContent = text;
  return span;
}

/** 创建带 leaf 包裹 + 显式内联样式的文本 span。
 *  公众号对 inline span 的 CSS 继承不可靠，标题/编号等关键文字必须把
 *  font-size/color/font-weight 显式写到 span 上，否则复制后字号颜色会丢。 */
function makeStyledLeaf(doc: Document, text: string, style: string): HTMLElement {
  const span = doc.createElement('span');
  span.setAttribute('leaf', '');
  span.setAttribute('style', style);
  span.textContent = text;
  return span;
}

/** 装饰空元素占位：<span leaf=""><br></span> */
function leafBr(doc: Document): HTMLElement {
  const span = doc.createElement('span');
  span.setAttribute('leaf', '');
  span.appendChild(doc.createElement('br'));
  return span;
}

type Role =
  | 'cover' | 'intro' | 'chapter' | 'subtitle' | 'paragraph'
  | 'quote' | 'unordered-list' | 'ordered-list' | 'code'
  | 'divider' | 'image' | 'table' | 'passthrough';

interface RoleItem { el: Element; role: Role; }

/** 拿到 layout 主题，否则返回 null */
function resolveLayoutTheme(themeId: string): LayoutTheme | null {
  const t = THEMES.find(th => th.id === themeId);
  if (t && t.kind === 'layout') return t;
  return null;
}

export function applyLayout(html: string, themeId: string): string {
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

  // 首个 blockquote（出现在首个 h2 之前）→ 引言金句卡
  const firstChapterIdx = items.findIndex(it => it.role === 'chapter');
  let introAssigned = false;
  for (const it of items) {
    if (it.role === 'quote' && !introAssigned) {
      const idx = items.indexOf(it);
      if (firstChapterIdx === -1 || idx < firstChapterIdx) {
        it.role = 'intro';
        introAssigned = true;
      }
    }
  }

  const chapterItems = items.filter(it => it.role === 'chapter');

  // --- Phase 2: 构建输出树 + 自标索引 ---
  const out = doc.createElement('section');
  out.setAttribute('style', c.components.container);

  let mdIndex = 0; // 与 flat markElementIndexes 同序的全局计数
  const mark = (el: Element, type: ElementType) => {
    el.setAttribute('data-md-type', type);
    el.setAttribute('data-md-index', String(mdIndex++));
  };

  // 2a. 封面（来自 h1）。封面是装饰，不消费 md 索引；但 h1 本身是 heading 源，
  // 把标记打在封面内的标题 <p> 上，使点击标题能定位回 # 标题。
  if (h1El) {
    const cover = buildCover(doc, c, h1El, mark);
    out.appendChild(cover);
  }

  // 2b. 目录（2+ 章节时，紧跟封面之下）。纯装饰，不消费索引。
  if (chapterItems.length >= 2) {
    out.appendChild(buildToc(doc, c, chapterItems));
  }

  // 2c. 主遍历
  let chapterCounter = 0;
  for (const it of items) {
    switch (it.role) {
      case 'cover': break; // 已在 2a 发出
      case 'intro':
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
        // pre 原样克隆，盖 code 索引；下游 wechatCompat 的 pre→table 卡片复用
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

  // 2c. 文末三连卡（纯装饰，无 Markdown 源，不消费索引）
  out.appendChild(buildFooterCta(doc, c));

  // --- Phase 3: 代码块高亮内联化 + 行内样式注入 ---
  // 公众号会剥 class，hljs 的 .hljs-keyword 等必须内联成 style 才能保住高亮。
  // 与 flat 路径（markdown.ts HLJS_LIGHT）完全同一张表，保证两路一致。
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

function buildCover(doc: Document, c: LayoutConfig, h1: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors, components } = c;
  const cover = doc.createElement('section');
  cover.setAttribute('style', components.cover);

  const inner = doc.createElement('section');
  inner.setAttribute('style', 'padding:34px 26px 30px;');
  cover.appendChild(inner);

  // 顶部主色短线（居中装饰，自带纯色 fallback）
  const topBar = doc.createElement('section');
  topBar.setAttribute('style', `background-color:${colors.ink};background:linear-gradient(to right,${colors.inkLight},${colors.ink},${colors.inkLight});width:40px;height:3px;border-radius:2px;margin:0 0 22px;`);
  topBar.appendChild(leafBr(doc));
  inner.appendChild(topBar);

  // 主标题（h1 → heading 索引）：整体粗黑居中，无尾词花哨高亮
  const title = doc.createElement('p');
  title.setAttribute('style', components.coverTitle);
  const txt = (h1.textContent || '').trim() || '无题';
  const coverTitleStyle = `font-size:26px;font-weight:900;color:${colors.text};line-height:1.3;letter-spacing:-0.5px;`;
  title.appendChild(makeStyledLeaf(doc, txt, coverTitleStyle));
  mark(title, 'heading');
  inner.appendChild(title);

  // 装饰短横（主色渐变，居中，自带纯色 fallback）
  const bar = doc.createElement('section');
  bar.setAttribute('style', `background-color:${colors.ink};background:linear-gradient(to right,${colors.inkLight},${colors.ink},${colors.inkLight});width:52px;height:3px;border-radius:2px;margin:18px auto 14px;`);
  bar.appendChild(leafBr(doc));
  inner.appendChild(bar);

  // 副标题（取首个 h2 标题作为导读，否则省略）
  const firstH2 = doc.querySelector('h2');
  if (firstH2) {
    const sub = doc.createElement('p');
    sub.setAttribute('style', components.coverSubtitle);
    const subStyle = `font-size:13px;color:${colors.textSoft};line-height:1.6;letter-spacing:0.3px;`;
    sub.appendChild(makeStyledLeaf(doc, (firstH2.textContent || '').trim(), subStyle));
    inner.appendChild(sub);
  }

  // 底栏渐变条（主色 → 浅主色，纯装饰，自带纯色 fallback）
  const footer = doc.createElement('section');
  footer.setAttribute('style', components.coverFooter);
  footer.appendChild(leafBr(doc));
  cover.appendChild(footer);

  return cover;
}

function buildChapter(doc: Document, c: LayoutConfig, h2: Element, idx: number, conclusion: boolean, mark: (e: Element, t: ElementType) => void): Element {
  const { colors, components } = c;
  const section = doc.createElement('section');
  section.setAttribute('style', components.chapter);

  // 左侧编号块：固定 60×60 正方形 + 渐变填充 + 白字编号（去掉 PART，单行更干净）。
  // 垂直居中用 line-height:60px 撑满方块高度——公众号对 line-height 永不剥，
  // 比依赖 display:table-cell 的居中稳得多（display:table 单格在固定高外壳里居中不可靠）。
  const numBlock = doc.createElement('section');
  numBlock.setAttribute('style', `background-color:${colors.ink};background:linear-gradient(135deg,${colors.ink},${colors.inkLight});border-radius:14px;width:60px;height:60px;flex-shrink:0;box-shadow:0 4px 12px ${colors.ink}33;box-sizing:border-box;text-align:center;`);
  const num = doc.createElement('p');
  num.setAttribute('style', `margin:0;text-align:center;`);
  const numTxt = conclusion ? '∞' : String(idx).padStart(2, '0');
  num.appendChild(makeStyledLeaf(doc, numTxt, `font-size:24px;font-weight:900;color:#fff;line-height:60px;letter-spacing:-1px;text-align:center;`));
  numBlock.appendChild(num);
  section.appendChild(numBlock);

  // 右侧：中文标题（heading 索引）+ 主色渐变下划线（无英文标签，无锚点 id）
  const right = doc.createElement('section');
  right.setAttribute('style', 'flex:1;min-width:0;padding:6px 0 0;');
  const title = doc.createElement('p');
  title.setAttribute('style', components.chapterTitle);
  // 标题文字字号/颜色/字重显式内联到 leaf span，防公众号继承丢失
  const titleStyle = `font-size:17px;font-weight:800;color:${colors.text};letter-spacing:0.3px;line-height:1.3;`;
  title.appendChild(makeStyledLeaf(doc, (h2.textContent || '').trim(), titleStyle));
  mark(title, 'heading');
  right.appendChild(title);
  // 主色渐变短下划线（自带纯色 fallback）
  const underline = doc.createElement('section');
  underline.setAttribute('style', `background-color:${colors.ink};background:linear-gradient(to right,${colors.ink},${colors.inkLight});width:36px;height:2px;border-radius:1px;margin-top:10px;`);
  underline.appendChild(leafBr(doc));
  right.appendChild(underline);
  section.appendChild(right);

  return section;
}

function buildSubtitle(doc: Document, c: LayoutConfig, h3: Element, mark: (e: Element, t: ElementType) => void): Element {
  const section = doc.createElement('p');
  section.setAttribute('style', c.components.subtitle);
  const subStyle = `font-size:15px;font-weight:800;color:${c.colors.ink};`;
  section.appendChild(makeStyledLeaf(doc, (h3.textContent || '').trim(), subStyle));
  mark(section, 'heading');
  return section;
}

function buildToc(doc: Document, c: LayoutConfig, chapters: RoleItem[]): Element {
  const { colors, components } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', components.toc);

  // 标题行：「N PARTS · 导读」
  const head = doc.createElement('section');
  head.setAttribute('style', components.tocTitle);
  const left = doc.createElement('p');
  left.setAttribute('style', `margin:0;font-size:10px;color:${colors.textSoft};letter-spacing:1px;font-weight:600;`);
  left.appendChild(makeLeafText(doc, `${chapters.length} PARTS · 导读`));
  head.appendChild(left);
  wrap.appendChild(head);

  // 卡条：每卡是 <a href="#ch-N">，点击锚点跳转到对应章节（预览内有效）
  const scroll = doc.createElement('section');
  scroll.setAttribute('style', components.tocScroll);
  chapters.forEach((it, i) => {
    const isLast = (i === chapters.length - 1);
    const conclusion = isLast && isConclusionTitle(it.el.textContent || '');
    const highlight = i === 0;
    const card = doc.createElement('section');
    card.setAttribute('style', `${highlight ? components.tocCard : components.tocCardDim}`);
    // 内层用 <section display:table> 包一层，height:100% 撑满卡片，内部 table-cell 垂直居中
    const cell = doc.createElement('section');
    cell.setAttribute('style', `display:table;width:100%;height:100%;table-layout:fixed;`);
    const inner = doc.createElement('section');
    inner.setAttribute('style', `display:table-cell;vertical-align:middle;text-align:center;`);
    // 编号
    const num = doc.createElement('p');
    num.setAttribute('style', `margin:0 0 6px;font-size:18px;font-weight:900;line-height:1;letter-spacing:-1px;color:${highlight ? '#fff' : colors.ink};`);
    num.appendChild(makeLeafText(doc, conclusion ? '∞' : String(i + 1).padStart(2, '0')));
    inner.appendChild(num);
    // 中文标题（限制 2 行）
    const title = doc.createElement('p');
    title.setAttribute('style', `margin:0;font-size:11px;font-weight:600;line-height:1.35;color:${highlight ? '#fff' : colors.text};white-space:normal;word-break:break-all;overflow:hidden;max-height:30px;`);
    title.appendChild(makeLeafText(doc, (it.el.textContent || '').trim()));
    inner.appendChild(title);
    cell.appendChild(inner);
    card.appendChild(cell);
    scroll.appendChild(card);
  });
  wrap.appendChild(scroll);
  return wrap;
}

function buildParagraph(c: LayoutConfig, p: Element, mark: (e: Element, t: ElementType) => void): Element {
  // 克隆原 p（保留内部 strong/code/a/img 等），盖 paragraph 索引，套正文样式
  const clone = p.cloneNode(true) as HTMLElement;
  clone.setAttribute('style', c.components.paragraph);
  mark(clone, 'paragraph');
  return clone;
}

function buildOnelinerCard(doc: Document, c: LayoutConfig, bq: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors, components } = c;
  const section = doc.createElement('section');
  section.setAttribute('style', components.onelinerCard);
  // 取引用文本
  const text = (bq.textContent || '').trim();
  const p = doc.createElement('p');
  p.setAttribute('style', `margin:0;line-height:1.75;font-size:15px;color:${colors.ink};font-weight:600;letter-spacing:0.4px;`);
  p.appendChild(makeLeafText(doc, text));
  mark(p, 'quote');
  section.appendChild(p);
  return section;
}

function buildQuoteBox(doc: Document, c: LayoutConfig, bq: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { components } = c;
  const section = doc.createElement('section');
  section.setAttribute('style', components.quoteBox);
  const p = doc.createElement('p');
  p.setAttribute('style', 'margin:0;line-height:1.75;font-size:14px;');
  // 保留内部行内标记
  const inner = Array.from(bq.childNodes);
  inner.forEach(n => p.appendChild(n.cloneNode(true)));
  mark(p, 'quote');
  section.appendChild(p);
  return section;
}

function buildPillList(doc: Document, c: LayoutConfig, ul: Element, mark: (e: Element, t: ElementType) => void): Element {
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', 'margin:16px 0 24px;');
  ul.querySelectorAll(':scope > li').forEach(li => {
    const row = doc.createElement('section');
    row.setAttribute('style', 'display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;');
    const dot = doc.createElement('span');
    dot.setAttribute('style', `display:inline-block;width:6px;height:6px;background:${c.colors.ink};border-radius:50%;margin-top:8px;flex-shrink:0;`);
    dot.appendChild(leafBr(doc));
    const txt = doc.createElement('p');
    txt.setAttribute('style', 'margin:0;line-height:1.8;font-size:14px;flex:1;');
    Array.from(li.childNodes).forEach(n => txt.appendChild(n.cloneNode(true)));
    mark(txt, 'list');
    row.appendChild(dot); row.appendChild(txt);
    wrap.appendChild(row);
  });
  return wrap;
}

function buildOrderedList(doc: Document, c: LayoutConfig, ol: Element, mark: (e: Element, t: ElementType) => void): Element {
  const { colors, components } = c;
  const wrap = doc.createElement('section');
  wrap.setAttribute('style', 'margin:16px 0 24px;');
  let n = 0;
  ol.querySelectorAll(':scope > li').forEach(li => {
    n++;
    const row = doc.createElement('section');
    row.setAttribute('style', components.orderedItem);
    const num = doc.createElement('span');
    // 渐变填充圆 + 白字编号（自带纯色 fallback）
    num.setAttribute('style', `display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background-color:${colors.ink};background:linear-gradient(135deg,${colors.ink},${colors.inkLight});color:#fff;font-size:11px;font-weight:700;border-radius:50%;flex-shrink:0;margin-top:1px;box-shadow:0 2px 6px ${colors.ink}33;`);
    num.appendChild(makeLeafText(doc, String(n)));
    row.appendChild(num);
    const txt = doc.createElement('p');
    txt.setAttribute('style', 'margin:0;line-height:1.8;font-size:14px;flex:1;');
    Array.from(li.childNodes).forEach(nd => txt.appendChild(nd.cloneNode(true)));
    mark(txt, 'list');
    row.appendChild(txt);
    wrap.appendChild(row);
  });
  return wrap;
}

function buildHr(doc: Document, c: LayoutConfig, mark: (e: Element, t: ElementType) => void): Element {
  // 用 hr 元素承载（公众号对 <hr> 兼容好，wechatCompat 第6步会做 gradient fallback）
  const hr = doc.createElement('hr');
  hr.setAttribute('style', c.components.hr);
  mark(hr, 'hr');
  return hr;
}

function buildImage(doc: Document, c: LayoutConfig, el: Element, mark: (e: Element, t: ElementType) => void): Element {
  // el 可能是 p（含 img）或 img。含多张图 → 网格布局（类朋友圈多图，空格分隔并排）
  // 用 .image-grid 标记 + flex，复用 wechatCompat 的 flex→table 转换，微信里不塌。
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
      // 必须显式给尺寸样式，否则 data:image/svg+xml 等无固有尺寸的图会渲染为 0
      const existing = clone.getAttribute('style') || '';
      clone.setAttribute('style', `${existing};display:block;width:100%;max-width:100%;height:auto;margin:0 auto;border-radius:10px;box-sizing:border-box;box-shadow:0 12px 28px rgba(15,23,42,0.16),0 2px 8px rgba(15,23,42,0.10);border:1px solid rgba(15,23,42,0.08);`);
      wrap.appendChild(clone);
      mark(clone, 'image');
    });
  }
  // 若原 p 既有图又有文字，作为 paragraph 保留定位
  if (el.tagName.toLowerCase() === 'p') {
    const txt = (el.textContent || '').trim();
    if (txt) mark(wrap, 'paragraph');
  }
  return wrap;
}

function buildTable(c: LayoutConfig, table: Element, mark: (e: Element, t: ElementType) => void): Element {
  const clone = table.cloneNode(true) as HTMLElement;
  clone.setAttribute('style', `width:100%;border-collapse:collapse;font-size:13px;margin:20px 0;`);
  clone.querySelectorAll('th').forEach(th => th.setAttribute('style', c.components.tableTh));
  clone.querySelectorAll('td').forEach(td => td.setAttribute('style', c.components.tableTd));
  // 每个 tr 盖 table 索引（与 flat indexer 粒度一致）
  clone.querySelectorAll('tr').forEach(tr => mark(tr, 'table'));
  return clone;
}

function buildFooterCta(doc: Document, c: LayoutConfig): Element {
  const { colors, components } = c;
  const card = doc.createElement('section');
  card.setAttribute('style', components.footerCta);

  const lead = doc.createElement('p');
  lead.setAttribute('style', `font-size:13px;font-weight:600;color:${colors.text};margin:0 0 18px;line-height:1.6;text-align:center;`);
  lead.appendChild(makeLeafText(doc, '读到这里，如果觉得有用，随手点个赞、转发给需要的朋友吧。'));
  card.appendChild(lead);

  const row = doc.createElement('section');
  row.setAttribute('style', 'display:flex;justify-content:center;gap:32px;margin-bottom:14px;');
  const actions = [
    { name: '关注', svg: '<path d="M12 5v14"></path><path d="M5 12h14"></path>', color: colors.ink, highlight: true },
    { name: '点赞', svg: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>', color: colors.text, highlight: false },
    { name: '转发', svg: '<path d="M4 18v-4a8 8 0 0 1 8-8h8"></path><polyline points="16 2 20 6 16 10"></polyline>', color: colors.text, highlight: false },
  ];
  for (const a of actions) {
    const cell = doc.createElement('section');
    cell.setAttribute('style', 'text-align:center;');
    const box = doc.createElement('section');
    box.setAttribute('style', `width:40px;height:40px;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;background:${a.highlight ? colors.paperDeep : '#fff'};border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.05);border:1px solid ${a.highlight ? colors.inkLight : colors.rule};`);
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20'); svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', a.color); svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = a.svg;
    box.appendChild(svg);
    cell.appendChild(box);
    const cap = doc.createElement('span');
    cap.setAttribute('style', 'font-size:10px;font-weight:600;');
    cap.appendChild(makeLeafText(doc, a.name));
    cell.appendChild(cap);
    row.appendChild(cell);
  }
  card.appendChild(row);

  const tail = doc.createElement('p');
  tail.setAttribute('style', `font-size:10px;color:${colors.textSoft};letter-spacing:1px;margin:0;text-align:center;`);
  tail.appendChild(makeLeafText(doc, 'THANKS FOR READING'));
  card.appendChild(tail);

  return card;
}

// ============ 行内样式注入 ============

function transformInline(root: Element, c: LayoutConfig): void {
  const { inline } = c;
  root.querySelectorAll('strong').forEach(s => {
    s.setAttribute('style', mergeStyle(s.getAttribute('style'), inline.bold));
  });
  root.querySelectorAll('code').forEach(code => {
    if (code.closest('pre')) return; // pre 内 hljs token 不动
    code.setAttribute('style', mergeStyle(code.getAttribute('style'), inline.code));
  });
  root.querySelectorAll('a').forEach(a => {
    // 跳过 TOC 导读卡片（带 href="#ch-N" 的装饰卡，不是正文文字链接）
    if ((a.getAttribute('href') || '').startsWith('#ch-')) return;
    a.setAttribute('style', mergeStyle(a.getAttribute('style'), inline.link));
  });
  // ==高亮== / <mark>
  root.querySelectorAll('mark').forEach(m => {
    m.setAttribute('style', mergeStyle(m.getAttribute('style'), inline.highlight));
  });
}

function mergeStyle(existing: string | null, extra: string): string {
  return `${existing || ''}; ${extra}`.replace(/^;\s*/, '').trim();
}
