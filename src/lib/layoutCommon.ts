/**
 * 特殊排版通用基础库与共享组件
 *
 * 统一管理所有特殊排版主题（松烟手札 / 卡册 / 专栏 等）的公共基础设施：
 * 1. DOM 占位与文本叶子节点创建（微信公众号排版规范）
 * 2. 统一 AST 角色分类器（标题/引言/多图/表格/代码等）
 * 3. 统一多图朋友圈式网格生成器（.image-grid 与 calc 弹性宽度）
 * 4. 统一底部三连互动卡片（关注 / 点赞 / 转发，居中垂直卡片）
 * 5. 统一数据表格与行内强调样式注入
 * 6. 统一结语章节智能识别（总结/后记 -> ∞ / END）
 */

import type { LayoutConfig } from './themes/types';
import type { ElementType } from './indexerRules';

/** 创建带 leaf 包裹的文本 span（防止微信剥离结构化文案） */
export function makeLeafText(doc: Document, text: string): HTMLElement {
  const span = doc.createElement('span');
  span.setAttribute('leaf', '');
  span.textContent = text;
  return span;
}

/** 创建带 leaf 包裹 + 显式内联样式的文本 span（防止复制后微信丢字号/颜色） */
export function makeStyledLeaf(doc: Document, text: string, style: string): HTMLElement {
  const span = doc.createElement('span');
  span.setAttribute('leaf', '');
  span.setAttribute('style', style);
  span.textContent = text;
  return span;
}

/** 装饰空元素占位：<span leaf=""><br></span>（防微信剥空容器样式） */
export function leafBr(doc: Document): HTMLElement {
  const span = doc.createElement('span');
  span.setAttribute('leaf', '');
  span.appendChild(doc.createElement('br'));
  return span;
}

/** 安全合并多个 CSS 样式串 */
export function mergeStyle(existing: string | null, extra: string): string {
  return `${existing || ''}; ${extra}`.replace(/^;\s*/, '').trim();
}

/** 判断章节是否为结语类（末章自动识别为 ∞ / END） */
export function isConclusionTitle(text: string): boolean {
  return /(总结|结语|结尾|结束|结论|写在最后|后记|POSTSCRIPT|EPILOGUE|THE END)/i.test(text);
}

export type Role =
  | 'cover' | 'preamble' | 'chapter' | 'subtitle' | 'paragraph'
  | 'quote' | 'unordered-list' | 'ordered-list' | 'code'
  | 'divider' | 'image' | 'table' | 'passthrough';

export interface RoleItem {
  el: Element;
  role: Role;
}

/**
 * 通用 AST 角色分类器
 * 从 markdown-it 生成的顶级子节点中，精准分类封面 H1、章节 H2、小标题 H3、首引言、段落、多图等
 */
export function classifyRoleItems(doc: Document): { items: RoleItem[]; h1El: Element | null; chapterItems: RoleItem[] } {
  const sourceChildren = Array.from(doc.body.children);
  const items: RoleItem[] = [];
  let h1El: Element | null = null;

  for (const el of sourceChildren) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'h1' && !h1El) {
      h1El = el;
      items.push({ el, role: 'cover' });
    } else if (tag === 'h2') {
      items.push({ el, role: 'chapter' });
    } else if (tag === 'h3') {
      items.push({ el, role: 'subtitle' });
    } else if (tag === 'p') {
      const imgs = el.querySelectorAll('img');
      const text = (el.textContent || '').trim();
      if (imgs.length >= 1 && text === '') {
        items.push({ el, role: 'image' });
      } else {
        items.push({ el, role: 'paragraph' });
      }
    } else if (tag === 'blockquote') {
      items.push({ el, role: 'quote' });
    } else if (tag === 'ul') {
      items.push({ el, role: 'unordered-list' });
    } else if (tag === 'ol') {
      items.push({ el, role: 'ordered-list' });
    } else if (tag === 'pre') {
      items.push({ el, role: 'code' });
    } else if (tag === 'hr') {
      items.push({ el, role: 'divider' });
    } else if (tag === 'img') {
      items.push({ el, role: 'image' });
    } else if (tag === 'table') {
      items.push({ el, role: 'table' });
    } else {
      items.push({ el, role: 'passthrough' });
    }
  }

  // 首个 blockquote（在首个 h2 之前）自动识别为开篇引言导读卡
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

  return { items, h1El, chapterItems };
}

/**
 * 通用图片生成器
 * 支持单图优雅阴影呈现与多图朋友圈式网格（.image-grid + 弹性百分比宽度）
 */
