import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AppNavbar from '@/components/AppNavbar'
import BookDetailClient from './BookDetailClient'

interface Props {
  params: { id: string }
}

export default async function BookDetailPage({ params }: Props) {
  const book = await prisma.book.findUnique({
    where: { id: params.id },
  })

  if (!book) notFound()

  const session = await getServerSession(authOptions)

  // Aggregate review stats
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

  // Reader counts
  const [readCount, readingCount] = await Promise.all([
    prisma.bookshelfEntry.count({
      where: { bookId: params.id, shelf: { slug: 'read' } },
    }),
    prisma.bookshelfEntry.count({
      where: { bookId: params.id, shelf: { slug: 'currently-reading' } },
    }),
  ])

  // Check if current user already reviewed this book
  let userReviewId: string | null = null
  if (session?.user?.id) {
    const userReview = await prisma.post.findFirst({
      where: {
        authorId: session.user.id,
        bookId: params.id,
        type: 'REVIEW',
      },
      select: { id: true },
    })
    userReviewId = userReview?.id ?? null
  }

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <BookDetailClient
        book={book}
        reviewStats={{
          averageRating: reviewStats._avg.rating
            ? Math.round(reviewStats._avg.rating * 10) / 10
            : null,
          totalReviews: reviewStats._count.id,
        }}
        readerCounts={{ read: readCount, reading: readingCount }}
        isLoggedIn={!!session}
        currentUserId={session?.user?.id}
        userReviewId={userReviewId}
      />
    </div>
  )
}
