import type { Theme, LayoutTheme, FlatTheme, LayoutConfig } from './types';
import { classicThemes } from './classic';
import { modernThemes } from './modern';
import { extraThemes } from './extra';
import { songyanThemes } from './songyan';
import { kaceThemes } from './kace';

export type { Theme, LayoutTheme, FlatTheme, LayoutConfig };
export const THEMES: Theme[] = [...classicThemes, ...modernThemes, ...extraThemes, ...songyanThemes, ...kaceThemes];

export interface ThemeSubgroup {
  label: string;
  themes: Theme[];
}

export interface ThemeGroup {
  label: string;
  themes: Theme[];
  /** 可选二级子组：特殊排版按主题结构再分组（松烟手札 / 卡册 / 未来的新结构） */
  subgroups?: ThemeSubgroup[];
}

export const THEME_GROUPS: ThemeGroup[] = [
  { label: '经典', themes: classicThemes },
  { label: '潮流', themes: modernThemes },
  { label: '更多风格', themes: extraThemes },
  { label: '特殊排版', themes: [...songyanThemes, ...kaceThemes], subgroups: [
    { label: '松烟手札', themes: songyanThemes },
    { label: '卡册', themes: kaceThemes },
  ] },
];
