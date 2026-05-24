/** Color set for one theme */
export interface ThemeColors {
  primary: string;
  dim: string;
  gray: string;
  green: string;
  orange: string;
}

export interface Theme {
  name: string;
  label: string;
  colors: ThemeColors;
}

const amber: Theme = {
  name: 'amber',
  label: 'Amber',
  colors: { primary: '#e1a72a', dim: '#996c20', gray: '#666666', green: '#6abf69', orange: '#e8a04a' },
};

const grey: Theme = {
  name: 'grey',
  label: 'Mono Grey',
  colors: { primary: '#cccccc', dim: '#888888', gray: '#555555', green: '#aaaaaa', orange: '#999999' },
};

const slate: Theme = {
  name: 'slate',
  label: 'Slate',
  colors: { primary: '#94a8b8', dim: '#5a6e7e', gray: '#3d4d5a', green: '#7a9a8a', orange: '#b09478' },
};

export const THEMES: Theme[] = [amber, grey, slate];

export function getTheme(name: string): Theme {
  return THEMES.find(t => t.name === name) ?? amber;
}

export function nextTheme(current: string): Theme {
  const idx = THEMES.findIndex(t => t.name === current);
  return THEMES[(idx + 1) % THEMES.length];
}
