import type { CategoryColors } from './categories'

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return [0, 0, l]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return [h * 360, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  h = h / 360
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Generate a full card theme from a single accent color */
export function generateThemeFromAccent(accent: string): CategoryColors {
  const [h, s] = hexToHsl(accent)

  return {
    accent,
    from: hslToHex(h, Math.min(s, 0.6), 0.05),
    to: hslToHex(h, Math.min(s, 0.6), 0.09),
    spine: hslToHex(h, Math.min(s, 0.6), 0.025),
  }
}

/** Safely parse Prisma Json value into CategoryColors */
export function parseCustomTheme(value: unknown): CategoryColors | null {
  if (!value || typeof value !== 'object') return null
  const t = value as Record<string, unknown>
  if (
    typeof t.accent === 'string' &&
    typeof t.from === 'string' &&
    typeof t.to === 'string' &&
    typeof t.spine === 'string'
  ) {
    return { accent: t.accent, from: t.from, to: t.to, spine: t.spine }
  }
  return null
}
