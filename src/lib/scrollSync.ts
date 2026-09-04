/**
 * 滚动同步核心工具
 *
 * 把原来 App.tsx 里每次滚动全量 querySelectorAll + getBoundingClientRect 的逻辑
 * 拆成可测试、可缓存的纯函数，解决两侧位置“感觉不一致”的几个根因：
 *
 * 1. 预览锚点取的是卡片内层元素（span/p）的顶部，而不是视觉块顶部，
 *    导致每个块都有 8~40px 的系统性偏移 —— resolvePreviewBlockElement 会
 *    上爬到真正的视觉块（卡片/行容器），多块包裹时停在单项行上。
 * 2. 插值用线性 findIndex，每次 O(n) —— 改为二分查找 + clamp。
 * 3. 为缓存而设计：调用方只在内容/尺寸变化时重建锚点，滚动时只做插值。
 * 4. 顶部对齐的插值在块高差大时（大图/代码块）必然让视口中部的块错位，
 *    所以用“视口焦点对齐 + 首尾保端”的混合映射（见 mapScrollPosition）。
 */

export interface ScrollAnchors {
    editorAnchors: number[];
    previewAnchors: number[];
    editorMax: number;
    previewMax: number;
}

export interface AnchorCache extends ScrollAnchors {
    editorScrollHeight: number;
    previewScrollHeight: number;
}

const PREVIEW_EPS = 2;
const EDITOR_EPS = 1;

const BLOCK_TAGS = /^(SECTION|DIV|TABLE|TD|TR|LI|BLOCKQUOTE|PRE|P|H1|H2|H3|H4|H5|H6|HR)$/;

/**
 * 线性插值：把 source 坐标系的位置映射到 target 坐标系。
 * anchors 必须等长且各自单调递增（允许首尾为 0/max）。
 */
export function interpolateScrollPosition(
    position: number,
    sourceAnchors: number[],
    targetAnchors: number[],
): number {
    if (sourceAnchors.length < 2 || sourceAnchors.length !== targetAnchors.length) return 0;
    if (!Number.isFinite(position)) return 0;

    const first = sourceAnchors[0];
    const last = sourceAnchors[sourceAnchors.length - 1];
    if (position <= first) return targetAnchors[0];
    if (position >= last) return targetAnchors[targetAnchors.length - 1];

    // 二分找第一个 >= position 的下标
    let lo = 1;
    let hi = sourceAnchors.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sourceAnchors[mid] < position) lo = mid + 1;
        else hi = mid;
    }
    const upperIndex = lo;
    const lowerIndex = upperIndex - 1;
    const sourceSpan = sourceAnchors[upperIndex] - sourceAnchors[lowerIndex];
    if (sourceSpan <= 0) return targetAnchors[upperIndex];

    const progress = (position - sourceAnchors[lowerIndex]) / sourceSpan;
    // clamp progress，避免浮点误差导致 overshoot
    const clamped = Math.min(1, Math.max(0, progress));
    return (
        targetAnchors[lowerIndex] +
        clamped * (targetAnchors[upperIndex] - targetAnchors[lowerIndex])
    );
}

/**
 * 把打标节点解析为真正的视觉块。
 *
 * 背景：特殊排版（松烟/卡册/极光）把 data-md-index 打在卡片内层的 span/p 上，
 * 直接用它的 rect.top 会比卡片顶部低 8~40px，每个块累积下来就是“对不齐”。
 * 这里的策略：
 * - LI/TR/PRE/BLOCKQUOTE/H1-H6/HR 等块级标记本身就是视觉块，直接返回；
 * - SPAN、TD 里的 P（有序列表项）则往上爬；
 * - 往上爬时，如果父级只包含当前这一个标记，说明父级是卡片包裹，继续爬；
 * - 如果父级包含多个标记，说明父级是列表包裹，停在父级下属的单项行上。
 */
