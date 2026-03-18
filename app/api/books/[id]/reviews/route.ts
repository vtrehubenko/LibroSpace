import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50)

  const book = await prisma.book.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  let blockedIds: string[] = []
  if (session?.user?.id) {
    const [blockedByMe, blockedMe] = await Promise.all([
      prisma.block.findMany({
        where: { blockerId: session.user.id },
        select: { blockedId: true },
      }),
      prisma.block.findMany({
        where: { blockedId: session.user.id },
        select: { blockerId: true },
      }),
    ])
    blockedIds = [
      ...blockedByMe.map((b) => b.blockedId),
      ...blockedMe.map((b) => b.blockerId),
    ]
  }

  const reviews = await prisma.post.findMany({
    where: {
      bookId: params.id,
      type: 'REVIEW',
      isHidden: false,
      ...(blockedIds.length > 0
        ? { authorId: { notIn: blockedIds } }
        : {}),
      author: { shadowBanned: false },
    },
    include: {
      author: {
        select: { id: true, name: true, username: true, avatarUrl: true, image: true },
      },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = reviews.length > limit
  if (hasMore) reviews.pop()

  const stats = await prisma.post.aggregate({
    where: {
      bookId: params.id,
      type: 'REVIEW',
      isHidden: false,
      author: { shadowBanned: false },
    },
    _avg: { rating: true },
    _count: { id: true },
  })

  return NextResponse.json({
    reviews,
    nextCursor: hasMore ? reviews[reviews.length - 1].id : null,
    stats: {
      averageRating: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : null,
      totalReviews: stats._count.id,
    },
  })
}
