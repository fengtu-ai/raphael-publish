/**
 * Theme 类型定义
 *
 * 两类主题：
 * - flat（默认）：现有「扁平样式」主题，styles 是 {元素: inlineCSS} 映射，
 *   applyTheme() 只对 markdown-it 产出的扁平 HTML 逐元素着色。
 * - layout：「特殊排版」主题，layout 是一份配色 + 组件内联样式串，
 *   applyLayout() 把扁平 HTML 重构为结构化组件树（封面卡/编号章节/金句卡/文末三连等）。
 *
 * kind 缺省视为 'flat'，现有 classic/modern/extra 三套零改动。
 */

export interface ThemeColors {
  /** 主色（松烟墨绿） */
  ink: string;
  /** 浅主色（编号、分割线、下划线） */
  inkLight: string;
  /** 纸底 */
  paper: string;
  /** 深纸底（卡片底） */
  paperDeep: string;
  /** 正文色 */
  text: string;
  /** 次要文字 */
  textSoft: string;
  /** 分割线色 */
  rule: string;
  /** 点睛色（金） */
  gold: string;
  /** 警示/对比色 */
  alert: string;
}

export interface ThemeFonts {
  /** 字体栈 */
  family: string;
  /** 正文字号 */
  bodySize: string;
  /** 正文行高 */
  lineHeight: string;
}

/**
 * 特殊排版主题的配色 + 组件内联样式串。
 * 所有特殊排版主题共享同一个 applyLayout 渲染器，换色即换皮。
 */
export interface LayoutConfig {
  colors: ThemeColors;
  fonts: ThemeFonts;
  /** 各组件的完整内联样式串，渲染器拼装时注入 */
  components: {
    /** 根容器 */
    container: string;
    /** 封面卡外壳 */
    cover: string;
    /** 封面顶部标签栏 */
    coverTop: string;
    /** 封面主标题行 */
    coverTitle: string;
    /** 封面副标题行 */
    coverSubtitle: string;
    /** 封面/装饰渐变细线（需自带纯色 fallback） */
    gradientLine: string;
    /** 封面底栏渐变条（需自带纯色 fallback） */
    coverFooter: string;
    /** 目录卡外壳 */
    toc: string;
    /** 目录标题行 */
    tocTitle: string;
    /** 目录滚动容器 */
    tocScroll: string;
    /** 目录单卡（高亮首卡） */
    tocCard: string;
    /** 目录单卡（普通） */
    tocCardDim: string;
    /** 章节标题外壳 */
    chapter: string;
    /** 章节左侧编号大字 */
    chapterNum: string;
    /** 编号下方 PART 小标 */
    chapterPart: string;
    /** 章节中文标题 */
    chapterTitle: string;
    /** 章节英文标签 */
    chapterLabel: string;
    /** 段落 */
    paragraph: string;
    /** 开头引言金句卡 */
    onelinerCard: string;
    /** 非首引用的引用框 */
    quoteBox: string;
    /** h3 小节标题（下划线） */
    subtitle: string;
    /** hr 居中金句分隔 */
    hr: string;
    /** 图片容器 */
    image: string;
    /** 多图网格容器 */
    imageGrid: string;
    /** 有序列表项行 */
    orderedItem: string;
    /** 有序编号圆 */
    orderedNum: string;
    /** 无序列表胶囊项 */
    pillItem: string;
    /** 表头单元格 */
    tableTh: string;
    /** 表体单元格 */
    tableTd: string;
    /** 文末三连卡 */
    footerCta: string;
    // —— 卡册（renderer:'card'）专用，松烟 config 不填 = undefined ——
    /** 卡册大圆角卡壳 */
    cardShell?: string;
    /** 卡册顶部主色全宽色带 */
    cardBand?: string;
    /** 色带内白字标题 */
    cardBandTitle?: string;
    /** 色带右侧 PART 01 小标 */
    cardBandLabel?: string;
    /** 卡身 padding 容器 */
    cardBody?: string;
    /** 卡册封面标题 */
    cardCoverTitle?: string;
    /** 卡册封面副标题 */
    cardCoverSub?: string;
    /** 卡册封面主色短线 */
    cardCoverRule?: string;
    /** h3 小节（正方块+文字） */
    cardSubtitle?: string;
    /** 浅底圆角引用块（无左线） */
    cardQuote?: string;
    /** ul 小正方形标记 / ol 正方形编号块 */
    cardSquareMarker?: string;
    /** hr 居中正方形装饰 */
    cardHrMark?: string;
  };
  /** 行内元素样式串 */
  inline: {
    /** **加粗** → 主色加粗 */
    bold: string;
    /** ==高亮== / <mark> → 金底高亮 */
    highlight: string;
    /** `code` → 代码标签 */
    code: string;
    /** a 链接 */
    link: string;
  };
}

/** 扁平样式主题（现有 30 套） */
export interface FlatTheme {
  kind?: 'flat';
  id: string;
  name: string;
  description: string;
  styles: Record<string, string>;
}

/** 特殊排版主题（结构化重构） */
export interface LayoutTheme {
  kind: 'layout';
  id: string;
  name: string;
  description: string;
  layout: LayoutConfig;
  /** 渲染器判别：缺省 'songyan' 走 applyLayout；'card' 走 applyCardLayout；'editorial' 走 applyEditorialLayout */
  renderer?: 'songyan' | 'card' | 'editorial';
}

export type Theme = FlatTheme | LayoutTheme;