export function resolvePreviewBlockElement(
    node: HTMLElement,
    contentRoot: HTMLElement | null,
): HTMLElement {
    if (!contentRoot) return node;
    try {
        if (!contentRoot.contains(node)) return node;
    } catch {
        return node;
    }

    const tag = node.tagName;
    const needsClimb =
        tag === 'SPAN' ||
        tag === 'IMG' ||
        (tag === 'P' && node.parentElement !== null && node.parentElement.tagName === 'TD');

    // 块级元素本身：P（普通段落）、LI、TR 等直接用，只有上面三种情况需要上爬。
    // 但 P 在 SECTION 卡片里时也需要上爬到卡片，所以 P 也走统一爬升逻辑，
    // 只是 LI/TR 等已经是单项行，直接返回更准。
    if (!needsClimb && (tag === 'LI' || tag === 'TR' || tag === 'PRE' || tag === 'BLOCKQUOTE' || tag === 'HR' || /^H[1-6]$/.test(tag))) {
        return node;
    }

    let current: HTMLElement | null = node;
    // 防止异常 DOM 导致死循环
    let guard = 0;
    while (current && current !== contentRoot && guard++ < 12) {
        const parentEl: HTMLElement | null = current.parentElement;
        if (!parentEl || parentEl === contentRoot) break;
        // 爬到滚动容器之外就停（contentRoot 之外还有 card 包裹 div，不属于内容坐标）
        if (!contentRoot.contains(parentEl)) break;

        if (!BLOCK_TAGS.test(parentEl.tagName)) break;

        let markedCount = 0;
        try {
            markedCount = parentEl.querySelectorAll('[data-md-index]').length;
        } catch {
            break;
        }

        if (markedCount <= 1) {
            // 父级只是当前块的卡片包裹（或无标记的装饰层），继续往上
            // 但如果父级根本不含标记（markedCount===0），说明走到了装饰层，停在 current
            if (markedCount === 0) break;
            current = parentEl;
            continue;
        }

        // 父级包裹多个块：找到父级下属的、包含Node 的那一个直系孩子作为单项行
        let child: HTMLElement | null = node;
        let innerGuard = 0;
        while (child && child.parentElement !== parentEl && innerGuard++ < 12) {
            child = child.parentElement;
            if (!child || child === contentRoot) break;
        }
        if (child && child.parentElement === parentEl && BLOCK_TAGS.test(child.tagName)) {
            return child;
        }
        return current;
    }
    return current ?? node;
}

export interface BuildAnchorsDeps {
    /** editor.getTopForLineNumber(lineNumber) */
    getTopForLineNumber: (lineNumber: number) => number;
    /** offset -> {lineNumber} */
    getPositionAt: (offset: number) => { lineNumber: number };
    editorScrollHeight: number;
    editorLayoutHeight: number;
    previewElement: HTMLElement;
    contentRoot: HTMLElement | null;
    previewNodes: HTMLElement[];
    locations: Array<{ start: number }>;
}

/**
 * 纯函数版本：方便单测。真实 DOM 版本见 buildScrollAnchorsFromDom。
 */
export function buildScrollAnchors(deps: BuildAnchorsDeps): ScrollAnchors {
    const {
        getTopForLineNumber,
        getPositionAt,
        editorScrollHeight,
        editorLayoutHeight,
        previewElement,
        contentRoot,
        previewNodes,
        locations,
    } = deps;

    const editorMax = Math.max(editorScrollHeight - editorLayoutHeight, 0);
    const previewMax = Math.max(previewElement.scrollHeight - previewElement.clientHeight, 0);
    const previewRect = previewElement.getBoundingClientRect();

    const previewNodeByIndex = new Map<number, HTMLElement>();
    previewNodes.forEach((node) => {
        const index = Number((node as HTMLElement).dataset?.mdIndex);
        if (Number.isFinite(index) && !previewNodeByIndex.has(index)) {
            previewNodeByIndex.set(index, node);
        }
    });

    const editorAnchors = [0];
    const previewAnchors = [0];
    let previousEditorAnchor = 0;
    let previousPreviewAnchor = 0;

    // 用下标遍历（locations 顺序即全局索引顺序，与 data-md-index 对应）
    for (let index = 0; index < locations.length; index++) {
        const location = locations[index];
        const previewNode = previewNodeByIndex.get(index);
        if (!previewNode) continue;

        let editorAnchor = 0;
        try {
            const position = getPositionAt(location.start);
            editorAnchor = Math.min(Math.max(getTopForLineNumber(position.lineNumber), 0), editorMax);
        } catch {
            continue;
        }

        const block = resolvePreviewBlockElement(previewNode, contentRoot);
        let blockTop = 0;
        try {
            blockTop = block.getBoundingClientRect().top - previewRect.top + previewElement.scrollTop;
        } catch {
            continue;
        }
        const previewAnchor = Math.min(Math.max(blockTop, 0), previewMax);

        if (editorAnchor <= previousEditorAnchor + EDITOR_EPS) continue;
        if (previewAnchor <= previousPreviewAnchor + PREVIEW_EPS) continue;

        editorAnchors.push(editorAnchor);
        previewAnchors.push(previewAnchor);
        previousEditorAnchor = editorAnchor;
        previousPreviewAnchor = previewAnchor;
    }

    if (
        editorAnchors[editorAnchors.length - 1] !== editorMax ||
        previewAnchors[previewAnchors.length - 1] !== previewMax
    ) {
        editorAnchors.push(editorMax);
        previewAnchors.push(previewMax);
    }

    return { editorAnchors, previewAnchors, editorMax, previewMax };
}

