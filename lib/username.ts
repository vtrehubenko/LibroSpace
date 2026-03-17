import { prisma } from './prisma'

const RESERVED_USERNAMES = [
  'admin', 'api', 'auth', 'feed', 'library', 'messages', 'notifications',
  'profile', 'reader', 'search', 'settings', 'appeal', 'book', 'post',
]

export function sanitizeUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 30)
}

export function isValidUsername(username: string): boolean {
  if (username.length < 3 || username.length > 30) return false
  if (!/^[a-z][a-z0-9_-]*$/.test(username)) return false
  if (RESERVED_USERNAMES.includes(username)) return false
  return true
}

export async function generateUniqueUsername(name: string | null, email: string): Promise<string> {
  const base = sanitizeUsername(name || email.split('@')[0])
  const candidate = base || 'reader'

  let username = candidate.slice(0, 26)
  let attempt = 0

  while (true) {
    const tryName = attempt === 0 ? username : `${username}${attempt}`
    const exists = await prisma.user.findUnique({ where: { username: tryName } })
    if (!exists && !RESERVED_USERNAMES.includes(tryName)) {
      return tryName
    }
    attempt++
    if (attempt > 100) {
      return `${username}${Date.now().toString(36).slice(-6)}`
    }
  }
}
