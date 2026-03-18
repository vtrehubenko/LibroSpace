import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { searchGoogleBooks } from '@/lib/googleBooks'

const TRENDING_SUBJECTS = ['fiction', 'science', 'history', 'technology', 'biography', 'psychology']
const FALLBACK_CATEGORIES = ['Fiction', 'Science', 'History', 'Romance', 'Technology', 'Philosophy', 'Biography', 'Art', 'Business', 'Psychology']

let cache: { data: unknown; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  const subjectIndex = new Date().getDay() % TRENDING_SUBJECTS.length
  const subject = TRENDING_SUBJECTS[subjectIndex]

  const [trending, popular, recentlyReviewed, dbCategories] = await Promise.all([
    searchGoogleBooks(`subject:${subject}`).catch(() => []),
    prisma.book.findMany({
      where: { shelfEntries: { some: {} } },
      orderBy: { shelfEntries: { _count: 'desc' } },
      take: 10,
      select: { id: true, title: true, author: true, description: true, coverUrl: true, pageCount: true, categories: true },
    }),
    (async () => {
      const recentPosts = await prisma.post.findMany({
        where: { type: 'REVIEW', bookId: { not: null } },
        orderBy: { createdAt: 'desc' },
        distinct: ['bookId'],
        take: 10,
        select: { bookId: true },
      })
      const bookIds = recentPosts.map(p => p.bookId!).filter(Boolean)
      if (bookIds.length === 0) return []
      return prisma.book.findMany({
        where: { id: { in: bookIds } },
        select: { id: true, title: true, author: true, description: true, coverUrl: true, pageCount: true, categories: true },
      })
    })(),
    prisma.book.findMany({
      where: { categories: { isEmpty: false } },
      select: { categories: true },
    }),
  ])

  const allCategories = dbCategories.flatMap(b => b.categories).concat(FALLBACK_CATEGORIES)
  const categories = Array.from(new Set(allCategories)).sort()

  const responseData = { trending, popular, recentlyReviewed, categories }
  cache = { data: responseData, timestamp: Date.now() }

  return NextResponse.json(responseData)
}