export interface EditorLike {
    getTopForLineNumber(lineNumber: number): number;
    getScrollHeight(): number;
    getLayoutInfo(): { height: number };
    getModel(): { getPositionAt(offset: number): { lineNumber: number } } | null;
}

/**
 * 真实 DOM 版本：从 editor + previewElement + locations 构建锚点。
 * contentRoot 传 preview-content 元素（previewRef.current），可为 null（降级为节点自身）。
 */
export function buildScrollAnchorsFromDom(
    editor: EditorLike,
    previewElement: HTMLElement,
    contentRoot: HTMLElement | null,
    locations: Array<{ start: number }>,
): ScrollAnchors {
    const model = editor.getModel();
    const editorMax = Math.max(editor.getScrollHeight() - editor.getLayoutInfo().height, 0);
    const previewMax = Math.max(previewElement.scrollHeight - previewElement.clientHeight, 0);

    if (!model) {
        return { editorAnchors: [0, editorMax], previewAnchors: [0, previewMax], editorMax, previewMax };
    }

    const previewRect = previewElement.getBoundingClientRect();
    const previewNodes = Array.from(previewElement.querySelectorAll<HTMLElement>('[data-md-index]'));
    const previewNodeByIndex = new Map<number, HTMLElement>();
    previewNodes.forEach((node) => {
        const index = Number(node.dataset.mdIndex);
        if (Number.isFinite(index) && !previewNodeByIndex.has(index)) {
            previewNodeByIndex.set(index, node);
        }
    });

    const editorAnchors = [0];
    const previewAnchors = [0];
    let previousEditorAnchor = 0;
    let previousPreviewAnchor = 0;

    for (let index = 0; index < locations.length; index++) {
        const previewNode = previewNodeByIndex.get(index);
        if (!previewNode) continue;

        let editorAnchor = 0;
        try {
            const position = model.getPositionAt(locations[index].start);
            editorAnchor = Math.min(Math.max(editor.getTopForLineNumber(position.lineNumber), 0), editorMax);
        } catch {
            continue;
        }

        const block = resolvePreviewBlockElement(previewNode, contentRoot);
        let previewAnchor = 0;
        try {
            const top = block.getBoundingClientRect().top - previewRect.top + previewElement.scrollTop;
            previewAnchor = Math.min(Math.max(top, 0), previewMax);
        } catch {
            continue;
        }

        if (editorAnchor <= previousEditorAnchor + EDITOR_EPS) continue;
        if (previewAnchor <= previousPreviewAnchor + PREVIEW_EPS) continue;

        editorAnchors.push(editorAnchor);
        previewAnchors.push(previewAnchor);
        previousEditorAnchor = editorAnchor;
        previousPreviewAnchor = previewAnchor;
    }

    if (
        editorAnchors[editorAnchors.length - 1] !== editorMax ||
        previewAnchors[previewAnchors.length - 1] !== previewMax
    ) {
        editorAnchors.push(editorMax);
        previewAnchors.push(previewMax);
    }

    return { editorAnchors, previewAnchors, editorMax, previewMax };
}

/**
 * 缓存是否还能用：内容高度漂移（图片异步加载/窗口缩放）超过阈值就重建。
 */
