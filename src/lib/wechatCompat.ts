import { THEMES } from './themes';
import { stripIndexMarkers } from './markdownIndexer';
import { getCodeTheme } from './codeThemes';

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

export async function makeWeChatCompatible(html: string, themeId: string, codeThemeId?: string): Promise<string> {
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

    // 1. Unwrap outer theme container if present and move styles to a root section
    const bodyChildren = Array.from(doc.body.children);
    let section: HTMLElement;

    if (bodyChildren.length === 1 && (bodyChildren[0].tagName === 'DIV' || bodyChildren[0].tagName === 'SECTION')) {
        section = doc.createElement('section');
        const container = bodyChildren[0] as HTMLElement;
        const explicitContainerStyle = isLayoutTheme
            ? containerStyle
            : (container.getAttribute('style') || containerStyle);
        const normalizedContainerStyle = explicitContainerStyle
            .replace(/max-width:\s*[^;]+;?/gi, '')
            .replace(/padding:\s*[^;]+;?/gi, '')
            .replace(/margin:\s*[^;]+;?/gi, '')
            .trim();
        section.setAttribute('style', `padding: 0 12px; margin: 0 auto; ${normalizedContainerStyle}`);
        while (container.firstChild) {
            section.appendChild(container.firstChild);
        }
        doc.body.replaceChild(section, container);
    } else {
        section = doc.createElement('section');
        const normalizedContainerStyle = containerStyle
            .replace(/max-width:\s*[^;]+;?/gi, '')
            .replace(/padding:\s*[^;]+;?/gi, '')
            .replace(/margin:\s*[^;]+;?/gi, '')
            .trim();
        section.setAttribute('style', `padding: 0 12px; margin: 0 auto; ${normalizedContainerStyle}`);
        while (doc.body.firstChild) {
            section.appendChild(doc.body.firstChild);
        }
        doc.body.appendChild(section);
    }

    // 2. Multi-image Flex Row -> HTML Table
    // WeChat's rich text parser completely strips CSS flexbox styles (display:flex,
    // flex-direction, gap, justify-content, etc.). To reliably render side-by-side
    // images in WeChat, convert any flex container whose direct children are images
    // into a table layout with equal-width columns.
    const flexLikeNodes = section.querySelectorAll('div, p.image-grid, section.image-grid');
    flexLikeNodes.forEach(node => {
        const style = node.getAttribute('style') || '';
        const isFlexClass = node.classList.contains('image-grid');
        const isFlexNode = /display:\s*flex/i.test(style) || isFlexClass;

        if (!isFlexNode) return;

        const flexChildren = Array.from(node.children);
        if (flexChildren.length > 1) {
            const isAllImages = flexChildren.every(child =>
                child.tagName === 'IMG' ||
                (child.tagName === 'A' && child.children.length === 1 && child.children[0].tagName === 'IMG')
            );
            if (isAllImages) {
                const table = doc.createElement('table');
                table.setAttribute('width', '100%');
                table.setAttribute('cellpadding', '0');
                table.setAttribute('cellspacing', '0');
                table.setAttribute('style', 'display: table; width: 100% !important; table-layout: fixed; border-collapse: separate; border-spacing: 8px 0; margin: 24px 0; border: 0;');

                const tbody = doc.createElement('tbody');
                const tr = doc.createElement('tr');
                const colWidth = Math.floor(100 / flexChildren.length);

                flexChildren.forEach(child => {
                    const td = doc.createElement('td');
                    td.setAttribute('width', `${colWidth}%`);
                    td.setAttribute('valign', 'top');
                    td.setAttribute('style', `width: ${colWidth}%; padding: 0; margin: 0; vertical-align: top; border: 0;`);

                    const imgs = child.tagName === 'IMG'
                        ? [child as HTMLImageElement]
                        : Array.from(child.querySelectorAll('img'));

                    imgs.forEach(img => {
                        const currentStyle = img.getAttribute('style') || '';
                        img.setAttribute('style', `${currentStyle}; display: block; width: 100% !important; max-width: 100% !important; height: auto !important; margin: 0 !important;`);
                    });

                    td.appendChild(child);
                    tr.appendChild(td);
                });

                tbody.appendChild(tr);
                table.appendChild(tbody);
                node.parentNode?.replaceChild(table, node);
            } else if (isFlexNode) {
                // Non-image flex items just get stripped of flex.
                node.setAttribute('style', style.replace(/display:\s*flex;?/g, 'display: block;'));
            }
        }
    });

    // 3. Replace pre/code blocks with table-based cards. WeChat strips nested
    // decorations from <pre>, while legacy table attributes and inline styles
    // are preserved more reliably.
    const codeTheme = getCodeTheme(codeThemeId);
    const codeBlocks = Array.from(section.querySelectorAll('pre'));
    codeBlocks.forEach(pre => {
        const code = pre.querySelector('code');
        if (!code) return;

        const card = doc.createElement('table');
        const preStyle = pre.getAttribute('style') || '';
        const backgroundColor = preStyle.match(/background-color:\s*([^;!]+)/i)?.[1]?.trim() || codeTheme.background;
        const codeStyle = code.getAttribute('style') || '';
        const codeBackgroundColor = codeStyle.match(/background-color:\s*([^;!]+)/i)?.[1]?.trim() || codeTheme.codeBackground;
        const margin = preStyle.match(/margin:\s*([^;]+)/i)?.[1]?.trim() || '22px 0';
        const borderRadius = preStyle.match(/border-radius:\s*([^;]+)/i)?.[1]?.trim() || codeTheme.borderRadius || '8px';
        const border = preStyle.match(/border(?:-(?!radius)[a-z-]+)?\s*:\s*([^;]+)/i)?.[1]?.trim() || (codeTheme.borderColor ? `1px solid ${codeTheme.borderColor}` : undefined);
        const borderLeft = preStyle.match(/border-left\s*:\s*([^;]+)/i)?.[1]?.trim() || (codeTheme.headerStyle === 'accent-line' && codeTheme.accentColor ? `4px solid ${codeTheme.accentColor}` : undefined);

        card.setAttribute('data-wechat-code-card', 'true');
        card.setAttribute('width', '100%');
        card.setAttribute('cellpadding', '0');
        card.setAttribute('cellspacing', '0');
        card.setAttribute('bgcolor', backgroundColor);
        card.setAttribute(
            'style',
            `width: 100% !important; display: table; table-layout: fixed; box-sizing: border-box; border-collapse: separate; border-spacing: 0; margin: ${margin}; ${border ? `border: ${border};` : 'border: 0;'} ${borderLeft ? `border-left: ${borderLeft} !important;` : ''} background: ${backgroundColor} !important; background-color: ${backgroundColor} !important; border-radius: ${borderRadius}; overflow: hidden;`
        );

        const isDualLayer = backgroundColor !== codeBackgroundColor;
        const shellPadding = isDualLayer
            ? '16px 18px 18px'
            : (codeTheme.headerStyle === 'accent-line' ? '20px 22px 20px 24px' : '20px 24px');
        const codePadding = isDualLayer ? '14px 16px' : '0';
        const codeRadius = isDualLayer ? 'border-radius: 6px;' : '';

        const tbody = doc.createElement('tbody');
        const shellRow = doc.createElement('tr');
        const shell = doc.createElement('td');
        shell.setAttribute('bgcolor', backgroundColor);
        shell.setAttribute(
            'style',
            `padding: ${shellPadding}; margin: 0; ${border ? `border: ${border};` : 'border: 0;'} ${borderLeft ? `border-left: ${borderLeft} !important;` : ''} background: ${backgroundColor} !important; background-color: ${backgroundColor} !important; border-radius: ${borderRadius}; vertical-align: top;`
        );

        if (codeTheme.headerStyle === 'mac-dots') {
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
                    `display: inline; margin-right: 6px; color: ${color} !important; font-size: 16px; line-height: 16px; font-family: Arial, sans-serif;`
                );
                dot.textContent = `${character}\u00a0`;
                toolbar.appendChild(dot);
            });
            shell.appendChild(toolbar);
        } else if (codeTheme.headerStyle === 'monochrome-dots') {
            const toolbar = doc.createElement('p');
            toolbar.setAttribute('style', 'display: block; padding: 0; margin: 0 0 12px 0 !important; border: 0; background: transparent; line-height: 14px !important; white-space: nowrap;');
            [
                ['#6272a4', '●'],
                ['#6272a4', '●'],
                ['#6272a4', '●'],
            ].forEach(([color, character]) => {
                const dot = doc.createElement('span');
                dot.setAttribute(
                    'style',
                    `display: inline; margin-right: 6px; color: ${color} !important; opacity: 0.6; font-size: 13px; line-height: 14px; font-family: Arial, sans-serif;`
                );
                dot.textContent = `${character}\u00a0`;
                toolbar.appendChild(dot);
            });
            shell.appendChild(toolbar);
        } else if (codeTheme.headerStyle === 'terminal') {
            const toolbar = doc.createElement('p');
            toolbar.setAttribute('style', `display: block; padding: 0; margin: 0 0 10px 0 !important; border: 0; background: transparent; font-size: 11px; font-weight: 700; font-family: 'SF Mono', Consolas, monospace; color: ${codeTheme.accentColor || '#10b981'} !important; line-height: 14px !important; white-space: nowrap;`);
            toolbar.textContent = '>_ terminal';
            shell.appendChild(toolbar);
        }

        const innerTable = doc.createElement('table');
        const innerBody = doc.createElement('tbody');
        const innerRow = doc.createElement('tr');
        const codeSurface = doc.createElement('td');

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
            `${codeStyle}; display: table-cell; box-sizing: border-box; width: 100%; min-height: 40px; padding: ${codePadding}; ${codeRadius} margin: 0; border: 0; background: ${codeBackgroundColor} !important; background-color: ${codeBackgroundColor} !important; color: ${codeTheme.textColor} !important; font-size: 13px !important; line-height: 1.75 !important; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; font-style: normal; text-align: left; vertical-align: top;`
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
        // 圆角卡片表（列表卡/代码卡）必须保持 separate —— collapse 会让 border-radius 圆角失效
        const keepsSeparate = isCodeTable || /border-radius/i.test(currentStyle);
        const collapseStyle = keepsSeparate
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
