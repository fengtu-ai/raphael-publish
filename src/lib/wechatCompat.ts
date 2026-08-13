import { THEMES } from './themes';
import { stripIndexMarkers } from './markdownIndexer';

/**
 * Remove internal editor attributes from HTML
 * Used when exporting to avoid including internal implementation details
 *
 * This is now a thin wrapper around stripIndexMarkers from the indexing layer.
 * Keeping this function for backward compatibility.
 */
export function cleanInternalAttributes(html: string): string {
    return stripIndexMarkers(html);
}

// Helper to convert images to Base64
async function getBase64Image(imgUrl: string): Promise<string> {
    if (imgUrl.startsWith('data:')) return imgUrl;

    const response = await fetch(imgUrl, { mode: 'cors', cache: 'default' });
    if (!response.ok) {
        throw new Error(`图片下载失败（HTTP ${response.status}）：${imgUrl}`);
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(`图片转换失败：${imgUrl}`));
        reader.readAsDataURL(blob);
    });
}

export async function makeWeChatCompatible(html: string, themeId: string): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    const containerStyle = theme.kind === 'layout'
        ? (theme.layout.components.container || '')
        : (theme.styles.container || '');
    const isLayoutTheme = theme.kind === 'layout';

    // 0. Remove internal editor attributes (for click-to-locate feature)
    // These are only used in the editor and should not appear in the final HTML
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
        el.removeAttribute('data-md-type');
        el.removeAttribute('data-md-index');
    });

    // Note: We manually remove attributes here before DOM manipulation
    // The stripIndexMarkers() function is also available for HTML string operations

    // 1. WeChat prefers <section> as the root wrapper for overall styling
    // If the root is a div, let's wrap or convert it to a section.
    const rootNodes = Array.from(doc.body.children);

    // Create new wrap section
    const section = doc.createElement('section');
    // 公众号正文区自带宽度限制；容器若再带 max-width 会被双重收窄。
    // padding 统一改成 8px（保留少量内边距，避免内容贴边，又不过度收窄正文）。
    const cleanContainerStyle = containerStyle
        .replace(/max-width\s*:\s*[^;]+;?/gi, '')
        .replace(/padding\s*:\s*[^;]+;?/gi, '')
        + ' padding:12px;';
    section.setAttribute('style', cleanContainerStyle);

    rootNodes.forEach(node => {
        // applyTheme(flat) 产出 <div style=container>，applyLayout 产出 <section style=container>。
        // 两者都是单层容器根，unwrap 其子节点搬到新 section，避免双层容器叠加 padding/max-width。
        if ((node.tagName === 'DIV' || node.tagName === 'SECTION') && rootNodes.length === 1) {
            Array.from(node.childNodes).forEach(child => section.appendChild(child));
        } else {
            section.appendChild(node);
        }
    });

    // 2. WeChat ignores flex in many scenarios. Convert image flex wrappers to table layout.
    // layout 主题的多图网格是 <section class="image-grid">，flat 是 <p class="image-grid">，
    // 都要覆盖，否则多图复制到公众号会塌成一列。
    const flexLikeNodes = section.querySelectorAll('div, p.image-grid, section.image-grid');
    flexLikeNodes.forEach(node => {
        // Keep code block internals untouched.
        if (node.closest('pre, code')) return;

        const style = node.getAttribute('style') || '';
        const isFlexNode = style.includes('display: flex') || style.includes('display:flex');
        const isImageGrid = node.classList.contains('image-grid');
        if (!isFlexNode && !isImageGrid) return;

        const flexChildren = Array.from(node.children);
        if (flexChildren.every(child => child.tagName === 'IMG' || child.querySelector('img'))) {
            const table = doc.createElement('table');
            table.setAttribute('style', 'width: 100%; border-collapse: collapse; margin: 16px 0; border: none !important;');
            const tbody = doc.createElement('tbody');
            const tr = doc.createElement('tr');
            tr.setAttribute('style', 'border: none !important; background: transparent !important;');

            flexChildren.forEach(child => {
                const td = doc.createElement('td');
                td.setAttribute('style', 'padding: 0 4px; vertical-align: top; border: none !important; background: transparent !important;');
                td.appendChild(child);
                // Update child width to 100% since it's now bound by TD
                const nestedImages = child.tagName === 'IMG'
                    ? [child as HTMLImageElement]
                    : Array.from(child.querySelectorAll('img'));
                nestedImages.forEach(img => {
                    const currentStyle = img.getAttribute('style') || '';
                    img.setAttribute(
                        'style',
                        currentStyle.replace(/width:\s*[^;]+;?/g, '')
                        + ' width: 100% !important; max-width: 100% !important; height: auto !important; display: block; margin: 0 auto !important;'
                    );
                    img.setAttribute('width', '100%');
                });
                if (child.tagName === 'A') {
                    const currentStyle = child.getAttribute('style') || '';
                    child.setAttribute('style', `${currentStyle}; display: block; width: 100%;`);
                }
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
            table.appendChild(tbody);
            node.parentNode?.replaceChild(table, node);
        } else if (isFlexNode) {
            // Non-image flex items just get stripped of flex.
            node.setAttribute('style', style.replace(/display:\s*flex;?/g, 'display: block;'));
        }
    });

    // 3. Replace pre/code blocks with table-based cards. WeChat strips nested
    // decorations from <pre>, while legacy table attributes and inline styles
    // are preserved more reliably.
    const codeBlocks = Array.from(section.querySelectorAll('pre'));
    codeBlocks.forEach(pre => {
        const code = pre.querySelector('code');
        if (!code) return;

        const card = doc.createElement('table');
        const preStyleFallback = isLayoutTheme ? '' : (theme.styles.pre || '');
        const preStyle = pre.getAttribute('style') || preStyleFallback;
        const backgroundColor = preStyle.match(/background-color:\s*([^;!]+)/i)?.[1]?.trim() || '#f5f5f7';
        const margin = preStyle.match(/margin:\s*([^;]+)/i)?.[1]?.trim() || '24px 0';
        const borderRadius = preStyle.match(/border-radius:\s*([^;]+)/i)?.[1]?.trim() || '8px';
        const border = preStyle.match(/border(?:-(?!radius)[a-z-]+)?\s*:\s*([^;]+)/i)?.[1]?.trim();

        card.setAttribute('data-wechat-code-card', 'true');
        card.setAttribute('width', '100%');
        card.setAttribute('cellpadding', '0');
        card.setAttribute('cellspacing', '0');
        card.setAttribute('bgcolor', backgroundColor);
        card.setAttribute(
            'style',
            `width: 100% !important; display: table; table-layout: fixed; box-sizing: border-box; border-collapse: separate; border-spacing: 0; margin: ${margin}; border: 0; background: ${backgroundColor} !important; background-color: ${backgroundColor} !important; border-radius: ${borderRadius}; overflow: hidden;`
        );

        const tbody = doc.createElement('tbody');
        const shellRow = doc.createElement('tr');
        const shell = doc.createElement('td');
        shell.setAttribute('bgcolor', backgroundColor);
        shell.setAttribute(
            'style',
            `padding: 20px; margin: 0; ${border ? `border: ${border};` : 'border: 0;'} background: ${backgroundColor} !important; background-color: ${backgroundColor} !important; border-radius: ${borderRadius}; vertical-align: top;`
        );

        const toolbar = doc.createElement('p');
        toolbar.setAttribute('style', 'display: block; padding: 0; margin: 0 0 12px 0 !important; border: 0; background: transparent; line-height: 16px !important; white-space: nowrap;');
        [
            ['#ff5f56', '●'],
            ['#ffbd2e', '●'],
            ['#27c93f', '●'],
        ].forEach(([color, character]) => {
            const dot = doc.createElement('span');
            dot.setAttribute(
                'style',
                `display: inline; margin-right: 6px; color: ${color} !important; font-size: 18px; line-height: 16px; font-family: Arial, sans-serif;`
            );
            dot.textContent = `${character}\u00a0`;
            toolbar.appendChild(dot);
        });

        const innerTable = doc.createElement('table');
        const innerBody = doc.createElement('tbody');
        const innerRow = doc.createElement('tr');
        const codeSurface = doc.createElement('td');
        const codeStyleFallback = isLayoutTheme ? '' : (theme.styles.code || '');
        const codeStyle = code.getAttribute('style') || codeStyleFallback;
        const codeBackgroundColor = codeStyle.match(/background-color:\s*([^;!]+)/i)?.[1]?.trim() || '#ffffff';

        innerTable.setAttribute('width', '100%');
        innerTable.setAttribute('cellpadding', '0');
        innerTable.setAttribute('cellspacing', '0');
        innerTable.setAttribute('bgcolor', codeBackgroundColor);
        innerTable.setAttribute(
            'style',
            `display: table; width: 100% !important; table-layout: fixed; border-collapse: separate; border-spacing: 0; border: 0; background: ${codeBackgroundColor} !important; background-color: ${codeBackgroundColor} !important;`
        );
        codeSurface.setAttribute('bgcolor', codeBackgroundColor);
        codeSurface.setAttribute(
            'style',
            `${codeStyle}; display: table-cell; box-sizing: border-box; width: 100%; min-height: 40px; padding: 12px 14px; margin: 0; border: 0; background: ${codeBackgroundColor} !important; background-color: ${codeBackgroundColor} !important; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; font-style: normal; text-align: left; vertical-align: top;`
        );

        // Explicit <br> and non-breaking spaces survive WeChat's whitespace
        // normalization better than relying only on CSS white-space.
        const codeClone = code.cloneNode(true) as HTMLElement;
        const walker = doc.createTreeWalker(codeClone, NodeFilter.SHOW_TEXT);
        const textNodes: Text[] = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
        textNodes.forEach(textNode => {
            const fragment = doc.createDocumentFragment();
            const lines = (textNode.nodeValue || '').replace(/\t/g, '    ').split('\n');
            lines.forEach((line, index) => {
                if (index > 0) fragment.appendChild(doc.createElement('br'));
                if (line) fragment.appendChild(doc.createTextNode(line.replace(/ /g, '\u00a0')));
            });
            textNode.parentNode?.replaceChild(fragment, textNode);
        });
        Array.from(codeClone.childNodes).forEach(child => codeSurface.appendChild(child));
        innerRow.appendChild(codeSurface);
        innerBody.appendChild(innerRow);
        innerTable.appendChild(innerBody);
        shell.appendChild(toolbar);
        shell.appendChild(innerTable);
        shellRow.appendChild(shell);
        tbody.appendChild(shellRow);
        card.appendChild(tbody);
        pre.replaceWith(card);
    });

    // 4. List Item Flattening
    // WeChat notoriously misrenders heavily nested <li> formatting, flattening the inner structure helps
    const listItems = section.querySelectorAll('li');
    listItems.forEach(li => {
        const hasBlockChildren = Array.from(li.children).some(child =>
            ['P', 'DIV', 'UL', 'OL', 'BLOCKQUOTE'].includes(child.tagName)
        );
        if (hasBlockChildren) {
            // We only want to clean inner tags if it's overly complex, 
            // but flattening everything might kill <strong> or <em>.
            // Let's just strip 'p' inside 'li' by replacing <p> with <span>
            const ps = li.querySelectorAll('p');
            ps.forEach(p => {
                const span = doc.createElement('span');
                span.innerHTML = p.innerHTML;
                const pStyle = p.getAttribute('style');
                span.setAttribute('style', `${pStyle || ''}; display: block;`);
                p.parentNode?.replaceChild(span, p);
            });
        }
    });

    // 5. Force Inheritance
    // WeChat's editor aggressively overrides inherited fonts on <p>, <li>, etc.
    // So we manually distribute the container's font properties to all individual blocks.
    const fontMatch = containerStyle.match(/font-family:\s*([^;]+);/);
    const sizeMatch = containerStyle.match(/font-size:\s*([^;]+);/);
    const colorMatch = containerStyle.match(/color:\s*([^;]+);/);
    const lineHeightMatch = containerStyle.match(/line-height:\s*([^;]+);/);

    // We only enforce on specific text tags that WeChat likes to hijack
    const textNodes = section.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, span');
    textNodes.forEach(node => {
        // Preserve code highlighting tokens inside code blocks/cards.
        if (node.tagName === 'SPAN' && node.closest('pre, code, [data-wechat-code-card]')) return;

        let currentStyle = node.getAttribute('style') || '';

        if (fontMatch && !currentStyle.includes('font-family:')) {
            currentStyle += ` font-family: ${fontMatch[1]};`;
        }
        if (lineHeightMatch && !currentStyle.includes('line-height:')) {
            currentStyle += ` line-height: ${lineHeightMatch[1]};`;
        }
        // Add font-size if not present (only for block text nodes so we don't shrink headings).
        // 不给 <span> 注入 font-size —— layout 标题/编号等装饰块的文字用 <span leaf> 包裹
        // 且无显式字号，靠继承父 <p> 的大字号；若给 span 注入容器正文字号，会覆盖继承的标题大字。
        if (sizeMatch && !currentStyle.includes('font-size:') && ['P', 'LI', 'BLOCKQUOTE'].includes(node.tagName)) {
            currentStyle += ` font-size: ${sizeMatch[1]};`;
        }
        // color 只分发给块级元素（p/li/h/blockquote）。
        // 不给 <span> 注入容器 color —— layout 的白字装饰块（章节编号/TOC 首卡/底栏）
        // 内的 <span leaf> 无显式 color，靠继承父 <p style="color:#fff"> 的白色；
        // 若给 span 注入容器深色 color，会覆盖继承的白字 → 白字变黑。
        if (colorMatch && !currentStyle.includes('color:') && ['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(node.tagName)) {
            currentStyle += ` color: ${colorMatch[1]};`;
        }

        node.setAttribute('style', currentStyle.trim());
    });

    // Keep CJK punctuation attached to preceding inline emphasis in WeChat.
    // Example: <strong>标题</strong>：说明 -> <strong>标题：</strong>说明
    const inlineNodes = section.querySelectorAll('strong, b, em, span, a, code');
    inlineNodes.forEach(node => {
        if (node.closest('[data-wechat-code-card]')) return;
        const next = node.nextSibling;
        if (!next || next.nodeType !== Node.TEXT_NODE) return;
        const text = next.textContent || '';
        const match = text.match(/^\s*([：；，。！？、:])(.*)$/s);
        if (!match) return;

        const punct = match[1];
        const rest = match[2] || '';
        node.appendChild(doc.createTextNode(punct));
        if (rest) {
            next.textContent = rest;
        } else {
            next.parentNode?.removeChild(next);
        }
    });

    // 6. Harden standard tables. WeChat may drop modern table CSS but usually
    // preserves legacy width/cellspacing/cellpadding attributes.
    section.querySelectorAll('table').forEach(table => {
        table.setAttribute('width', '100%');
        table.setAttribute('cellspacing', '0');
        table.setAttribute('cellpadding', '0');
        const currentStyle = table.getAttribute('style') || '';
        const isCodeTable = Boolean(table.closest('[data-wechat-code-card]'));
        const collapseStyle = isCodeTable
            ? 'border-collapse: separate; border-spacing: 0;'
            : 'border-collapse: collapse;';
        table.setAttribute('style', `${currentStyle}; width: 100% !important; ${collapseStyle} table-layout: fixed;`);
    });
    section.querySelectorAll('th, td').forEach(cell => {
        const currentStyle = cell.getAttribute('style') || '';
        cell.setAttribute('style', `${currentStyle}; box-sizing: border-box; word-break: break-word; overflow-wrap: break-word;`);
    });

    // Gradient rules are inconsistently sanitized by WeChat. Keep layout and
    // use the first declared color as a deterministic fallback.
    section.querySelectorAll('hr').forEach(hr => {
        let currentStyle = hr.getAttribute('style') || '';
        if (/linear-gradient/i.test(currentStyle)) {
            const fallbackColor = currentStyle.match(/#[0-9a-fA-F]{3,8}/)?.[0] || '#d8d8d8';
            currentStyle = currentStyle.replace(/background(?:-image)?\s*:\s*linear-gradient\([^;]+\)\s*!important;?/gi, '');
            currentStyle += ` background: ${fallbackColor} !important; background-color: ${fallbackColor} !important;`;
        }
        hr.setAttribute('style', `${currentStyle}; display: block; border: 0;`);
    });

    // 7. Convert all images to Base64 for safe WeChat pasting.
    const imgs = Array.from(section.querySelectorAll('img'));
    await Promise.all(imgs.map(async img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('data:')) {
            const base64 = await getBase64Image(src);
            img.setAttribute('src', base64);
        }
        img.setAttribute('border', '0');
        img.setAttribute('draggable', 'false');
        const currentStyle = img.getAttribute('style') || '';
        img.setAttribute('style', `${currentStyle}; max-width: 100% !important; height: auto !important;`);
    }));

    section.querySelectorAll('[data-wechat-code-card]').forEach(node => {
        node.removeAttribute('data-wechat-code-card');
    });

    doc.body.innerHTML = '';
    doc.body.appendChild(section);

    // Prevent WeChat from breaking lines between inline emphasis and leading CJK punctuation.
    // Example: </strong>： should stay on the same line.
    let outputHtml = doc.body.innerHTML;
    outputHtml = outputHtml.replace(/(<\/(?:strong|b|em|span|a|code)>)\s*([：；，。！？、])/g, '$1\u2060$2');

    return outputHtml;
}
