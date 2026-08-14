import type { Theme, LayoutTheme, FlatTheme, LayoutConfig } from './types';
import { classicThemes } from './classic';
import { modernThemes } from './modern';
import { extraThemes } from './extra';
import { songyanThemes } from './songyan';
import { kaceThemes } from './kace';
import { gazetteThemes } from './gazette';

export type { Theme, LayoutTheme, FlatTheme, LayoutConfig };
export const THEMES: Theme[] = [...classicThemes, ...modernThemes, ...extraThemes, ...songyanThemes, ...kaceThemes, ...gazetteThemes];

export interface ThemeSubgroup {
  label: string;
  themes: Theme[];
}

export interface ThemeGroup {
  label: string;
  themes: Theme[];
  /** 可选二级子组：特殊排版按主题结构再分组（松烟手札 / 卡册 / 智刊） */
  subgroups?: ThemeSubgroup[];
}

export const THEME_GROUPS: ThemeGroup[] = [
  { label: '经典', themes: classicThemes },
  { label: '潮流', themes: modernThemes },
  { label: '更多风格', themes: extraThemes },
  { label: '特殊排版', themes: [...songyanThemes, ...kaceThemes, ...gazetteThemes], subgroups: [
    { label: '松烟手札', themes: songyanThemes },
    { label: '卡册', themes: kaceThemes },
    { label: '极光', themes: gazetteThemes },
  ] },
];
