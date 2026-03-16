export const CATEGORIES = [
  'Fiction',
  'Non-Fiction',
  'Science',
  'History',
  'Philosophy',
  'Art & Design',
  'Business',
  'Technology',
  'Self-Help',
  'Education',
  'Other',
] as const

export type CategoryColors = { accent: string; from: string; to: string; spine: string }

export const CATEGORY_COLORS: Record<string, CategoryColors> = {
  Fiction: { accent: '#f472b6', from: '#1a0014', to: '#300025', spine: '#0d0009' },
  'Non-Fiction': { accent: '#f59e0b', from: '#181000', to: '#302000', spine: '#0c0800' },
  Science: { accent: '#22d3ee', from: '#001424', to: '#002040', spine: '#000a14' },
  History: { accent: '#fb923c', from: '#1a0a00', to: '#301500', spine: '#0d0700' },
  Philosophy: { accent: '#a78bfa', from: '#0e0020', to: '#1a0038', spine: '#080014' },
  'Art & Design': { accent: '#34d399', from: '#001810', to: '#002e1e', spine: '#000e08' },
  Business: { accent: '#fbbf24', from: '#181200', to: '#302200', spine: '#0c0a00' },
  Technology: { accent: '#3b82f6', from: '#071828', to: '#0a2845', spine: '#040e18' },
  'Self-Help': { accent: '#f97316', from: '#1a0c00', to: '#301800', spine: '#0d0600' },
  Education: { accent: '#06b6d4', from: '#001418', to: '#002030', spine: '#000a10' },
  Other: { accent: '#94a3b8', from: '#0f1218', to: '#1a1f28', spine: '#080a0e' },
}

export const CATEGORY_ICONS: Record<string, string> = {
  Fiction: '📖',
  'Non-Fiction': '📚',
  Science: '🔬',
  History: '📜',
  Philosophy: '🤔',
  'Art & Design': '🎨',
  Business: '💼',
  Technology: '💻',
  'Self-Help': '🌱',
  Education: '🎓',
  Other: '📁',
}

export const FALLBACK_ICON = '📁'
export const FALLBACK_COLORS: CategoryColors = {
  accent: '#94a3b8',
  from: '#0f1218',
  to: '#1a1f28',
  spine: '#080a0e',
}

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] || FALLBACK_ICON
}

export function getCategoryColors(category: string): CategoryColors {
  return CATEGORY_COLORS[category] || FALLBACK_COLORS
}
