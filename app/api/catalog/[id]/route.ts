import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const book = await prisma.book.findUnique({
    where: { id: params.id },
  })

  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  const reviewStats = await prisma.post.aggregate({
    where: {
      bookId: params.id,
      type: 'REVIEW',
      isHidden: false,
      author: { shadowBanned: false },
    },
    _avg: { rating: true },
    _count: { id: true },
  })

  const [readCount, readingCount] = await Promise.all([
    prisma.bookshelfEntry.count({
      where: {
        bookId: params.id,
        shelf: { slug: 'read' },
      },
    }),
    prisma.bookshelfEntry.count({
      where: {
        bookId: params.id,
        shelf: { slug: 'currently-reading' },
      },
    }),
  ])

  return NextResponse.json({
    ...book,
    reviewStats: {
      averageRating: reviewStats._avg.rating
        ? Math.round(reviewStats._avg.rating * 10) / 10
        : null,
      totalReviews: reviewStats._count.id,
    },
    readerCounts: {
      read: readCount,
      reading: readingCount,
    },
  })
}