export function isAnchorCacheValid(
    cache: AnchorCache | null,
    editorScrollHeight: number,
    previewScrollHeight: number,
    threshold = 40,
): cache is AnchorCache {
    if (!cache) return false;
    return (
        Math.abs(cache.editorScrollHeight - editorScrollHeight) <= threshold &&
        Math.abs(cache.previewScrollHeight - previewScrollHeight) <= threshold
    );
}

// ---------------------------------------------------------------------------
// 视口焦点对齐的混合映射
// ---------------------------------------------------------------------------

/** 视口焦点位置：0.5 是正中，0.4 略偏上（阅读视线习惯），两侧用同一值保证对称 */
export const SCROLL_FOCUS_RATIO = 0.4;
/** 首尾各保留 30% 做向顶部映射的平滑过渡，保证顶/底严格对齐 */
const SCROLL_EDGE_BLEND = 0.3;

export function smoothstep(a: number, b: number, x: number): number {
    if (a === b) return x >= b ? 1 : 0;
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

export interface DualScrollAnchors {
    /** 顶部映射用（scrollTop 空间，首尾严格是 0/max，首尾对齐精确） */
    editorTop: number[];
    previewTop: number[];
    /** 焦点映射用（内容空间，首尾是 0/scrollHeight，中部对齐精确） */
    editorContent: number[];
    previewContent: number[];
    editorMax: number;
    previewMax: number;
    editorScrollHeight: number;
    previewScrollHeight: number;
}

export interface DualAnchorCache extends DualScrollAnchors {
    editorViewport: number;
    previewViewport: number;
}

/**
 * 一次遍历同时构建两套锚点：top（钳到 max） molding content（钳到 scrollHeight）。
 */
export function buildDualScrollAnchorsFromDom(
    editor: EditorLike,
    previewElement: HTMLElement,
    contentRoot: HTMLElement | null,
    locations: Array<{ start: number }>,
): DualScrollAnchors {
    const editorScrollHeight = editor.getScrollHeight();
    const editorViewport = editor.getLayoutInfo().height;
    const previewScrollHeight = previewElement.scrollHeight;
    const previewViewport = previewElement.clientHeight;
    const editorMax = Math.max(editorScrollHeight - editorViewport, 0);
    const previewMax = Math.max(previewScrollHeight - previewViewport, 0);

    const model = editor.getModel();
    if (!model) {
        return {
            editorTop: [0, editorMax],
            previewTop: [0, previewMax],
            editorContent: [0, editorScrollHeight],
            previewContent: [0, previewScrollHeight],
            editorMax,
            previewMax,
            editorScrollHeight,
            previewScrollHeight,
        };
    }

    const previewRect = previewElement.getBoundingClientRect();
    const previewScrollTop = previewElement.scrollTop;
    const previewNodes = Array.from(previewElement.querySelectorAll<HTMLElement>('[data-md-index]'));
    const previewNodeByIndex = new Map<number, HTMLElement>();
    previewNodes.forEach((node) => {
        const index = Number(node.dataset.mdIndex);
        if (Number.isFinite(index) && !previewNodeByIndex.has(index)) {
            previewNodeByIndex.set(index, node);
        }
    });

    const editorTop = [0];
    const previewTop = [0];
    const editorContent = [0];
    const previewContent = [0];
    let prevTopE = 0;
    let prevTopP = 0;
    let prevContentE = 0;
    let prevContentP = 0;

    for (let index = 0; index < locations.length; index++) {
        const previewNode = previewNodeByIndex.get(index);
        if (!previewNode) continue;

        let rawEditorTop = 0;
        try {
            const position = model.getPositionAt(locations[index].start);
            rawEditorTop = editor.getTopForLineNumber(position.lineNumber);
            if (!Number.isFinite(rawEditorTop)) continue;
        } catch {
            continue;
        }

        const block = resolvePreviewBlockElement(previewNode, contentRoot);
        let rawPreviewTop = 0;
        try {
            rawPreviewTop = block.getBoundingClientRect().top - previewRect.top + previewScrollTop;
            if (!Number.isFinite(rawPreviewTop)) continue;
        } catch {
            continue;
        }

        // content 空间：只钳到内容高，不钳到 max（底部大块的信息不能丢）
        const cE = Math.min(Math.max(rawEditorTop, 0), editorScrollHeight);
        const cP = Math.min(Math.max(rawPreviewTop, 0), previewScrollHeight);
        if (cE > prevContentE + EDITOR_EPS && cP > prevContentP + PREVIEW_EPS) {
            editorContent.push(cE);
            previewContent.push(cP);
            prevContentE = cE;
            prevContentP = cP;
        }

        // top 空间：钳到 max，保证首尾对齐
        const tE = Math.min(Math.max(rawEditorTop, 0), editorMax);
        const tP = Math.min(Math.max(rawPreviewTop, 0), previewMax);
        if (tE > prevTopE + EDITOR_EPS && tP > prevTopP + PREVIEW_EPS) {
            editorTop.push(tE);
            previewTop.push(tP);
            prevTopE = tE;
            prevTopP = tP;
        }
    }

    if (editorTop[editorTop.length - 1] !== editorMax || previewTop[previewTop.length - 1] !== previewMax) {
        editorTop.push(editorMax);
        previewTop.push(previewMax);
    }
    if (
        editorContent[editorContent.length - 1] !== editorScrollHeight ||
        previewContent[previewContent.length - 1] !== previewScrollHeight
    ) {
        editorContent.push(editorScrollHeight);
        previewContent.push(previewScrollHeight);
    }

    return {
        editorTop,
        previewTop,
        editorContent,
        previewContent,
        editorMax,
        previewMax,
        editorScrollHeight,
        previewScrollHeight,
    };
}

export function isDualAnchorCacheValid(
    cache: DualAnchorCache | null,
    editorScrollHeight: number,
    previewScrollHeight: number,
    threshold = 40,
): cache is DualAnchorCache {
    if (!cache) return false;
    return (
        Math.abs(cache.editorScrollHeight - editorScrollHeight) <= threshold &&
        Math.abs(cache.previewScrollHeight - previewScrollHeight) <= threshold
    );
}

export interface MapScrollArgs {
    sourceScroll: number;
    sourceMax: number;
    sourceViewport: number;
    targetMax: number;
    targetViewport: number;
    /** top 空间的源/目标锚点 */
    sourceTop: number[];
    targetTop: number[];
    /** 内容空间的源/目标锚点 */
    sourceContent: number[];
    targetContent: number[];
    focusRatio?: number;
}

/**
 * 混合映射：中部用视口焦点对齐（同一块出现在两侧视口的同一高度），
 * 首尾用顶部对齐并平滑混合，保证顶/底严格对齐（0->0，max->max）。
 */
export function mapScrollPosition(args: MapScrollArgs): number {
    const {
        sourceScroll,
        sourceMax,
        sourceViewport,
        targetMax,
        targetViewport,
        sourceTop,
        targetTop,
        sourceContent,
        targetContent,
        focusRatio = SCROLL_FOCUS_RATIO,
    } = args;

    if (!Number.isFinite(sourceScroll) || !Number.isFinite(targetMax)) return 0;
    if (targetMax <= 0) return 0;
    const s = Math.min(Math.max(sourceScroll, 0), Math.max(sourceMax, 0));
    if (sourceMax <= 0) return 0;
    if (s <= 1) return 0;
    if (s >= sourceMax - 1) return targetMax;

    const topMapped = interpolateScrollPosition(s, sourceTop, targetTop);

    let centerMapped = topMapped;
    if (sourceViewport > 0 && targetViewport > 0) {
        const sourceRef = s + sourceViewport * focusRatio;
        const targetRef = interpolateScrollPosition(sourceRef, sourceContent, targetContent);
        if (Number.isFinite(targetRef)) {
            centerMapped = Math.min(Math.max(targetRef - targetViewport * focusRatio, 0), targetMax);
        }
    }

    const t = s / sourceMax;
    const w =
        smoothstep(0, SCROLL_EDGE_BLEND, t) * (1 - smoothstep(1 - SCROLL_EDGE_BLEND, 1, t));
    const blended = (1 - w) * topMapped + w * centerMapped;
    return Math.min(Math.max(blended, 0), targetMax);
}
