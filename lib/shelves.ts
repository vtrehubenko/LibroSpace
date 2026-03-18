import { prisma } from './prisma'

export const DEFAULT_SHELVES = [
  { name: 'Currently Reading', slug: 'currently-reading', order: 0 },
  { name: 'Read', slug: 'read', order: 1 },
  { name: 'Want to Read', slug: 'want-to-read', order: 2 },
  { name: 'Favorites', slug: 'favorites', order: 3 },
] as const

export async function createDefaultShelves(userId: string) {
  await prisma.bookshelf.createMany({
    data: DEFAULT_SHELVES.map((shelf) => ({
      userId,
      name: shelf.name,
      slug: shelf.slug,
      type: 'DEFAULT' as const,
      isPublic: true,
      order: shelf.order,
    })),
    skipDuplicates: true,
  })
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

export const shelfEntryWithBook = {
  book: {
    select: {
      id: true,
      title: true,
      author: true,
      coverUrl: true,
      pageCount: true,
      categories: true,
    },
  },
} as const

export const shelfWithCount = {
  _count: {
    select: {
      entries: true,
    },
  },
} as const
