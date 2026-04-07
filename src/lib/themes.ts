export interface ThemePreset {
  id: string;
  name: string;
  desc: string;
  group: 'essenciais' | 'premium';
  mode: 'light' | 'dark';
  vars: {
    background: string;
    card: string;
    foreground: string;
    border: string;
    muted: string;
    sidebar: string;
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'clean-warm',
    name: 'Clean Warm',
    desc: 'Claro e acolhedor',
    group: 'essenciais',
    mode: 'light',
    vars: {
      background: '#FAF8F4',
      card: '#F2EDE6',
      foreground: '#1C1C1A',
      border: 'rgba(28,28,26,0.08)',
      muted: '#E8E2D9',
      sidebar: '#F2EDE6',
    },
  },
  {
    id: 'dark-elegante',
    name: 'Dark Elegante',
    desc: 'Escuro sofisticado',
    group: 'essenciais',
    mode: 'dark',
    vars: {
      background: '#141210',
      card: '#1E1A17',
      foreground: '#EDE6DA',
      border: 'rgba(237,230,218,0.08)',
      muted: '#2A2520',
      sidebar: '#1A1714',
    },
  },
  {
    id: 'rose-creme',
    name: 'Rosé Creme',
    desc: 'Quente e feminino',
    group: 'essenciais',
    mode: 'light',
    vars: {
      background: '#FDF8F5',
      card: '#F9EEE8',
      foreground: '#2D1810',
      border: 'rgba(45,24,16,0.08)',
      muted: '#F0DDD4',
      sidebar: '#F0DDD4',
    },
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    desc: 'Profundo e focado',
    group: 'essenciais',
    mode: 'dark',
    vars: {
      background: '#0F1420',
      card: '#161D2E',
      foreground: '#E0E8F0',
      border: 'rgba(224,232,240,0.08)',
      muted: '#1E2840',
      sidebar: '#0D1120',
    },
  },
  {
    id: 'terracota-soft',
    name: 'Terracota Soft',
    desc: 'Natural e quente',
    group: 'essenciais',
    mode: 'light',
    vars: {
      background: '#FBF5EF',
      card: '#F4EAE0',
      foreground: '#2A1A0F',
      border: 'rgba(42,26,15,0.08)',
      muted: '#E8D8C8',
      sidebar: '#EDD8C4',
    },
  },
  {
    id: 'lavanda-studio',
    name: 'Lavanda Studio',
    desc: 'Criativo e suave',
    group: 'premium',
    mode: 'light',
    vars: {
      background: '#F8F6FD',
      card: '#EDE8F8',
      foreground: '#1E1530',
      border: 'rgba(30,21,48,0.08)',
      muted: '#DDD5F0',
      sidebar: '#DDD5F0',
    },
  },
  {
    id: 'salvia-premium',
    name: 'Sálvia Premium',
    desc: 'Natural e elegante',
    group: 'premium',
    mode: 'light',
    vars: {
      background: '#F5F8F5',
      card: '#E8F0E8',
      foreground: '#1A2A1A',
      border: 'rgba(26,42,26,0.08)',
      muted: '#D5E5D5',
      sidebar: '#D5E5D5',
    },
  },
  {
    id: 'terracota-chic',
    name: 'Terracota Chic',
    desc: 'Quente e sofisticado',
    group: 'premium',
    mode: 'light',
    vars: {
      background: '#FAF3EE',
      card: '#F2E4D8',
      foreground: '#2A1508',
      border: 'rgba(42,21,8,0.08)',
      muted: '#E5CDB8',
      sidebar: '#E5CDB8',
    },
  },
  {
    id: 'nude-elegante',
    name: 'Nude Elegante',
    desc: 'Minimalista e refinado',
    group: 'premium',
    mode: 'light',
    vars: {
      background: '#F8F6F2',
      card: '#EDE9E2',
      foreground: '#2C2820',
      border: 'rgba(44,40,32,0.08)',
      muted: '#E0D9D0',
      sidebar: '#D8CEBE',
    },
  },
  {
    id: 'modern-olive',
    name: 'Modern Olive',
    desc: 'Orgânico e moderno',
    group: 'premium',
    mode: 'light',
    vars: {
      background: '#F6F8F2',
      card: '#E8EEE0',
      foreground: '#1E2415',
      border: 'rgba(30,36,21,0.08)',
      muted: '#D8E2C8',
      sidebar: '#CED8BC',
    },
  },
  {
    id: 'editorial-rose',
    name: 'Editorial Rose',
    desc: 'Romântico e editorial',
    group: 'premium',
    mode: 'light',
    vars: {
      background: '#FDF6F8',
      card: '#F5E8EE',
      foreground: '#28101A',
      border: 'rgba(40,16,26,0.08)',
      muted: '#EAD4DE',
      sidebar: '#EAD4DE',
    },
  },
];

export const ACCENT_COLORS = [
  { key: 'terracota', label: 'Terracota', value: '#C4622D' },
  { key: 'sage', label: 'Sálvia', value: '#5C7A6B' },
  { key: 'rosa', label: 'Rosa', value: '#EC4899' },
  { key: 'azul', label: 'Azul', value: '#3B82F6' },
  { key: 'roxo', label: 'Roxo', value: '#8B5CF6' },
  { key: 'verde', label: 'Verde', value: '#22C55E' },
  { key: 'dourado', label: 'Dourado', value: '#F59E0B' },
  { key: 'neutro', label: 'Neutro', value: '#6B7280' },
];