export function buildCommonImage(
  doc: Document,
  c: LayoutConfig,
  el: Element,
  mark: (e: Element, t: ElementType) => void
): Element {
  const imgs = el.tagName.toLowerCase() === 'img' ? [el as HTMLImageElement] : Array.from(el.querySelectorAll('img'));
  const wrap = doc.createElement('section');

  if (imgs.length > 1) {
    wrap.classList.add('image-grid');
    wrap.setAttribute('style', c.components.imageGrid || 'display:flex;justify-content:center;gap:8px;align-items:flex-start;margin:24px auto;');
    const w = 100 / imgs.length;
    imgs.forEach(img => {
      const clone = img.cloneNode(true) as HTMLImageElement;
      clone.setAttribute('style', `width:calc(${w}% - ${8 * (imgs.length - 1) / imgs.length}px);margin:0;border-radius:8px;height:auto;display:block;`);
      wrap.appendChild(clone);
      mark(clone, 'image');
    });
  } else {
    wrap.setAttribute('style', c.components.image || 'text-align:center;margin:24px auto;');
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

/**
 * 通用数据表格生成器
 */
export function buildCommonTable(
  c: LayoutConfig,
  table: Element,
  mark: (e: Element, t: ElementType) => void
): Element {
  const clone = table.cloneNode(true) as HTMLElement;
  clone.setAttribute('style', 'width:100%;border-collapse:collapse;font-size:13px;margin:20px 0;');
  clone.querySelectorAll('th').forEach(th => th.setAttribute('style', c.components.tableTh));
  clone.querySelectorAll('td').forEach(td => td.setAttribute('style', c.components.tableTd));
  clone.querySelectorAll('tr').forEach(tr => mark(tr, 'table'));
  return clone;
}

/**
 * 通用底部三连互动卡片（关注 / 点赞 / 转发）
 * 结构：居中文案在上方，三连大图标居中排列在下方，完美兼容公众号各尺寸屏幕
 */
export function buildCommonFooterCta(doc: Document, c: LayoutConfig): Element {
  const { colors: co } = c;
  const card = doc.createElement('section');
  const cardStyle = `margin:40px auto 16px;background-color:${co.paperDeep};border:1px solid ${co.rule};border-radius:16px;padding:24px 20px 20px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,0.03);max-width:100%;box-sizing:border-box;display:block;`;
  card.setAttribute('style', cardStyle);

  const lead = doc.createElement('p');
  lead.setAttribute('style', `font-size:13.5px;font-weight:600;color:${co.text};margin:0 0 18px;line-height:1.6;text-align:center;`);
  lead.appendChild(makeStyledLeaf(doc, '读到这里，如果觉得有用，随手点个赞、转发给需要的朋友吧。', `font-size:13.5px;font-weight:600;color:${co.text};`));
  card.appendChild(lead);

  const row = doc.createElement('section');
  row.setAttribute('style', 'display:flex;justify-content:center;align-items:center;gap:32px;margin:0 auto;');
  const actions = [
    { name: '关注', svg: '<path d="M12 5v14"></path><path d="M5 12h14"></path>', color: '#ffffff', bg: co.ink, border: co.inkLight },
    { name: '点赞', svg: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>', color: co.text, bg: '#ffffff', border: co.rule },
    { name: '转发', svg: '<path d="M4 18v-4a8 8 0 0 1 8-8h8"></path><polyline points="16 2 20 6 16 10"></polyline>', color: co.text, bg: '#ffffff', border: co.rule },
  ];

  for (const a of actions) {
    const cell = doc.createElement('section');
    cell.setAttribute('style', 'text-align:center;');
    const box = doc.createElement('section');
    box.setAttribute('style', `width:42px;height:42px;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;background:${a.bg};border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.06);border:1px solid ${a.border};`);

    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', a.color);
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = a.svg;

    box.appendChild(svg);
    cell.appendChild(box);

    const cap = doc.createElement('span');
    cap.setAttribute('style', `font-size:10.5px;font-weight:600;color:${a.color === '#ffffff' ? co.ink : co.textSoft};display:block;margin-top:2px;`);
    cap.appendChild(makeLeafText(doc, a.name));
    cell.appendChild(cap);

    row.appendChild(cell);
  }

  card.appendChild(row);
  return card;
}

/**
 * 通用行内强调样式注入（粗体、行内代码、链接、高亮）
 */
export function transformCommonInlines(root: Element, c: LayoutConfig): void {
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
