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
      background: '#FBF9F7',
      card: '#FFFFFF',
      foreground: '#1A1A2E',
      border: '#E8E5E0',
      muted: '#F2EDE6',
      sidebar: '#FFFFFF',
    },
  },
  {
    id: 'dark-elegante',
    name: 'Dark Elegante',
    desc: 'Escuro sofisticado',
    group: 'essenciais',
    mode: 'dark',
    vars: {
      background: '#1A1A2E',
      card: '#2A2A3E',
      foreground: '#EDE9F5',
      border: 'rgba(237,233,245,0.08)',
      muted: '#252538',
      sidebar: '#16162A',
    },
  },
  {
    id: 'rose-creme',
    name: 'Rosé Creme',
    desc: 'Quente e feminino',
    group: 'essenciais',
    mode: 'light',
    vars: {
      background: '#FFF6F9',
      card: '#FFFFFF',
      foreground: '#2D1224',
      border: '#F3DDE7',
      muted: '#FCE8EF',
      sidebar: '#FFFFFF',
    },
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    desc: 'Profundo e focado',
    group: 'essenciais',
    mode: 'dark',
    vars: {
      background: '#0B1626',
      card: '#152238',
      foreground: '#DCE9F5',
      border: 'rgba(220,233,245,0.08)',
      muted: '#1B2A42',
      sidebar: '#08111E',
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
      card: '#FFFFFF',
      foreground: '#2A1208',
      border: '#EAD8C5',
      muted: '#F5E5D2',
      sidebar: '#FFFFFF',
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

export const ACCENT_GROUPS = [
  { group: "Pastéis", colors: [
    { key: "rosa-claro", label: "Rosa claro", value: "#F4A6C0" },
    { key: "lavanda", label: "Lavanda", value: "#C3B2EF" },
    { key: "pessego", label: "Pêssego", value: "#F3B99B" },
    { key: "menta", label: "Menta", value: "#A6D9C4" },
    { key: "ceu", label: "Céu", value: "#A7C7EC" },
    { key: "lilas", label: "Lilás", value: "#D7B8E8" },
  ]},
  { group: "Vibrantes", colors: [
    { key: "rosa", label: "Rosa", value: "#EC4899" },
    { key: "roxo", label: "Roxo", value: "#8B5CF6" },
    { key: "coral", label: "Coral", value: "#F2683C" },
    { key: "azul", label: "Azul", value: "#3B82F6" },
    { key: "verde", label: "Verde", value: "#22C55E" },
    { key: "ambar", label: "Âmbar", value: "#F59E0B" },
  ]},
  { group: "Profundos", colors: [
    { key: "vinho", label: "Vinho", value: "#9D2B53" },
    { key: "ameixa", label: "Ameixa", value: "#6D3E8E" },
    { key: "petroleo", label: "Petróleo", value: "#1F6F78" },
    { key: "indigo", label: "Índigo", value: "#3D3F8F" },
    { key: "esmeralda", label: "Esmeralda", value: "#0E7C57" },
    { key: "terracota", label: "Terracota", value: "#B4502A" },
  ]},
];

export const ACCENT_COLORS = [
  { key: 'roxo', label: 'Roxo', value: '#7C5CFC' },
  { key: 'coral', label: 'Coral', value: '#FF6B6B' },
  { key: 'rosa', label: 'Rosa', value: '#FF69B4' },
  { key: 'azul', label: 'Azul', value: '#4DABF7' },
  { key: 'teal', label: 'Teal', value: '#20B2AA' },
  { key: 'ambar', label: 'Âmbar', value: '#FFBE0B' },
  { key: 'verde', label: 'Verde', value: '#22C55E' },
  { key: 'neutro', label: 'Neutro', value: '#6B7280' },
];
